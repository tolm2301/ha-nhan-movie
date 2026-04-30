import { load as loadCheerio } from 'cheerio';
import { loadChannelRegistry, readMoviesFromJsonFile, replacePersistedMovies, updateChannelRegistryEntry } from './movieStore.server.js';
import { CATEGORY_TAXONOMY, getCategoryDefinitionBySlug, normalizeMovieCategory, resolveMovieCategory } from './movieCategories.js';
import { hasRenderableThumbnail } from './thumbnailFilters.js';

const EPISODE_REGEX = /(t\u1eadp|tap|episode|ep\.?|ph\u1ea7n)\s*(\d{1,4})/i;
const MIN_VIDEO_SECONDS = 600;
const MAX_STORED_VIDEOS = 1000;
const CHANNEL_FEED_ENTRY_LIMIT = 12;
const CHANNEL_VIDEO_DETAIL_LIMIT = 8;
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

function isBadVideoTitle(title = '') {
  const badWords = [
    '#marriage', 'tiktok', 'remix', 'music video', 'karaoke',
    'h\u00e0n qu\u1ed1c', 'nh\u1ea1c', 'live stream', 'vlog', 'podcast',
    'kpop', 'k-pop', 'drama h\u00e0n', 'phim h\u00e0n', '#remembering', '#humor',
    '#xuhuongyoutube', '#mukbang', 'shorts', 'trailer', 'teaser',
    'reaction', 'highlight', 'clip ng\u1eafn', 'tin hot', 'news',
    'g\u1ea5u tr\u00fac', 'panda', 't\u1ea5u h\u00e0i', 'gau hai',
  ];
  return badWords.some(word => title.includes(word));
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

  if (isBadVideoTitle(title)) {
    return { keep: false, reason: 'blocked by low-quality title keyword' };
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

export async function runCrawl({ dryRun = false } = {}) {
  const runStartedAt = timestamp();
  const runDay = runStartedAt.slice(0, 10);
  const registry = await loadChannelRegistry();
  const enabledChannels = registry
    .filter(channel => channel?.enabled !== false)
    .sort((left, right) => (left.priority - right.priority) || String(left.slug).localeCompare(String(right.slug)));

  const categoryPlans = CATEGORY_TAXONOMY.map(category => {
    const channelTargetsByCategory = buildCategoryChannelTargets(category.slug, enabledChannels);
    const categoryDefinition = getCategoryDefinitionBySlug(category.slug) || category;
    return {
      slug: categoryDefinition.slug,
      tag: categoryDefinition.tag,
      reason: `crawl registry-backed channels for ${categoryDefinition.tag} first, then controlled fallback channels if needed`,
      initialTargets: channelTargetsByCategory.initial,
      refillTargets: channelTargetsByCategory.refill,
      batchLimit: CATEGORY_BATCH_LIMIT,
      category: categoryDefinition,
    };
  });

  logCrawl('Bat dau crawl du lieu tu channel registry (Che do phan loai theo danh muc)...', {
    runStartedAt,
    runDay,
    dryRun,
    batchLimitPerCategory: CATEGORY_BATCH_LIMIT,
    categories: categoryPlans.map(plan => ({ slug: plan.slug, tag: plan.tag, initialSources: plan.initialTargets.length, fallbackSources: plan.refillTargets.length })),
    registrySources: enabledChannels.length,
  });

  const oldData = await readMoviesFromJsonFile();
  logCrawl('Phat hien list video cu.', { existingVideos: oldData.length, source: 'json' });

  const existingIds = new Set(oldData.map(video => video.id));
  const runNewIds = new Set();
  const newVideos = [];
  const categorySummaries = [];
  const touchedChannelSlugs = new Set();

  const crawlCategoryTargets = async (plan) => {
    const { tag, slug, initialTargets, refillTargets = [], reason } = plan;
    const keptVideos = [];
    let targetErrors = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;
    const triedQueries = new Set();
    const targetQuota = CATEGORY_BATCH_LIMIT;
    const waves = [
      { name: 'initial', reason, targets: initialTargets },
      ...(refillTargets.length > 0 ? [{ name: 'refill', reason: 'controlled backfill from the remaining registry channels', targets: refillTargets }] : []),
    ];

    logCrawl('crawl_category_batch_start', {
      runDay,
      category: tag,
      slug,
      batchLimit: targetQuota,
      reason,
      targets: initialTargets.map(target => target.query),
      refillTargets: refillTargets.map(target => target.query),
    });

    for (const wave of waves) {
      if (keptVideos.length >= targetQuota) {
        break;
      }

      const deficitBeforeWave = targetQuota - keptVideos.length;
      logCrawl(wave.name === 'initial' ? 'crawl_category_batch_wave_start' : 'crawl_category_refill_start', {
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

        const targetKey = `channel:${getChannelKey(target.channel)}`;
        if (triedQueries.has(targetKey)) {
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

        try {
          const discovery = await getChannelCandidates(target.channel, { category: tag, slug, query: target.query, type: target.type, wave: wave.name, runDay });

          if (!discovery || !Array.isArray(discovery.videos)) {
            targetErrors += 1;
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

          logCrawl('crawl_category_target_summary', {
            runDay,
            category: tag,
            slug,
            query: target.query,
            wave: wave.name,
            channelSlug: target.channel?.slug || null,
            kept: keptCount,
            rejected: targetRejectedCount,
            candidates: candidates.length,
          });
        } catch (error) {
          targetErrors += 1;
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
    };

    categorySummaries.push(summary);
    logCrawl('crawl_category_batch_complete', summary);
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

  logCrawl('Tong ket video moi.', {
    newVideos: newVideos.length,
    totalFetched: newVideos.length,
    existingKept: keptOldVideos.length,
    categorySummaries,
  });

  const finalData = [...newVideos, ...keptOldVideos]
    .slice(0, MAX_STORED_VIDEOS)
    .map(video => normalizeMovieCategory(video));

  if (dryRun) {
    const finishedAt = timestamp();
    logCrawl('Dry run crawl, khong ghi vao Postgres.', { runStartedAt, runDay, finishedAt, totalVideos: finalData.length, categorySummaries });
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
      metadata: { mode: 'category-batches', dryRun: false, runDay, categorySummaries },
    });

    const finishedAt = timestamp();
    logCrawl('Xong crawl.', { runStartedAt, runDay, finishedAt, totalVideos: finalData.length, persistedTo: 'postgres', categorySummaries });

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
    };
  } catch (error) {
    console.error(`[${timestamp()}] crawl_persist_failed ${JSON.stringify({
      runStartedAt,
      totalVideos: finalData.length,
      error: serializeError(error),
    })}`);

    const finishedAt = timestamp();
    logCrawl('Xong crawl.', { runStartedAt, runDay, finishedAt, totalVideos: finalData.length, persistedTo: 'json-fallback', categorySummaries });

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
    };
  }
}
