import ytSearch from 'yt-search';
import { readMoviesFromJsonFile, replacePersistedMovies } from './movieStore.server.js';
import { CATEGORY_TAXONOMY, getCategoryDefinitionBySlug, normalizeMovieCategory, resolveMovieCategory } from './movieCategories.js';
import { hasRenderableThumbnail } from './thumbnailFilters.js';

const EPISODE_REGEX = /(t\u1eadp|tap|episode|ep\.?|ph\u1ea7n)\s*(\d{1,4})/i;
const MIN_VIDEO_SECONDS = 600;
const MAX_STORED_VIDEOS = 1000;
const RETRY_TIMES = 3;
const RETRY_BASE_DELAY_MS = 250;

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

const CATEGORY_BATCH_LIMIT = 5;
const CATEGORY_TRUSTED_AUTHOR_WORDS = ['ha nhan', 'h\u00e0 nh\u00e2n', 'review phim', 'hoat hinh', 'ho\u1ea1t h\u00ecnh', 'vietsub', 'anime', 'phim', 'cartoon'];
const SHARED_SOURCE_ANCHORS = ['@keodeovietsub'];
const SHARED_SOURCE_TARGETS = channelTargets(SHARED_SOURCE_ANCHORS);
const CATEGORY_QUERY_CAPS = {
  core: Infinity,
  expanded: Infinity,
  fallbackOnly: 2,
  riskyCaps: 1,
};

function keywordTargets(queries = [], tier = 'core') {
  return queries.map(query => ({ query, type: 'keyword', tier }));
}

function channelTargets(queries = []) {
  return queries.map(query => ({ query, type: 'channel' }));
}

function takeKeywordTargets(queries = [], tier = 'core') {
  const cap = CATEGORY_QUERY_CAPS[tier] ?? Infinity;
  return keywordTargets(queries.slice(0, cap), tier);
}

function buildCategoryKeywordTargets(slug) {
  const category = CATEGORY_TAXONOMY.find(item => item.slug === slug);
  if (!category) return [];

  return [
    ...takeKeywordTargets(category.core, 'core'),
    ...takeKeywordTargets(category.expanded, 'expanded'),
    ...takeKeywordTargets(category.fallbackOnly, 'fallbackOnly'),
    ...takeKeywordTargets(category.riskyCaps, 'riskyCaps'),
  ];
}

const CATEGORY_CRAWL_PLANS = [
  {
    slug: 'ha-nhan',
    reason: 'seed the day with Ha Nhan-owned and legacy Ha Nhan content first',
    targets: [
      ...buildCategoryKeywordTargets('ha-nhan'),
      ...channelTargets(['@HaNhanCartoon', '@Hanhansubchannel']),
    ],
  },
  {
    slug: 'tu-tien',
    reason: 'keep Tu Tien / Tien Hiep content in its own daily batch right after Ha Nhan',
    targets: [
      ...buildCategoryKeywordTargets('tu-tien'),
      ...channelTargets(['@HaNhanCartoon', '@Hanhansubchannel']),
    ],
  },
  {
    slug: 'xuyen-khong',
    reason: 'pull the Xuyen Khong batch separately from the Ha Nhan bucket',
    targets: buildCategoryKeywordTargets('xuyen-khong'),
  },
  {
    slug: 'trong-sinh',
    reason: 'pull the Trong Sinh batch separately from other story types',
    targets: buildCategoryKeywordTargets('trong-sinh'),
  },
  {
    slug: 'lieu-nhu-yen',
    reason: 'keep Li\u1ec5u Nh\u01b0 Y\u00ean content in its own daily batch',
    targets: buildCategoryKeywordTargets('lieu-nhu-yen'),
  },
  {
    slug: 'he-thong',
    reason: 'seed AI Chinese animated / short-form story content with trusted anchors first',
    targets: [
      ...SHARED_SOURCE_TARGETS,
      ...buildCategoryKeywordTargets('he-thong'),
    ],
  },
  {
    slug: 'khac',
    reason: 'use broad fallback discovery only for uncategorized leftovers',
    targets: [
      ...SHARED_SOURCE_TARGETS,
      ...buildCategoryKeywordTargets('khac'),
    ],
  },
];

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

