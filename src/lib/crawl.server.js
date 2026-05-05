import { load as loadCheerio } from 'cheerio';
import ytSearch from 'yt-search';
import { loadChannelRegistry, readMoviesFromJsonFile, replacePersistedMovies, updateChannelRegistryEntry } from './movieStore.server.js';
import { CATEGORY_TAXONOMY, getCategoryDefinitionBySlug, normalizeMovieCategory, normalizeText, resolveMovieCategory } from './movieCategories.js';
import { hasRenderableThumbnail } from './thumbnailFilters.js';

const EPISODE_REGEX = /(t\u1eadp|tap|episode|ep\.?|ph\u1ea7n)\s*(\d{1,4})/i;
const MIN_VIDEO_SECONDS = 600;
const MAX_STORED_VIDEOS = 1000;
const CHANNEL_FEED_ENTRY_LIMIT = 20;
const CHANNEL_VIDEO_DETAIL_LIMIT = 16;
const SEARCH_RESULT_LIMIT = 20;
const SEARCH_BACKFILL_ENABLED = process.env.CRAWL_ENABLE_SEARCH_BACKFILL === '1';
const RETRY_TIMES = 3;
const RETRY_BASE_DELAY_MS = 250;

const channelIdentityCache = new Map();
const channelCandidateCache = new Map();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function timestamp() {
  return new Date().toISOString();
}

function logCrawl(message, details) {
  if (details === undefined) {
    console.log(`[${timestamp()}] ${message}`);
    return;
  }

  const serialized = typeof details === 'string' ? details : JSON.stringify(details);
  console.log(`[${timestamp()}] ${message} ${serialized}`);
}

function incrementCountMap(map, key, amount = 1) {
  const normalizedKey = key || 'unknown';
  map[normalizedKey] = (map[normalizedKey] || 0) + amount;
  return map;
}

