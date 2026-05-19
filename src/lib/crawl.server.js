import { load as loadCheerio } from 'cheerio';
import { buildChannelQualityUpdate, loadChannelRegistry, readMoviesFromJsonFile, recordChannelSuggestion, replacePersistedMovies, updateChannelRegistryEntry } from './movieStore.server.js';
import { CATEGORY_TAXONOMY, getCategoryDefinitionBySlug, normalizeMovieCategory, normalizeText, resolveMovieCategory } from './movieCategories.js';
import { cleanSnapshotMovies } from './movieSnapshot.server.js';
import { hasRenderableThumbnail } from './thumbnailFilters.js';
import { explainWatchPageAvailability, extractWatchPagePlayerResponse } from './watchPageAvailability.server.js';

const EPISODE_REGEX = /(t\u1eadp|tap|episode|ep\.?|ph\u1ea7n)\s*(\d{1,4})/i;
const EPISODE_RANGE_REGEX = /(?:\b(?:ep|episode|tap|t\u1eadp|phan|ph\u1ea7n)\s*[\[(]?\s*\d{1,4}\s*(?:[-–—]|to|\u0111\u1ebfn|den|\/)\s*\d{1,4}\b|\[\s*ep\s*\d{1,4}\s*[-–—]\s*\d{1,4}\s*\])/i;
const MIN_VIDEO_DURATION_SECONDS = 2400;
const MAX_STORED_VIDEOS = 1000;
const CHANNEL_FEED_ENTRY_LIMIT = 20;
const RETRY_TIMES = 3;
const RETRY_BASE_DELAY_MS = 250;
const CRAWL_STRICT_MODE = true;
const STRICT_MAX_VIDEO_AGE_DAYS = 45;
const STRICT_MAX_VIDEO_AGE_MS = STRICT_MAX_VIDEO_AGE_DAYS * 24 * 60 * 60 * 1000;
const STRICT_BAD_CONTENT_KEYWORDS = [
  'audio',
  'clip',
  'clip ngan',
  'lyrics',
  'lyric',
  'ost',
  'soundtrack',
  'review',
  'reaction',
  'recap',
  'summary',
  'tom tat',
  'tóm tắt',
  'shorts',
  'trailer',
  'teaser',
  'vlog',
  'podcast',
  'news',
  'tin hot',
  'music video',
  'karaoke',
  'nhac',
  'nhac phim',
  'nhac karaoke',
  'nhạc',
  'nhạc phim',
  'nhạc karaoke',
];
const DISCOVERY_BRAND_KEYWORDS = ['ha nhan', 'hanhan', 'tu tien', 'xuyen khong', 'trong sinh', 'lieu nhu yen', 'he thong'];

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

function findStrictBadContentKeyword(value = '') {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return '';
  }

  return STRICT_BAD_CONTENT_KEYWORDS.find(keyword => normalizedValue.includes(normalizeText(keyword))) || '';
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

function sortChannelsForCrawl(left, right) {
  const leftTrustedBrand = left?.trustedBrand === true;
  const rightTrustedBrand = right?.trustedBrand === true;

  if (leftTrustedBrand !== rightTrustedBrand) {
    return leftTrustedBrand ? -1 : 1;
  }

  const leftBlocked = left?.blocked === true;
  const rightBlocked = right?.blocked === true;

  if (leftBlocked !== rightBlocked) {
    return leftBlocked ? 1 : -1;
  }

  const leftAllowed = left?.allowed !== false;
  const rightAllowed = right?.allowed !== false;

  if (leftAllowed !== rightAllowed) {
    return leftAllowed ? -1 : 1;
  }

  const leftScore = Number.isFinite(left?.qualityScore) ? left.qualityScore : 0;
  const rightScore = Number.isFinite(right?.qualityScore) ? right.qualityScore : 0;

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  const leftLastGood = left?.lastGoodHit ? Date.parse(left.lastGoodHit) : 0;
  const rightLastGood = right?.lastGoodHit ? Date.parse(right.lastGoodHit) : 0;

  if (leftLastGood !== rightLastGood) {
    return rightLastGood - leftLastGood;
  }

  return (left?.priority || 0) - (right?.priority || 0) || String(left?.slug || '').localeCompare(String(right?.slug || ''));
}

function isCrawlableChannel(channel = {}) {
  return channel?.enabled !== false && channel?.allowed !== false && channel?.blocked !== true;
}

function explainSourceDecision(channel = {}, strictMode = CRAWL_STRICT_MODE) {
  if (!strictMode) {
    return { keep: true, reason: 'accepted' };
  }

  if (channel?.trustedBrand === true) {
    return { keep: true, reason: 'trusted brand' };
  }

  const sourceText = [channel.displayName, channel.slug, channel.channelUrl].filter(Boolean).join(' ');
  const blockedKeyword = findStrictBadContentKeyword(sourceText);
  if (blockedKeyword) {
    return { keep: false, reason: `blocked by strict source keyword (${blockedKeyword})` };
  }

  return { keep: true, reason: 'accepted' };
}

function extractDiscoveryHints(video = {}) {
  const hints = new Set();
  const authorName = String(video.author?.name || '').trim();
  const title = String(video.title || '').trim();

  if (authorName) {
    hints.add(authorName);
  }

  const trustedMatch = title.match(/(?:\||-|–|—)\s*([^|\-–—]{3,80})\s*$/);
  const tailSegment = trustedMatch?.[1]?.trim() || '';
  if (tailSegment && DISCOVERY_BRAND_KEYWORDS.some(keyword => normalizeText(tailSegment).includes(keyword.replace(/\s+/g, '')))) {
    hints.add(tailSegment);
  }

  return [...hints].filter(value => !findStrictBadContentKeyword(value));
}

function summarizeCategoryResults(categorySummaries = []) {
  return categorySummaries.reduce((totals, category) => {
    totals.categories += 1;
    totals.kept += category.kept || 0;
    totals.rejected += category.rejected || 0;
    totals.duplicates += category.duplicates || 0;
    totals.errors += category.errors || 0;
    if (category.floorHit) {
      totals.floorMet += 1;
    } else {
      totals.floorMissed += 1;
    }

    return totals;
  }, {
    categories: 0,
    kept: 0,
    rejected: 0,
    duplicates: 0,
    errors: 0,
    floorMet: 0,
    floorMissed: 0,
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

const CATEGORY_MIN_NEW_MOVIES_PER_DAY = 10;
const CATEGORY_BATCH_LIMIT = 20;
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
  const enabledChannels = channels.filter(isCrawlableChannel).sort(sortChannelsForCrawl);
  const primary = enabledChannels.filter(channel => channel.category === categorySlug || channel.category === 'shared');
  const fallback = enabledChannels.filter(channel => channel.category !== categorySlug && channel.category !== 'shared');

  return {
    initial: uniqueTargets(channelTargets(primary)),
    refill: uniqueTargets(channelTargets(fallback)),
  };
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

function normalizeChannelBaseUrl(channelUrl = '') {
  return String(channelUrl || '').trim().replace(/\/$/, '');
}

function extractChannelIdFromChannelUrl(channelUrl = '') {
  const normalizedUrl = normalizeChannelBaseUrl(channelUrl);
  if (!normalizedUrl) {
    return null;
  }

  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]+)/i,
    /[?&]channel_id=(UC[\w-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
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

async function resolveChannelIdentity(channel) {
  const cacheKey = getChannelKey(channel);
  if (channelIdentityCache.has(cacheKey)) {
    return channelIdentityCache.get(cacheKey);
  }

  if (channel.channelId) {
    const resolved = { ...channel, resolvedChannelId: channel.channelId };
    channelIdentityCache.set(cacheKey, resolved);
    return resolved;
  }

  const channelIdFromUrl = extractChannelIdFromChannelUrl(channel.channelUrl);
  if (!channelIdFromUrl) {
    return null;
  }

  const resolved = {
    ...channel,
    channelId: channelIdFromUrl,
    channelUrl: channel.channelUrl || `https://www.youtube.com/channel/${channelIdFromUrl}`,
    resolvedChannelId: channelIdFromUrl,
  };

  channelIdentityCache.set(cacheKey, resolved);
  return resolved;
}

async function fetchChannelCandidates(channel, context = {}) {
  const resolvedChannel = await resolveChannelIdentity(channel);
  if (!resolvedChannel) {
    return { ok: false, error: new Error(`Unable to resolve feed channel identity for ${channel.slug || channel.displayName || 'unknown channel'}`) };
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
    const entryTitle = entry.title || '';
    if (isBadVideoTitle(entryTitle.toLowerCase())) {
      continue;
    }

    videos.push({
      videoId: entry.videoId,
      title: entry.title,
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

function parseDurationSeconds(value = '', { milliseconds = false } = {}) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return milliseconds ? Math.round(value / 1000) : Math.round(value);
  }

  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? (milliseconds ? Math.round(seconds / 1000) : seconds) : null;
  }

  const parsed = parseDurationText(text);
  if (parsed !== null) {
    return parsed;
  }

  return null;
}

function isPublishedAtFresh(publishedAt = '', maxAgeMs = STRICT_MAX_VIDEO_AGE_MS) {
  const timestampMs = Date.parse(String(publishedAt || '').trim());
  if (!Number.isFinite(timestampMs)) {
    return { keep: false, reason: 'missing publishedAt' };
  }

  const ageMs = Date.now() - timestampMs;
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { keep: false, reason: 'invalid publishedAt' };
  }

  if (ageMs > maxAgeMs) {
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    return { keep: false, reason: `too old for strict crawl (${ageDays}d > ${Math.floor(maxAgeMs / (24 * 60 * 60 * 1000))}d)` };
  }

  return { keep: true, reason: 'accepted' };
}

function extractWatchPageDurationSeconds(playerResponseOrHtml = '') {
  const playerResponse = typeof playerResponseOrHtml === 'string'
    ? extractWatchPagePlayerResponse(playerResponseOrHtml)
    : playerResponseOrHtml;

  if (!playerResponse) {
    return null;
  }

  const durationSources = [
    { value: playerResponse?.videoDetails?.lengthSeconds, milliseconds: false },
    { value: playerResponse?.microformat?.playerMicroformatRenderer?.lengthSeconds, milliseconds: false },
    { value: playerResponse?.videoDetails?.approxDurationMs, milliseconds: true },
    { value: playerResponse?.microformat?.playerMicroformatRenderer?.approxDurationMs, milliseconds: true },
  ];

  for (const durationSource of durationSources) {
    const seconds = parseDurationSeconds(durationSource.value, { milliseconds: durationSource.milliseconds });
    if (seconds !== null) {
      return seconds;
    }
  }

  return null;
}

async function fetchVideoDurationSeconds(videoId, context = {}) {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&gl=US`;
  const result = await fetchTextWithRetry(watchUrl, {
    ...context,
    phase: 'video-watch-page',
    watchUrl,
  });

  if (!result.ok) {
    return result;
  }

  const playerResponse = extractWatchPagePlayerResponse(result.result);
  const availabilityDecision = explainWatchPageAvailability(playerResponse);
  if (!availabilityDecision.keep) {
    return {
      ok: false,
      error: new Error(availabilityDecision.reason),
    };
  }

  const seconds = extractWatchPageDurationSeconds(playerResponse);
  if (seconds === null) {
    return {
      ok: false,
      error: new Error(`Unable to determine duration for ${videoId}`),
    };
  }

  return {
    ok: true,
    result: seconds,
  };
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
    'reaction', 'highlight', 'clip', 'clip ng\u1eafn', 'recap', 'summary', 't\u00f3m t\u1eaft', 'tom tat', 'tin hot', 'news',
    'audio', 'ost', 'soundtrack', 'lyrics', 'lyric', 'nhac phim', 'nhac karaoke', 'nh\u1ea1c phim', 'nh\u1ea1c karaoke',
    'g\u1ea5u tr\u00fac', 'panda', 't\u1ea5u h\u00e0i', 'gau hai',
  ];

  return badWords.find(word => matchesBadVideoTitleKeyword(title, word)) || '';
}

function findEpisodeTitleMarker(title = '') {
  const episodeMatch = String(title || '').match(EPISODE_REGEX);
  if (episodeMatch?.[0]) {
    return episodeMatch[0];
  }

  const episodeRangeMatch = String(title || '').match(EPISODE_RANGE_REGEX);
  if (episodeRangeMatch?.[0]) {
    return episodeRangeMatch[0];
  }

  if (/\bseries\b/i.test(String(title || ''))) {
    return 'series';
  }

  return '';
}

function isBadVideoTitle(title = '') {
  return Boolean(findBadVideoTitleKeyword(title));
}

export function explainVideoDecision(video, targetType, trustedAuthorWords, { strictMode = CRAWL_STRICT_MODE, maxAgeMs = STRICT_MAX_VIDEO_AGE_MS } = {}) {
  if (!video?.videoId) {
    return { keep: false, reason: 'missing videoId' };
  }

  const title = (video.title || '').toLowerCase();
  if (strictMode) {
    const strictBlockedTitleKeyword = findStrictBadContentKeyword(title);
    if (strictBlockedTitleKeyword) {
      return { keep: false, reason: `blocked by strict title keyword (${strictBlockedTitleKeyword})` };
    }

    const freshnessDecision = isPublishedAtFresh(video.publishedAt, maxAgeMs);
    if (!freshnessDecision.keep) {
      return { keep: false, reason: freshnessDecision.reason };
    }
  }

  const episodeMarker = findEpisodeTitleMarker(title);

  if (episodeMarker || video.type === 'series' || Number.isFinite(video.episodeNumber) || Boolean(video.seriesKey)) {
    return { keep: false, reason: `blocked by episode/series title marker (${episodeMarker || video.type || 'series'})` };
  }

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

function explainDurationDecision(durationSeconds) {
  if (durationSeconds === null || durationSeconds === undefined) {
    return { keep: false, reason: 'missing duration metadata' };
  }

  if (!Number.isFinite(durationSeconds)) {
    return { keep: false, reason: 'missing duration metadata' };
  }

  if (durationSeconds <= MIN_VIDEO_DURATION_SECONDS) {
    return { keep: false, reason: `must be strictly over ${MIN_VIDEO_DURATION_SECONDS}s (${Math.round(durationSeconds)}s)` };
  }

  return { keep: true, reason: 'accepted' };
}

function explainThumbnailDecision(movie = {}) {
  if (!hasRenderableThumbnail(movie)) {
    return { keep: false, reason: 'invalid thumbnail' };
  }

  return { keep: true, reason: 'accepted' };
}

export async function runCrawl({ dryRun = false, syncSnapshot = true, strictMode = CRAWL_STRICT_MODE } = {}) {
  const runStartedAt = timestamp();
  const runDay = runStartedAt.slice(0, 10);
  const registry = await loadChannelRegistry();
  const enabledChannels = registry
    .filter(isCrawlableChannel)
    .sort(sortChannelsForCrawl);

  const categoryPlans = CATEGORY_TAXONOMY.map(category => {
    const channelTargetsByCategory = buildCategoryChannelTargets(category.slug, enabledChannels);
    const categoryDefinition = getCategoryDefinitionBySlug(category.slug) || category;
    return {
      slug: categoryDefinition.slug,
      tag: categoryDefinition.tag,
      reason: `crawl verified registry feeds for ${categoryDefinition.tag} only and reports any deficit honestly`,
      initialTargets: channelTargetsByCategory.initial,
      refillTargets: channelTargetsByCategory.refill,
      batchLimit: CATEGORY_BATCH_LIMIT,
      category: categoryDefinition,
    };
  });

  logCrawl('crawl_run_started', {
    runStartedAt,
    runDay,
    dryRun,
    strictMode,
    strictFreshnessDays: STRICT_MAX_VIDEO_AGE_DAYS,
    batchLimitPerCategory: CATEGORY_BATCH_LIMIT,
    minimumNewMoviesPerCategory: CATEGORY_MIN_NEW_MOVIES_PER_DAY,
    categories: categoryPlans.map(plan => ({ slug: plan.slug, tag: plan.tag, minimumNewMoviesPerCategory: CATEGORY_MIN_NEW_MOVIES_PER_DAY, initialSources: plan.initialTargets.length, fallbackSources: plan.refillTargets.length })),
    registrySources: enabledChannels.length,
  });

  const oldData = await readMoviesFromJsonFile();
  logCrawl('crawl_existing_catalog_loaded', { existingVideos: oldData.length, source: 'json' });

  const existingIds = new Set(oldData.map(video => video.id));
  const runNewIds = new Set();
  const newVideos = [];
  const categorySummaries = [];
  const crawlCategoryTargets = async (plan) => {
    const { tag, slug, initialTargets, refillTargets = [], reason } = plan;
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
      ...(refillTargets.length > 0 ? [{ name: 'refill', reason: 'remaining verified registry feeds', targets: refillTargets }] : []),
    ];

    logCrawl('crawl_category_started', {
      runDay,
      category: tag,
      slug,
      batchLimit: targetQuota,
      floor: CATEGORY_MIN_NEW_MOVIES_PER_DAY,
      reason,
      targets: initialTargets.map(target => target.query),
      refillTargets: refillTargets.map(target => target.query),
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
        floor: CATEGORY_MIN_NEW_MOVIES_PER_DAY,
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

        const sourceDecision = explainSourceDecision(target.channel, strictMode);
        if (!sourceDecision.keep) {
          targetSummary.status = 'skipped';
          targetSummary.error = { reason: sourceDecision.reason };
          targetSummaries.push(targetSummary);

          logCrawl('crawl_category_target_skipped', {
            runDay,
            category: tag,
            slug,
            query: target.query,
            type: target.type,
            wave: wave.name,
            channelSlug: target.channel?.slug || null,
            reason: sourceDecision.reason,
          });
          continue;
        }

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
          const discovery = await getChannelCandidates(target.channel, { category: tag, slug, query: target.query, type: target.type, wave: wave.name, runDay });

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

          if (candidates.length === 0) {
            targetSummary.status = 'empty';
            if (!dryRun && target.channel?.slug) {
              try {
                const updatedChannel = buildChannelQualityUpdate(target.channel, {
                  at: timestamp(),
                  candidateCount: candidates.length,
                  rejectedCount: 0,
                  errorCount: 0,
                });

                const persistedChannel = await updateChannelRegistryEntry(target.channel.slug, {
                  channelId: discovery.channel?.channelId || target.channel.channelId || null,
                  channelUrl: discovery.channel?.channelUrl || target.channel.channelUrl || null,
                  lastCrawledAt: timestamp(),
                  allowed: updatedChannel.allowed,
                  blocked: updatedChannel.blocked,
                  qualityScore: updatedChannel.qualityScore,
                  lastGoodHit: updatedChannel.lastGoodHit,
                  lastBadHit: updatedChannel.lastBadHit,
                  status: updatedChannel.status,
                  enabled: updatedChannel.enabled,
                });

                if (persistedChannel) {
                  Object.assign(target.channel, persistedChannel);
                }
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

            const qualityDecision = explainVideoDecision(video, target.type, CATEGORY_TRUSTED_AUTHOR_WORDS, { strictMode, maxAgeMs: STRICT_MAX_VIDEO_AGE_MS });
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

            const durationResult = await fetchVideoDurationSeconds(video.videoId, {
              category: tag,
              slug,
              query: target.query,
              type: target.type,
              wave: wave.name,
              runDay,
            });

            if (!durationResult.ok) {
              rejectedCount += 1;
              targetRejectedCount += 1;
              waveSummary.rejected += 1;
              targetSummary.rejected += 1;
              const reason = 'missing duration metadata';
              incrementCountMap(categoryRejectReasons, reason);
              incrementCountMap(targetSummary.rejectReasons, reason);
              logCrawl('  - reject', {
                runDay,
                category: tag,
                slug,
                query: target.query,
                wave: wave.name,
                title: videoLabel,
                durationSeconds: null,
                minimumDurationSeconds: MIN_VIDEO_DURATION_SECONDS,
                durationError: serializeError(durationResult.error),
                reason,
              });
              continue;
            }

            const durationDecision = explainDurationDecision(durationResult.result);
            if (!durationDecision.keep) {
              rejectedCount += 1;
              targetRejectedCount += 1;
              waveSummary.rejected += 1;
              targetSummary.rejected += 1;
              incrementCountMap(categoryRejectReasons, durationDecision.reason);
              incrementCountMap(targetSummary.rejectReasons, durationDecision.reason);
              logCrawl('  - reject', {
                runDay,
                category: tag,
                slug,
                query: target.query,
                wave: wave.name,
                title: videoLabel,
                durationSeconds: durationResult.result,
                minimumDurationSeconds: MIN_VIDEO_DURATION_SECONDS,
                reason: durationDecision.reason,
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

            if (!dryRun && (target.channel?.trustedBrand === true || (Number.isFinite(target.channel?.qualityScore) && target.channel.qualityScore >= 5))) {
              const discoveryHints = extractDiscoveryHints(video);
              for (const hint of discoveryHints) {
                try {
                  await recordChannelSuggestion({
                    displayName: hint,
                    candidateSlug: hint,
                    sourceChannelSlug: target.channel?.slug || '',
                    sourceChannelId: target.channel?.channelId || null,
                    sourceChannelDisplayName: target.channel?.displayName || '',
                    sourceCategory: tag,
                    trustedBrandHint: target.channel?.trustedBrand === true,
                    metadata: {
                      runDay,
                      query: target.query,
                      wave: wave.name,
                      videoId: video.videoId,
                      videoTitle: normalized.title,
                      strictMode,
                    },
                  }, {
                    kept: true,
                    trustedBrandHint: target.channel?.trustedBrand === true,
                    metadata: {
                      runDay,
                      category: tag,
                      wave: wave.name,
                      sourceChannelSlug: target.channel?.slug || null,
                    },
                  });
                } catch (error) {
                  logCrawl('crawl_channel_suggestion_failed', {
                    runDay,
                    category: tag,
                    slug,
                    query: target.query,
                    wave: wave.name,
                    hint,
                    error: serializeError(error),
                  });
                }
              }
            }

            logCrawl('  + keep', {
              runDay,
              category: tag,
              slug,
              query: target.query,
              wave: wave.name,
              title: normalized.title,
              seconds: video?.seconds ?? null,
              durationSeconds: durationResult.result,
              author: video?.author?.name ?? null,
              keptForCategory: keptVideos.length,
              batchLimit: targetQuota,
            });
          }

          targetSummary.status = 'completed';
          if (!dryRun && target.channel?.slug) {
            try {
              const updatedChannel = buildChannelQualityUpdate(target.channel, {
                at: timestamp(),
                keptCount: keptCount,
                candidateCount: candidates.length,
                rejectedCount: targetRejectedCount,
                errorCount: 0,
              });

              const persistedChannel = await updateChannelRegistryEntry(target.channel.slug, {
                channelId: discovery.channel?.channelId || target.channel.channelId || null,
                channelUrl: discovery.channel?.channelUrl || target.channel.channelUrl || null,
                lastCrawledAt: timestamp(),
                allowed: updatedChannel.allowed,
                blocked: updatedChannel.blocked,
                qualityScore: updatedChannel.qualityScore,
                lastGoodHit: updatedChannel.lastGoodHit,
                lastBadHit: updatedChannel.lastBadHit,
                status: updatedChannel.status,
                enabled: updatedChannel.enabled,
              });

              if (persistedChannel) {
                Object.assign(target.channel, persistedChannel);
              }
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
          if (!dryRun && target.channel?.slug) {
            try {
              const updatedChannel = buildChannelQualityUpdate(target.channel, {
                at: timestamp(),
                keptCount: 0,
                candidateCount: 0,
                rejectedCount: 0,
                errorCount: 1,
                failed: true,
              });

              const persistedChannel = await updateChannelRegistryEntry(target.channel.slug, {
                channelId: target.channel.channelId || null,
                channelUrl: target.channel.channelUrl || null,
                lastCrawledAt: timestamp(),
                allowed: updatedChannel.allowed,
                blocked: updatedChannel.blocked,
                qualityScore: updatedChannel.qualityScore,
                lastGoodHit: updatedChannel.lastGoodHit,
                lastBadHit: updatedChannel.lastBadHit,
                status: updatedChannel.status,
                enabled: updatedChannel.enabled,
              });

              if (persistedChannel) {
                Object.assign(target.channel, persistedChannel);
              }
            } catch (updateError) {
              logCrawl('crawl_channel_registry_update_failed', {
                runDay,
                category: tag,
                slug,
                channelSlug: target.channel.slug,
                error: serializeError(updateError),
              });
            }
          }
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
        floor: CATEGORY_MIN_NEW_MOVIES_PER_DAY,
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
      floor: CATEGORY_MIN_NEW_MOVIES_PER_DAY,
      floorHit: keptVideos.length >= CATEGORY_MIN_NEW_MOVIES_PER_DAY,
      kept: keptVideos.length,
      deficit: Math.max(0, targetQuota - keptVideos.length),
      remainingDeficit: Math.max(0, targetQuota - keptVideos.length),
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

    const keptOldVideos = strictMode ? [] : oldData.filter(video => {
      const fakeVideoLike = {
        videoId: video.id,
        title: video.title || '',
        author: { name: 'trusted old data' },
      };
      return explainVideoDecision(fakeVideoLike, 'channel', CATEGORY_TRUSTED_AUTHOR_WORDS, { strictMode: false }).keep && hasRenderableThumbnail(video);
    }).map(video => normalizeMovieCategory(video));

  const finalData = [...newVideos, ...keptOldVideos]
    .slice(0, MAX_STORED_VIDEOS)
    .map(video => normalizeMovieCategory(video));

  const cleanedFinalData = await cleanSnapshotMovies(finalData);
  const snapshotCleanupRemoved = finalData.length - cleanedFinalData.length;

  const runSummary = {
    runStartedAt,
    runDay,
    dryRun,
    strictMode,
    strictFreshnessDays: STRICT_MAX_VIDEO_AGE_DAYS,
    snapshotSyncEnabled: syncSnapshot,
    existingVideos: oldData.length,
    existingKept: keptOldVideos.length,
    newVideos: newVideos.length,
    totalFetched: newVideos.length,
    totalVideos: cleanedFinalData.length,
    snapshotCleanupRemoved,
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
      totalVideos: cleanedFinalData.length,
      newVideos: newVideos.length,
      fetchedCount: newVideos.length,
      categorySummaries,
      dryRun: true,
      persistedTo: 'dry-run',
      summary: { ...runSummary, finishedAt, persistedTo: 'dry-run' },
    };
  }

  try {
    const persisted = await replacePersistedMovies(cleanedFinalData, {
      startedAt: runStartedAt,
      finishedAt: timestamp(),
      status: 'completed',
      keptCount: cleanedFinalData.length,
      fetchedCount: newVideos.length,
      source: 'scripts/crawl.mjs',
      syncSnapshot,
      cleanSnapshotMovies: false,
      metadata: { mode: 'category-batches', dryRun: false, runDay, summary: runSummary },
    });

    const finishedAt = timestamp();
    logCrawl('crawl_run_finished', { ...runSummary, finishedAt, persistedTo: 'postgres', crawlRunId: persisted.crawlRunId });

    return {
      runStartedAt,
      runDay,
      finishedAt,
      totalVideos: cleanedFinalData.length,
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
      totalVideos: cleanedFinalData.length,
      summary: runSummary,
      error: serializeError(error),
    })}`);

    const finishedAt = timestamp();
    logCrawl('crawl_run_finished', { ...runSummary, finishedAt, persistedTo: 'json-fallback' });

    return {
      runStartedAt,
      runDay,
      finishedAt,
      totalVideos: cleanedFinalData.length,
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