async function searchWithRetry(query, context = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_TIMES; attempt += 1) {
    try {
      return {
        ok: true,
        result: await ytSearch(query),
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
    }
  }

  return {
    ok: false,
    error: lastError || new Error('Unknown crawl error'),
  };
}

export async function runCrawl({ dryRun = false } = {}) {
  const runStartedAt = timestamp();
  const runDay = runStartedAt.slice(0, 10);
  const categoryPlans = CATEGORY_CRAWL_PLANS.map(plan => {
    const category = getCategoryDefinitionBySlug(plan.slug);
    return {
      ...plan,
      tag: category?.tag || plan.slug,
      batchLimit: CATEGORY_BATCH_LIMIT,
      category,
    };
  });

  logCrawl('Bat dau crawl du lieu tu Youtube (Che do phan loai theo danh muc)...', {
    runStartedAt,
    runDay,
    dryRun,
    batchLimitPerCategory: CATEGORY_BATCH_LIMIT,
    categories: categoryPlans.map(plan => ({ slug: plan.slug, tag: plan.tag })),
  });

  const oldData = await readMoviesFromJsonFile();
  logCrawl('Phat hien list video cu.', { existingVideos: oldData.length, source: 'json' });

  const existingIds = new Set(oldData.map(video => video.id));
  const runNewIds = new Set();
  const newVideos = [];
  const categorySummaries = [];

  const crawlCategoryTargets = async (plan) => {
    const { tag, slug, targets, reason } = plan;
    const keptVideos = [];
    let targetErrors = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    logCrawl('crawl_category_batch_start', {
      runDay,
      category: tag,
      slug,
      batchLimit: CATEGORY_BATCH_LIMIT,
      reason,
      targets: targets.map(target => target.query),
    });

    for (const target of targets) {
      if (keptVideos.length >= CATEGORY_BATCH_LIMIT) {
        logCrawl('crawl_category_batch_limit_reached', { runDay, category: tag, slug, kept: keptVideos.length, batchLimit: CATEGORY_BATCH_LIMIT });
        break;
      }

      logCrawl('crawl_category_target_start', {
        runDay,
        category: tag,
        slug,
        query: target.query,
        type: target.type,
      });

      try {
        const searchResult = await searchWithRetry(target.query, { category: tag, slug, query: target.query, type: target.type, runDay });

        if (!searchResult.ok) {
          targetErrors += 1;
          logCrawl('crawl_category_target_skipped', {
            runDay,
            category: tag,
            slug,
            query: target.query,
            type: target.type,
            reason: 'target failed after retries',
            error: serializeError(searchResult.error),
          });
          continue;
        }

        const candidates = Array.isArray(searchResult.result?.videos) ? searchResult.result.videos : [];

        if (candidates.length === 0) {
          logCrawl('crawl_category_target_empty', { runDay, category: tag, slug, query: target.query });
          continue;
        }

        let keptCount = 0;
        let targetRejectedCount = 0;

        for (const video of candidates) {
          if (keptVideos.length >= CATEGORY_BATCH_LIMIT) {
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
            title: normalized.title,
            seconds: video?.seconds ?? null,
            author: video?.author?.name ?? null,
            keptForCategory: keptVideos.length,
            batchLimit: CATEGORY_BATCH_LIMIT,
          });
        }

        logCrawl('crawl_category_target_summary', {
          runDay,
          category: tag,
          slug,
          query: target.query,
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
          error: serializeError(error),
        });
      }
    }

    const summary = {
      runDay,
      category: tag,
      slug,
      batchLimit: CATEGORY_BATCH_LIMIT,
      kept: keptVideos.length,
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