function sortCountMap(map = {}) {
  return Object.fromEntries(Object.entries(map).sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function createCategoryRunStats() {
  return {
    kept: 0,
    rejected: 0,
    duplicates: 0,
    errors: 0,
    rejectReasons: {},
    duplicateReasons: {},
    errorReasons: {},
  };
}

function createTargetRunStats({ runDay, category, slug, query, type, wave, channelSlug }) {
  return {
    runDay,
    category,
    slug,
    query,
    type,
    wave,
    channelSlug,
    status: 'started',
    candidates: 0,
    kept: 0,
    rejected: 0,
    duplicates: 0,
    errors: 0,
    rejectReasons: {},
    duplicateReasons: {},
    error: null,
  };
}

function summarizeCategoryResults(categorySummaries = []) {
  return categorySummaries.reduce((totals, category) => {
    totals.categories += 1;
    totals.kept += category.kept || 0;
    totals.rejected += category.rejected || 0;
    totals.duplicates += category.duplicates || 0;
    totals.errors += category.errors || 0;

    return totals;
  }, {
    categories: 0,
    kept: 0,
    rejected: 0,
    duplicates: 0,
    errors: 0,
  });
}

export function serializeError(error) {
  if (error instanceof Error) {
    return {
      type: 'Error',
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error === undefined) {
    return {
      type: 'undefined',
      message: 'unknown error',
      stack: null,
    };
  }

  if (error === null) {
    return {
      type: 'null',
      message: 'null thrown',
      stack: null,
    };
  }

  if (typeof error === 'string') {
    return {
      type: 'string',
      message: error,
      stack: null,
    };
  }

  try {
    return {
      type: typeof error,
      value: JSON.parse(JSON.stringify(error)),
      stack: null,
    };
  } catch {
    return {
      type: typeof error,
      value: String(error),
      stack: null,
    };
  }
}

function getErrorStatusCode(error) {
  return error?.statusCode ?? error?.response?.status ?? error?.status ?? error?.cause?.statusCode ?? null;
}

function getErrorCode(error) {
  return error?.code ?? error?.cause?.code ?? null;
}

function isTransientCrawlError(error) {
  const code = getErrorCode(error);
  const statusCode = getErrorStatusCode(error);
  const message = String(error?.message || '').toLowerCase();

  if (statusCode && Number(statusCode) >= 500 && Number(statusCode) < 600) {
    return true;
  }

  if (['ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE'].includes(code)) {
    return true;
  }

  return message.includes('socket hang up') || message.includes('timeout') || message.includes('network error');
}

const CATEGORY_BATCH_LIMIT = 10;
const CATEGORY_TRUSTED_AUTHOR_WORDS = ['ha nhan', 'h\u00e0 nh\u00e2n', 'review phim', 'hoat hinh', 'ho\u1ea1t h\u00ecnh', 'vietsub', 'anime', 'phim', 'cartoon'];

function getChannelKey(channel = {}) {
  return channel.channelId || channel.channelUrl || channel.slug || channel.id || channel.displayName || '';
}

function channelTargets(channels = []) {
  return channels.map(channel => ({
    channel,
    query: channel.displayName || channel.slug || getChannelKey(channel),
    type: 'channel',
  }));
}

function uniqueTargets(targets = []) {
  const seen = new Set();

  return targets.filter(target => {
    const key = target.channel ? `channel:${getChannelKey(target.channel)}` : `${target.type}:${target.query}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildCategoryChannelTargets(categorySlug, channels = []) {
  const enabledChannels = channels.filter(channel => channel?.enabled !== false);
  const primary = enabledChannels.filter(channel => channel.category === categorySlug || channel.category === 'shared');
  const fallback = enabledChannels.filter(channel => channel.category !== categorySlug && channel.category !== 'shared');

  return {
    initial: uniqueTargets(channelTargets(primary)),
    refill: uniqueTargets(channelTargets(fallback)),
  };
}

function buildCategorySearchTargets(category = {}) {
  const queries = [category.tag, ...(category.core || []), ...(category.expanded || []), ...(category.fallbackOnly || [])]
    .map(query => String(query || '').trim())
    .filter(Boolean);

  return uniqueTargets(
    queries.map(query => ({
      query,
      type: 'search',
    })),
  );
}

function parseChannelFeedEntries(xml = '') {
  const $ = loadCheerio(xml, { xmlMode: true });

  return $('entry')
    .map((_, entry) => {
      const $entry = $(entry);
      const videoId = $entry.find('yt\\:videoId').first().text().trim() || $entry.find('videoId').first().text().trim();
      const title = $entry.find('title').first().text().trim();
      const publishedAt = $entry.find('published').first().text().trim();
      const thumbnail = $entry.find('media\\:thumbnail').first().attr('url') || $entry.find('thumbnail').first().attr('url') || '';
      const authorName = $entry.find('author name').first().text().trim() || '';

      return {
        videoId,
        title,
        publishedAt,
        thumbnail,
        authorName,
      };
    })
    .get()
    .filter(entry => entry.videoId);
}

function extractChannelIdFromText(text = '') {
  const patterns = [
    /"channelId":"(UC[^"]+)"/,
    /"externalId":"(UC[^"]+)"/,
    /"browseId":"(UC[^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractVideoSecondsFromText(text = '') {
  const exactMatch = String(text || '').match(/"lengthSeconds":"(\d+)"/);
  if (exactMatch?.[1]) {
    return Number(exactMatch[1]);
  }

  const durationMatch = String(text || '').match(/"approxDurationMs":"(\d+)"/);
  if (durationMatch?.[1]) {
    return Math.max(1, Math.round(Number(durationMatch[1]) / 1000));
  }

  return null;
}

function normalizeChannelBaseUrl(channelUrl = '') {
  return String(channelUrl || '').trim().replace(/\/$/, '');
}

function buildChannelVideosUrl(channel = {}) {
  if (channel.channelId) {
    return `https://www.youtube.com/channel/${channel.channelId}/videos`;
  }

  const baseUrl = normalizeChannelBaseUrl(channel.channelUrl);
  if (baseUrl) {
    return `${baseUrl}/videos`;
  }

  return '';
}

async function fetchTextWithRetry(url, context = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_TIMES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return {
        ok: true,
        result: await response.text(),
      };
    } catch (error) {
      lastError = error;
      const transient = isTransientCrawlError(error);
      logCrawl('crawl_target_attempt_failed', {
        ...context,
        attempt,
        maxAttempts: RETRY_TIMES,
        transient,
        retrying: transient && attempt < RETRY_TIMES,
        error: serializeError(error),
      });

      if (transient && attempt < RETRY_TIMES) {
        await wait(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    error: lastError || new Error('Unknown crawl error'),
  };
}

async function resolveChannelIdentity(channel, context = {}) {
  const cacheKey = getChannelKey(channel);
  if (channelIdentityCache.has(cacheKey)) {
    return channelIdentityCache.get(cacheKey);
  }

  if (channel.channelId) {
    const resolved = { ...channel, resolvedChannelId: channel.channelId };
    channelIdentityCache.set(cacheKey, resolved);
    return resolved;
  }

  const pageUrl = buildChannelVideosUrl(channel);
  if (!pageUrl) {
    return null;
  }

  const pageResult = await fetchTextWithRetry(pageUrl, {
    ...context,
    phase: 'resolve-channel-id',
    pageUrl,
  });

  if (!pageResult.ok) {
    return null;
  }

  const resolvedChannelId = extractChannelIdFromText(pageResult.result);
  if (!resolvedChannelId) {
    return null;
  }

  const resolved = {
    ...channel,
    channelId: resolvedChannelId,
    channelUrl: channel.channelUrl || pageUrl.replace(/\/videos$/, ''),
    resolvedChannelId,
  };

  channelIdentityCache.set(cacheKey, resolved);
  return resolved;
}

async function fetchChannelCandidates(channel, context = {}) {
  const resolvedChannel = await resolveChannelIdentity(channel, context);
  if (!resolvedChannel) {
    return { ok: false, error: new Error(`Unable to resolve channel identity for ${channel.slug || channel.displayName || 'unknown channel'}`) };
  }

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(resolvedChannel.channelId)}`;
  const feedResult = await fetchTextWithRetry(feedUrl, {
    ...context,
    phase: 'channel-feed',
    feedUrl,
  });

  if (!feedResult.ok) {
    return feedResult;
  }

  const entries = parseChannelFeedEntries(feedResult.result).slice(0, CHANNEL_FEED_ENTRY_LIMIT);
  const videos = [];

  for (const entry of entries) {
    if (videos.length >= CHANNEL_VIDEO_DETAIL_LIMIT) {
      break;
    }

    const entryTitle = entry.title || '';
    if (isBadVideoTitle(entryTitle.toLowerCase())) {
      continue;
    }

    const videoPageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(entry.videoId)}&hl=en&bpctr=9999999999`;
    const videoPageResult = await fetchTextWithRetry(videoPageUrl, {
      ...context,
      phase: 'video-page',
      videoId: entry.videoId,
    });

    if (!videoPageResult.ok) {
      continue;
    }

    const seconds = extractVideoSecondsFromText(videoPageResult.result);
    if (!seconds) {
      continue;
    }

    videos.push({
      videoId: entry.videoId,
      title: entry.title,
      seconds,
      author: { name: entry.authorName || resolvedChannel.displayName || 'channel' },
      thumbnail: entry.thumbnail,
      views: null,
      publishedAt: entry.publishedAt,
      channelId: resolvedChannel.channelId,
      channelSlug: resolvedChannel.slug,
    });
  }

  return {
    ok: true,
    result: {
      channel: resolvedChannel,
      videos,
    },
  };
}

function buildYouTubeSearchUrl(query = '') {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&bpctr=9999999999`;
}

function extractBalancedJson(text = '', startIndex = 0) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;
  let start = -1;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (!started) {
      if (char === '{') {
        started = true;
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function getRendererText(value = '') {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value && typeof value === 'object') {
    if (typeof value.simpleText === 'string') {
      return value.simpleText.trim();
    }

    if (Array.isArray(value.runs)) {
      return value.runs.map(run => run?.text || '').join('').trim();
    }
  }

  return '';
}

function parseDurationText(value = '') {
  const text = getRendererText(value);
  if (!text) {
    return null;
  }

  const parts = text.split(':').map(part => Number(part));
  if (parts.some(part => !Number.isFinite(part))) {
    return null;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseViewsText(value = '') {
  const text = getRendererText(value).toLowerCase();
  if (!text) {
    return null;
  }

  const normalized = text.replace(/,/g, '');
  const match = normalized.match(/([\d.]+)\s*([km]?)\s*views?/i);
  if (!match?.[1]) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const multiplier = match[2]?.toLowerCase() === 'm' ? 1_000_000 : match[2]?.toLowerCase() === 'k' ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

function extractYouTubeSearchData(html = '') {
  const $ = loadCheerio(html);
  const scriptTexts = $('script')
    .map((_, script) => $(script).text())
    .get();

  for (const scriptText of scriptTexts) {
    const markerIndex = scriptText.indexOf('ytInitialData');
    if (markerIndex === -1) {
      continue;
    }

    const jsonStart = scriptText.indexOf('{', markerIndex);
    if (jsonStart === -1) {
      continue;
    }

    const jsonText = extractBalancedJson(scriptText, jsonStart);
    if (!jsonText) {
      continue;
    }

    try {
      return JSON.parse(jsonText);
    } catch {
      continue;
    }
  }

  return null;
}

function collectVideoRenderers(node, videos = [], seen = new Set()) {
  if (!node || typeof node !== 'object') {
    return videos;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectVideoRenderers(item, videos, seen);
    }

    return videos;
  }

  if (node.videoRenderer && typeof node.videoRenderer === 'object') {
    const renderer = node.videoRenderer;
    const videoId = renderer.videoId || '';
    if (videoId && !seen.has(videoId)) {
      seen.add(videoId);
      videos.push(renderer);
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      collectVideoRenderers(value, videos, seen);
    }
  }

  return videos;
}

function parseSearchRenderer(renderer = {}) {
  const videoId = String(renderer.videoId || '').trim();
  if (!videoId) {
    return null;
  }

  const title = getRendererText(renderer.title);
  const authorName = getRendererText(renderer.ownerText);
  const thumbnail = Array.isArray(renderer.thumbnail?.thumbnails) ? renderer.thumbnail.thumbnails.at(-1)?.url || '' : '';
  const seconds = parseDurationText(renderer.lengthText);
  if (!seconds) {
    return null;
  }

  return {
    videoId,
    title,
    seconds,
    author: { name: authorName || 'search' },
    thumbnail,
    views: parseViewsText(renderer.viewCountText),
    publishedAt: getRendererText(renderer.publishedTimeText) || null,
  };
}

async function fetchSearchCandidates(query, context = {}) {
  const searchUrl = buildYouTubeSearchUrl(query);
  const pageResult = await fetchTextWithRetry(searchUrl, {
    ...context,
    phase: 'search-page',
    searchUrl,
  });

  if (pageResult.ok) {
    const initialData = extractYouTubeSearchData(pageResult.result);
    const renderers = collectVideoRenderers(initialData || {}).slice(0, SEARCH_RESULT_LIMIT);
    const videos = renderers.map(parseSearchRenderer).filter(Boolean);

    if (videos.length > 0) {
      return {
        ok: true,
        result: {
          query,
          videos,
        },
      };
    }
  }

  let lastError = pageResult.ok ? null : pageResult.error;

  for (let attempt = 1; attempt <= RETRY_TIMES; attempt += 1) {
    try {
      const result = await ytSearch(query);
      const videos = Array.isArray(result?.videos) ? result.videos.slice(0, SEARCH_RESULT_LIMIT).map(video => ({
        videoId: video.videoId,
        title: video.title,
        seconds: video.seconds,
        author: video.author,
        thumbnail: video.thumbnail || video.image || '',
        views: video.views ?? null,
        publishedAt: video.ago || video.timestamp || null,
      })) : [];

      if (videos.length > 0) {
        return {
          ok: true,
          result: {
            query,
            videos,
          },
        };
      }
    } catch (error) {
      lastError = error;
      const transient = isTransientCrawlError(error);
      logCrawl('crawl_target_attempt_failed', {
        ...context,
        attempt,
        maxAttempts: RETRY_TIMES,
        transient,
        retrying: transient && attempt < RETRY_TIMES,
        error: serializeError(error),
      });

      if (transient && attempt < RETRY_TIMES) {
        await wait(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      break;
    }
  }

  return {
    ok: false,
    error: lastError || new Error('Unknown search crawl error'),
  };
}

async function getChannelCandidates(channel, context = {}) {
  const cacheKey = getChannelKey(channel);
  if (channelCandidateCache.has(cacheKey)) {
    return channelCandidateCache.get(cacheKey);
  }

  const result = await fetchChannelCandidates(channel, context);
  const cached = result.ok ? result.result : { channel, videos: [], error: result.error };
  channelCandidateCache.set(cacheKey, cached);
  return cached;
}
function normalizeSeriesKey(title = '') {
  return title
    .toLowerCase()
    .replace(EPISODE_REGEX, '')
    .replace(/\b(full|tr\u1ecdn b\u1ed9|vietsub|thuy\u1ebft minh|review)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesBadVideoTitleKeyword(title = '', keyword = '') {
  const normalizedTitle = normalizeText(title);
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedTitle || !normalizedKeyword) {
    return false;
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}(?=$|[^a-z0-9])`);
  return pattern.test(normalizedTitle);
}

function findBadVideoTitleKeyword(title = '') {
  const badWords = [
    '#marriage', 'tiktok', 'remix', 'music video', 'karaoke',
    'h\u00e0n qu\u1ed1c', 'nh\u1ea1c', 'live stream', 'vlog', 'podcast',
    'kpop', 'k-pop', 'drama h\u00e0n', 'phim h\u00e0n', '#remembering', '#humor',
    '#xuhuongyoutube', '#mukbang', 'shorts', 'trailer', 'teaser',
    'reaction', 'highlight', 'clip ng\u1eafn', 'tin hot', 'news',
    'g\u1ea5u tr\u00fac', 'panda', 't\u1ea5u h\u00e0i', 'gau hai',
  ];

  return badWords.find(word => matchesBadVideoTitleKeyword(title, word)) || '';
}

function isBadVideoTitle(title = '') {
  return Boolean(findBadVideoTitleKeyword(title));
}

function explainVideoDecision(video, targetType, trustedAuthorWords) {
  if (!video?.videoId) {
    return { keep: false, reason: 'missing videoId' };
  }

  if (!video.seconds) {
    return { keep: false, reason: 'missing duration' };
  }

  if (video.seconds < MIN_VIDEO_SECONDS) {
    return { keep: false, reason: `too short (${video.seconds}s < ${MIN_VIDEO_SECONDS}s)` };
  }

  const title = (video.title || '').toLowerCase();
  const blockedTitleKeyword = findBadVideoTitleKeyword(title);

  if (blockedTitleKeyword) {
    return { keep: false, reason: `blocked by low-quality title keyword (${blockedTitleKeyword})` };
  }

  const authorName = (video.author?.name || '').toLowerCase();
  if (targetType === 'keyword' && authorName) {
    const trusted = trustedAuthorWords.some(word => authorName.includes(word));
    if (!trusted) {
      return { keep: false, reason: `keyword target author not trusted (${authorName})` };
    }
  }

  return { keep: true, reason: 'accepted' };
}

function normalizeVideoData(video, category) {
  const title = (video.title || '').toLowerCase();
  const episodeMatch = title.match(EPISODE_REGEX);
  const episodeNumber = episodeMatch ? Number(episodeMatch[2]) : null;
  const type = episodeNumber ? 'series' : 'full';
  const episodeLabel = episodeNumber ? `T\u1eadp ${episodeNumber}` : 'Full';

  return {
    id: video.videoId,
    title: video.title,
    episodes: episodeLabel,
    episodeLabel,
    episodeNumber,
    type,
    seriesKey: type === 'series' ? normalizeSeriesKey(video.title) : '',
    views: video.views
      ? (video.views > 1000000 ? `${(video.views / 1000000).toFixed(1)}M views` : `${Math.floor(video.views / 1000)}K views`)
      : '?? views',
    thumbnail: video.thumbnail,
    tags: category?.tag || 'Kh\u00e1c',
    categorySlug: category?.slug || 'khac',
    rating: 'N/A',
  };
}

function explainThumbnailDecision(movie = {}) {
  if (!hasRenderableThumbnail(movie)) {
    return { keep: false, reason: 'invalid thumbnail' };
  }

  return { keep: true, reason: 'accepted' };
}

export async function runCrawl({ dryRun = false, syncSnapshot = true } = {}) {
  const runStartedAt = timestamp();
  const runDay = runStartedAt.slice(0, 10);
  const registry = await loadChannelRegistry();
  const enabledChannels = registry
    .filter(channel => channel?.enabled !== false)
    .sort((left, right) => (left.priority - right.priority) || String(left.slug).localeCompare(String(right.slug)));

  const categoryPlans = CATEGORY_TAXONOMY.map(category => {
    const channelTargetsByCategory = buildCategoryChannelTargets(category.slug, enabledChannels);
    const searchTargetsByCategory = buildCategorySearchTargets(category);
    const categoryDefinition = getCategoryDefinitionBySlug(category.slug) || category;
    return {
      slug: categoryDefinition.slug,
      tag: categoryDefinition.tag,
      reason: `crawl registry-backed channels for ${categoryDefinition.tag} first, then controlled fallback channels if needed`,
      initialTargets: channelTargetsByCategory.initial,
      refillTargets: channelTargetsByCategory.refill,
      searchTargets: SEARCH_BACKFILL_ENABLED ? searchTargetsByCategory : [],
      batchLimit: CATEGORY_BATCH_LIMIT,
      category: categoryDefinition,
    };
  });

  logCrawl('crawl_run_started', {
    runStartedAt,
    runDay,
    dryRun,
    batchLimitPerCategory: CATEGORY_BATCH_LIMIT,
    categories: categoryPlans.map(plan => ({ slug: plan.slug, tag: plan.tag, initialSources: plan.initialTargets.length, fallbackSources: plan.refillTargets.length, searchSources: plan.searchTargets.length, searchBackfillEnabled: SEARCH_BACKFILL_ENABLED })),
    registrySources: enabledChannels.length,
    searchBackfillEnabled: SEARCH_BACKFILL_ENABLED,
  });

  const oldData = await readMoviesFromJsonFile();
  logCrawl('crawl_existing_catalog_loaded', { existingVideos: oldData.length, source: 'json' });

  const existingIds = new Set(oldData.map(video => video.id));
  const runNewIds = new Set();
  const newVideos = [];
  const categorySummaries = [];
  const touchedChannelSlugs = new Set();

  const crawlCategoryTargets = async (plan) => {
    const { tag, slug, initialTargets, refillTargets = [], searchTargets = [], reason } = plan;
    const keptVideos = [];
    let targetErrors = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;
    const triedQueries = new Set();
    const targetQuota = CATEGORY_BATCH_LIMIT;
    const categoryRejectReasons = {};
    const categoryDuplicateReasons = {};
    const categoryErrorReasons = {};
    const targetSummaries = [];
    const waveSummaries = [];
    const waves = [
      { name: 'initial', reason, targets: initialTargets },
      ...(refillTargets.length > 0 ? [{ name: 'refill', reason: 'controlled backfill from the remaining registry channels', targets: refillTargets }] : []),
      ...(searchTargets.length > 0 ? [{ name: 'search-backfill', reason: 'taxonomy-driven search fallback for remaining deficit', targets: searchTargets }] : []),
    ];

    logCrawl('crawl_category_started', {
      runDay,
      category: tag,
      slug,
      batchLimit: targetQuota,
      reason,
      targets: initialTargets.map(target => target.query),
      refillTargets: refillTargets.map(target => target.query),
      searchTargets: searchTargets.map(target => target.query),
    });

    for (const wave of waves) {
      if (keptVideos.length >= targetQuota) {
        break;
      }

      const deficitBeforeWave = targetQuota - keptVideos.length;
      const waveSummary = {
        runDay,
        category: tag,
        slug,
        wave: wave.name,
        reason: wave.reason,
        target: targetQuota,
        startKept: keptVideos.length,
        endKept: keptVideos.length,
        deficitBefore: deficitBeforeWave,
        deficitAfter: deficitBeforeWave,
        targets: 0,
        kept: 0,
        rejected: 0,
        duplicates: 0,
        errors: 0,
      };

      logCrawl('crawl_category_wave_started', {
        runDay,
        category: tag,
        slug,
        wave: wave.name,
        reason: wave.reason,
        target: targetQuota,
        kept: keptVideos.length,
        deficit: deficitBeforeWave,
        targets: wave.targets.map(target => target.query),
      });

      for (const target of wave.targets) {
        if (keptVideos.length >= targetQuota) {
          logCrawl('crawl_category_batch_limit_reached', { runDay, category: tag, slug, kept: keptVideos.length, batchLimit: targetQuota });
          break;
        }

        const targetKey = `${target.type || 'channel'}:${target.query || getChannelKey(target.channel)}`;
        const targetSummary = createTargetRunStats({
          runDay,
          category: tag,
          slug,
          query: target.query,
          type: target.type,
          wave: wave.name,
          channelSlug: target.channel?.slug || null,
        });

        if (triedQueries.has(targetKey)) {
          targetSummary.status = 'skipped';
          targetSummary.error = { reason: 'already tried in a prior wave' };
          targetSummaries.push(targetSummary);
          waveSummary.targets += 1;

          logCrawl('crawl_category_target_skipped', {
            runDay,
            category: tag,
            slug,
            query: target.query,
            type: target.type,
            reason: 'already tried in a prior wave',
          });
          continue;
        }

        triedQueries.add(targetKey);

        logCrawl('crawl_category_target_start', {
          runDay,
          category: tag,
          slug,
          query: target.query,
          type: target.type,
          wave: wave.name,
          channelSlug: target.channel?.slug || null,
        });

        waveSummary.targets += 1;

        try {
          const discovery = target.type === 'search'
            ? await fetchSearchCandidates(target.query, { category: tag, slug, query: target.query, type: target.type, wave: wave.name, runDay })
            : await getChannelCandidates(target.channel, { category: tag, slug, query: target.query, type: target.type, wave: wave.name, runDay });

          if (!discovery || !Array.isArray(discovery.videos)) {
            targetErrors += 1;
            waveSummary.errors += 1;
            targetSummary.errors += 1;
            targetSummary.status = 'error';
            targetSummary.error = serializeError(discovery?.error);
            incrementCountMap(categoryErrorReasons, discovery?.error?.name || discovery?.error?.type || 'target failed after retries');
            targetSummaries.push(targetSummary);
            logCrawl('crawl_category_target_skipped', {
              runDay,
              category: tag,
              slug,
              query: target.query,
              type: target.type,
              wave: wave.name,
              reason: 'target failed after retries',
              error: serializeError(discovery?.error),
            });
            continue;
          }

          const candidates = discovery.videos;
          targetSummary.candidates = candidates.length;

          if (!dryRun && target.channel?.slug && !touchedChannelSlugs.has(target.channel.slug)) {
            try {
              await updateChannelRegistryEntry(target.channel.slug, {
                channelId: discovery.channel?.channelId || target.channel.channelId || null,
                channelUrl: discovery.channel?.channelUrl || target.channel.channelUrl || null,
                lastCrawledAt: timestamp(),
              });
              touchedChannelSlugs.add(target.channel.slug);
            } catch (error) {
              logCrawl('crawl_channel_registry_update_failed', {
                runDay,
                category: tag,
                slug,
                channelSlug: target.channel.slug,
                error: serializeError(error),
              });
            }
          }

          if (candidates.length === 0) {
            targetSummary.status = 'empty';
            targetSummaries.push(targetSummary);
            logCrawl('crawl_category_target_empty', { runDay, category: tag, slug, query: target.query, wave: wave.name, channelSlug: target.channel?.slug || null });
            continue;
          }

          let keptCount = 0;
          let targetRejectedCount = 0;

          for (const video of candidates) {
            if (keptVideos.length >= targetQuota) {
              break;
            }

            const qualityDecision = explainVideoDecision(video, target.type, CATEGORY_TRUSTED_AUTHOR_WORDS);
            const videoLabel = video?.title || video?.videoId || 'khong ro tieu de';

            if (!qualityDecision.keep) {
              rejectedCount += 1;
              targetRejectedCount += 1;
              waveSummary.rejected += 1;
              targetSummary.rejected += 1;
              incrementCountMap(categoryRejectReasons, qualityDecision.reason);
              incrementCountMap(targetSummary.rejectReasons, qualityDecision.reason);
              logCrawl('  - reject', {
                runDay,
                category: tag,
                slug,
                query: target.query,
                wave: wave.name,
                title: videoLabel,
                seconds: video?.seconds ?? null,
                author: video?.author?.name ?? null,
                reason: qualityDecision.reason,
              });
              continue;
            }

            const thumbnailDecision = explainThumbnailDecision({ id: video.videoId, thumbnail: video.thumbnail });
            if (!thumbnailDecision.keep) {
              rejectedCount += 1;
              targetRejectedCount += 1;
              waveSummary.rejected += 1;
              targetSummary.rejected += 1;
              incrementCountMap(categoryRejectReasons, thumbnailDecision.reason);
              incrementCountMap(targetSummary.rejectReasons, thumbnailDecision.reason);
              logCrawl('  - reject', {
                runDay,
                category: tag,
                slug,
                query: target.query,
                wave: wave.name,
                title: videoLabel,
                thumbnail: video?.thumbnail ?? null,
                reason: thumbnailDecision.reason,
              });
              continue;
            }

            const resolvedCategory = resolveMovieCategory(video);
            if (resolvedCategory.slug !== slug) {
              rejectedCount += 1;
              targetRejectedCount += 1;
              waveSummary.rejected += 1;
              targetSummary.rejected += 1;
              incrementCountMap(categoryRejectReasons, `resolved to ${resolvedCategory.tag}`);
              incrementCountMap(targetSummary.rejectReasons, `resolved to ${resolvedCategory.tag}`);
              logCrawl('  - reject', {
                runDay,
                category: tag,
                slug,
                query: target.query,
                wave: wave.name,
                title: videoLabel,
                resolvedCategory: resolvedCategory.tag,
                reason: `resolved to ${resolvedCategory.tag}`,
              });
              continue;
            }

            if (existingIds.has(video.videoId) || runNewIds.has(video.videoId)) {
              duplicateCount += 1;
              waveSummary.duplicates += 1;
              targetSummary.duplicates += 1;
              incrementCountMap(categoryDuplicateReasons, existingIds.has(video.videoId) ? 'already in catalog' : 'already selected in this run');
              incrementCountMap(targetSummary.duplicateReasons, existingIds.has(video.videoId) ? 'already in catalog' : 'already selected in this run');
              logCrawl('  - skip duplicate', {
                runDay,
                category: tag,
                slug,
                query: target.query,
                wave: wave.name,
                title: videoLabel,
                reason: existingIds.has(video.videoId) ? 'already in catalog' : 'already selected in this run',
              });
              continue;
            }

            const normalized = normalizeVideoData(video, resolvedCategory);
            runNewIds.add(video.videoId);
            keptVideos.push(normalized);
            newVideos.push(normalized);
            keptCount += 1;
            waveSummary.kept += 1;
            targetSummary.kept += 1;

            logCrawl('  + keep', {
              runDay,
              category: tag,
              slug,
              query: target.query,
              wave: wave.name,
              title: normalized.title,
              seconds: video?.seconds ?? null,
              author: video?.author?.name ?? null,
              keptForCategory: keptVideos.length,
              batchLimit: targetQuota,
            });
          }

          targetSummary.status = 'completed';
          logCrawl('crawl_category_target_summary', {
            runDay,
            category: tag,
            slug,
            query: target.query,
            wave: wave.name,
            channelSlug: target.channel?.slug || null,
            kept: keptCount,
            rejected: targetRejectedCount,
            duplicates: targetSummary.duplicates,
            errors: targetSummary.errors,
            candidates: candidates.length,
            rejectReasons: sortCountMap(targetSummary.rejectReasons),
            duplicateReasons: sortCountMap(targetSummary.duplicateReasons),
          });
          targetSummaries.push(targetSummary);
        } catch (error) {
          targetErrors += 1;
          waveSummary.errors += 1;
          targetSummary.errors += 1;
          targetSummary.status = 'error';
          targetSummary.error = serializeError(error);
          incrementCountMap(categoryErrorReasons, error?.name || error?.code || 'target error');
          targetSummaries.push(targetSummary);
          logCrawl('crawl_category_target_error', {
            runDay,
            category: tag,
            slug,
            query: target.query,
            type: target.type,
            wave: wave.name,
            error: serializeError(error),
          });
        }
      }

      waveSummary.endKept = keptVideos.length;
      waveSummary.deficitAfter = Math.max(0, targetQuota - keptVideos.length);
      waveSummaries.push(waveSummary);

      if (keptVideos.length < targetQuota) {
        logCrawl('crawl_category_refill_needed', {
          runDay,
          category: tag,
          slug,
          wave: wave.name,
          target: targetQuota,
          kept: keptVideos.length,
          deficit: targetQuota - keptVideos.length,
        });
      }

      logCrawl('crawl_category_wave_summary', waveSummary);
    }

    if (keptVideos.length < targetQuota) {
      logCrawl('crawl_category_underfilled', {
        runDay,
        category: tag,
        slug,
        target: targetQuota,
        kept: keptVideos.length,
        deficit: targetQuota - keptVideos.length,
        triedQueries: triedQueries.size,
      });
    }

    const summary = {
      runDay,
      category: tag,
      slug,
      target: targetQuota,
      batchLimit: targetQuota,
      kept: keptVideos.length,
      deficit: Math.max(0, targetQuota - keptVideos.length),
      added: keptVideos.length,
      duplicates: duplicateCount,
      rejected: rejectedCount,
      errors: targetErrors,
      rejectReasons: sortCountMap(categoryRejectReasons),
      duplicateReasons: sortCountMap(categoryDuplicateReasons),
      errorReasons: sortCountMap(categoryErrorReasons),
      waves: waveSummaries,
      targets: targetSummaries,
    };

    categorySummaries.push(summary);
    logCrawl('crawl_category_summary', summary);
    return keptVideos;
  };

  for (const plan of categoryPlans) {
    const categoryVideos = await crawlCategoryTargets(plan);
    logCrawl('crawl_category_batch_result', {
      runDay,
      category: plan.tag,
      slug: plan.slug,
      added: categoryVideos.length,
      totalNewSoFar: newVideos.length,
    });
  }

  const keptOldVideos = oldData.filter(video => {
    const fakeVideoLike = {
      videoId: video.id,
      title: video.title || '',
      seconds: video.type === 'full' ? MIN_VIDEO_SECONDS : MIN_VIDEO_SECONDS + 1,
      author: { name: 'trusted old data' },
    };
    return explainVideoDecision(fakeVideoLike, 'channel', CATEGORY_TRUSTED_AUTHOR_WORDS).keep && hasRenderableThumbnail(video);
  }).map(video => normalizeMovieCategory(video));

  const finalData = [...newVideos, ...keptOldVideos]
    .slice(0, MAX_STORED_VIDEOS)
    .map(video => normalizeMovieCategory(video));

  const runSummary = {
    runStartedAt,
    runDay,
    dryRun,
    snapshotSyncEnabled: syncSnapshot,
    existingVideos: oldData.length,
    existingKept: keptOldVideos.length,
    newVideos: newVideos.length,
    totalFetched: newVideos.length,
    totalVideos: finalData.length,
    categoryCount: categorySummaries.length,
    totals: summarizeCategoryResults(categorySummaries),
    categorySummaries,
  };

  logCrawl('crawl_run_summary', runSummary);

  if (dryRun) {
    const finishedAt = timestamp();
    logCrawl('crawl_run_finished', { ...runSummary, finishedAt, persistedTo: 'dry-run' });
    return {
      runStartedAt,
      runDay,
      finishedAt,
      totalVideos: finalData.length,
      newVideos: newVideos.length,
      fetchedCount: newVideos.length,
      categorySummaries,
      dryRun: true,
      persistedTo: 'dry-run',
      summary: { ...runSummary, finishedAt, persistedTo: 'dry-run' },
    };
  }

  try {
    const persisted = await replacePersistedMovies(finalData, {
      startedAt: runStartedAt,
      finishedAt: timestamp(),
      status: 'completed',
      keptCount: finalData.length,
      fetchedCount: newVideos.length,
      source: 'scripts/crawl.mjs',
      syncSnapshot,
      metadata: { mode: 'category-batches', dryRun: false, runDay, summary: runSummary },
    });

    const finishedAt = timestamp();
    logCrawl('crawl_run_finished', { ...runSummary, finishedAt, persistedTo: 'postgres', crawlRunId: persisted.crawlRunId });

    return {
      runStartedAt,
      runDay,
      finishedAt,
      totalVideos: finalData.length,
      newVideos: newVideos.length,
      fetchedCount: newVideos.length,
      categorySummaries,
      dryRun: false,
      persistedTo: 'postgres',
      crawlRunId: persisted.crawlRunId,
      summary: { ...runSummary, finishedAt, persistedTo: 'postgres', crawlRunId: persisted.crawlRunId },
    };
  } catch (error) {
    console.error(`[${timestamp()}] crawl_persist_failed ${JSON.stringify({
      runStartedAt,
      totalVideos: finalData.length,
      summary: runSummary,
      error: serializeError(error),
    })}`);

    const finishedAt = timestamp();
    logCrawl('crawl_run_finished', { ...runSummary, finishedAt, persistedTo: 'json-fallback' });

    return {
      runStartedAt,
      runDay,
      finishedAt,
      totalVideos: finalData.length,
      newVideos: newVideos.length,
      fetchedCount: newVideos.length,
      categorySummaries,
      dryRun: false,
      persistedTo: 'json-fallback',
      persistenceError: serializeError(error),
      summary: { ...runSummary, finishedAt, persistedTo: 'json-fallback' },
    };
  }
}
