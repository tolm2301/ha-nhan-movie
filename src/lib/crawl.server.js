import ytSearch from 'yt-search';
import { readMoviesFromJsonFile, replacePersistedMovies } from './movieStore.server.js';

const EPISODE_REGEX = /(t\u1eadp|tap|episode|ep\.?|ph\u1ea7n)\s*(\d{1,4})/i;
const MIN_VIDEO_SECONDS = 600;
const MAX_STORED_VIDEOS = 1000;
const RETRY_TIMES = 3;
const RETRY_BASE_DELAY_MS = 250;
const MIN_KEPT_VIDEOS = 30;

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

const CHARACTER_KEYWORDS = [
  { keyword: 'li\u1ec5u nh\u01b0 y\u00ean', tag: '2D - Li\u1ec5u Nh\u01b0 Y\u00ean' },
  { keyword: 'lieu nhu yen', tag: '2D - Li\u1ec5u Nh\u01b0 Y\u00ean' },
  { keyword: 'di\u1ec7p ph\u00e0m', tag: '2D - Di\u1ec7p Ph\u00e0m' },
  { keyword: 'diep pham', tag: '2D - Di\u1ec7p Ph\u00e0m' },
  { keyword: 'ti\u00eau vi\u00eam', tag: '2D - Ti\u00eau Vi\u00eam' },
  { keyword: 'tieu viem', tag: '2D - Ti\u00eau Vi\u00eam' },
  { keyword: 'th\u1ea1ch h\u1ea1o', tag: '2D - Th\u1ea1ch H\u1ea1o' },
  { keyword: 'thach hao', tag: '2D - Th\u1ea1ch H\u1ea1o' },
  { keyword: 'h\u00e0n l\u1eadp', tag: '2D - H\u00e0n L\u1eadp' },
  { keyword: 'han lap', tag: '2D - H\u00e0n L\u1eadp' },
  { keyword: 'v\u01b0\u01a1ng l\u00e2m', tag: '2D - V\u01b0\u01a1ng L\u00e2m' },
  { keyword: 'vuong lam', tag: '2D - V\u01b0\u01a1ng L\u00e2m' },
];

const PRIMARY_HA_NHAN_ANCHORS = ['h\u00e0 nh\u00e2n phim', 'ha nhan phim', 'h\u00e0 nh\u00e2n', 'ha nhan'];
const STRONG_CHARACTER_SIGNALS = ['li\u1ec5u nh\u01b0 y\u00ean', 'lieu nhu yen', 'di\u1ec7p ph\u00e0m', 'diep pham', 'ti\u00eau vi\u00eam', 'tieu viem', 'th\u1ea1ch h\u1ea1o', 'thach hao', 'h\u00e0n l\u1eadp', 'han lap', 'v\u01b0\u01a1ng l\u00e2m', 'vuong lam'];
const SUPPORTING_THEME_SIGNALS = ['tu ti\u00ean', 'tien hiep', 'ti\u00ean hi\u1ec7p', 'xuy\u00ean kh\u00f4ng', 'xuyen khong', 'tr\u1ecdng sinh', 'trong sinh', 'h\u1ec7 th\u1ed1ng', 'he thong', 'ph\u00e0m nh\u00e2n', 'pham nhan'];
const FALLBACK_THEME_SIGNALS = ['phim', 'review phim', 'ho\u1ea1t h\u00ecnh', 'hoat hinh', 'anime 2d', 'full', 'series', 't\u1eadp', 'tap', 'vietsub'];

const TAG_RULES = [
  ...CHARACTER_KEYWORDS,
  { keyword: 'xuy\u00ean kh\u00f4ng', tag: 'Xuy\u00ean Kh\u00f4ng' },
  { keyword: 'tr\u1ecdng sinh', tag: 'Xuy\u00ean Kh\u00f4ng' },
  { keyword: 'h\u1ec7 th\u1ed1ng', tag: 'H\u1ec7 Th\u1ed1ng' },
  { keyword: 'tu ti\u00ean', tag: 'Tu Ti\u00ean' },
  { keyword: 'ti\u00ean hi\u1ec7p', tag: 'Ti\u00ean Hi\u1ec7p' },
  { keyword: 'ph\u00e0m nh\u00e2n', tag: 'Ti\u00ean Hi\u1ec7p' },
  { keyword: 'anime 2d', tag: 'Ho\u1ea1t H\u00ecnh 2D' },
  { keyword: 'hoat hinh 2d', tag: 'Ho\u1ea1t H\u00ecnh 2D' },
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

function classifyTag(title = '') {
  for (const rule of TAG_RULES) {
    if (title.includes(rule.keyword)) {
      return rule.tag;
    }
  }
  return 'Kh\u00e1c';
}

function collectThemeSignals(title = '') {
  const normalizedTitle = title.toLowerCase();
  const collectMatches = keywords => keywords.filter(keyword => normalizedTitle.includes(keyword));

  return {
    primaryAnchors: collectMatches(PRIMARY_HA_NHAN_ANCHORS),
    characterSignals: collectMatches(STRONG_CHARACTER_SIGNALS),
    supportingSignals: collectMatches(SUPPORTING_THEME_SIGNALS),
    fallbackSignals: collectMatches(FALLBACK_THEME_SIGNALS),
  };
}

function describeSignalList(signals) {
  return signals.length > 0 ? signals.join(', ') : 'none';
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

  const themeSignals = collectThemeSignals(title);
  const hasPrimaryAnchor = themeSignals.primaryAnchors.length > 0;
  const hasCharacterSignal = themeSignals.characterSignals.length > 0;
  const hasSupportingSignal = themeSignals.supportingSignals.length > 0;
  const hasFallbackSignal = themeSignals.fallbackSignals.length > 0;

  if (!hasPrimaryAnchor && !hasCharacterSignal) {
    if (hasSupportingSignal) {
      return {
        keep: false,
        reason: `missing primary Ha Nhan anchor or strong character signal (supporting signals only: ${describeSignalList(themeSignals.supportingSignals)})`,
      };
    }

    if (hasFallbackSignal) {
      return {
        keep: false,
        reason: `broad fallback terms are not enough on their own (${describeSignalList(themeSignals.fallbackSignals)})`,
      };
    }

    return {
      keep: false,
      reason: 'missing primary Ha Nhan anchor or strong character signal',
    };
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

function normalizeVideoData(video) {
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
    tags: classifyTag(title),
    rating: 'N/A',
  };
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
  logCrawl('Bat dau crawl du lieu tu Youtube (Che do Nho Giot)...', { runStartedAt, dryRun });

  const oldData = await readMoviesFromJsonFile();
  logCrawl('Phat hien list video cu.', { existingVideos: oldData.length, source: 'json' });

  const exactHaNhanChannelTargets = ['@HaNhanCartoon', '@Hanhansubchannel'];
  const exactHaNhanKeywordTargets = ['H\u00e0 Nh\u00e2n', 'Ha Nhan', 'H\u00e0 Nh\u00e2n phim', 'Ha Nhan phim'];
  const haNhanThemeComboTargets = ['H\u00e0 Nh\u00e2n Li\u1ec5u Nh\u01b0 Y\u00ean', 'Ha Nhan Lieu Nhu Yen', 'H\u00e0 Nh\u00e2n tu ti\u00ean', 'Ha Nhan tu tien', 'H\u00e0 Nh\u00e2n xuy\u00ean kh\u00f4ng', 'Ha Nhan xuyen khong', 'H\u00e0 Nh\u00e2n tr\u1ecdng sinh', 'Ha Nhan trong sinh'];
  const haNhanFormatHelperTargets = ['H\u00e0 Nh\u00e2n full', 'Ha Nhan full', 'H\u00e0 Nh\u00e2n series', 'Ha Nhan series', 'H\u00e0 Nh\u00e2n t\u1eadp', 'Ha Nhan tap', 'H\u00e0 Nh\u00e2n vietsub', 'Ha Nhan vietsub'];
  const broadChannelTargets = ['@keodeovietsub', '@Banhbaoreview2026', '@CibiiSub-01', '@HoatHinhTrungQuoc-3D', '@ReviewPhim3DAI', '@HoatHinhReview'];
  const broadFallbackKeywordTargets = ['phim', 'tu ti\u00ean', 'xuy\u00ean kh\u00f4ng', 'tr\u1ecdng sinh'];

  const crawlTiers = [
    {
      stage: 'primary',
      label: 'primary exact Ha Nhan anchors',
      reason: 'exact Ha Nhan anchors should seed the run first',
      targets: [
        ...exactHaNhanKeywordTargets.map(query => ({ query, type: 'keyword' })),
        ...exactHaNhanChannelTargets.map(query => ({ query, type: 'channel' })),
      ],
    },
    {
      stage: 'secondary',
      label: 'secondary Ha Nhan theme combos',
      reason: 'use approved character/theme combinations when exact anchors are still thin',
      targets: haNhanThemeComboTargets.map(query => ({ query, type: 'keyword' })),
    },
    {
      stage: 'secondary',
      label: 'secondary Ha Nhan format helpers',
      reason: 'keep discovery in the Ha Nhan corpus with format/helper queries before broad fallback',
      targets: haNhanFormatHelperTargets.map(query => ({ query, type: 'keyword' })),
    },
    {
      stage: 'fallback',
      label: 'fallback curated channels',
      reason: 'expand to related curated channels only after the Ha Nhan-specific tiers stay thin',
      targets: broadChannelTargets.map(query => ({ query, type: 'channel' })),
    },
    {
      stage: 'fallback',
      label: 'fallback broad keywords',
      reason: 'use broad terms as the last safe tier only if the run still needs more items',
      targets: broadFallbackKeywordTargets.map(query => ({ query, type: 'keyword' })),
    },
  ];

  const trustedAuthorWords = ['ha nhan', 'h\u00e0 nh\u00e2n', 'review phim', 'hoat hinh', 'ho\u1ea1t h\u00ecnh', 'vietsub', 'anime', 'phim', 'cartoon'];

  let fetchedResults = [];

  const crawlTargets = async (tier, maxResults) => {
    const { targets, stage, label } = tier;
    const phaseResults = [];
    let phaseErrorCount = 0;

    logCrawl(`Bat dau tier ${label}.`, {
      stage,
      tier: label,
      reason: tier.reason,
      maxResults,
      targets: targets.map(target => target.query),
    });

    for (const target of targets) {
      if (phaseResults.length >= maxResults) {
        logCrawl(`Dat gioi han tier ${label}, dung mo rong tier nay.`, {
          stage,
          tier: label,
          maxResults,
          kept: phaseResults.length,
        });
        break;
      }

      logCrawl(`Crawl [${label}]`, {
        stage,
        tier: label,
        query: target.query,
        type: target.type,
      });

      try {
        const searchResult = await searchWithRetry(target.query, { stage, tier: label, query: target.query, type: target.type });

        if (!searchResult.ok) {
          phaseErrorCount += 1;
          logCrawl('crawl_target_skipped', {
            stage,
            tier: label,
            query: target.query,
            type: target.type,
            reason: 'target failed after retries',
            error: serializeError(searchResult.error),
          });
          continue;
        }

        const result = searchResult.result;
        const candidates = Array.isArray(result?.videos) ? result.videos : [];

        if (candidates.length === 0) {
          logCrawl('Khong co video nao tra ve tu target nay.', { stage, tier: label, query: target.query });
          continue;
        }

        let keptCount = 0;
        let rejectCount = 0;

        for (const video of candidates) {
          const decision = explainVideoDecision(video, target.type, trustedAuthorWords);
          const videoLabel = video?.title || video?.videoId || 'khong ro tieu de';

          if (!decision.keep) {
            rejectCount += 1;
            logCrawl('  - reject', {
              stage,
              tier: label,
              query: target.query,
              title: videoLabel,
              seconds: video?.seconds ?? null,
              author: video?.author?.name ?? null,
              reason: decision.reason,
            });
            continue;
          }

          keptCount += 1;
          const normalized = normalizeVideoData(video);
          phaseResults.push(normalized);
          logCrawl('  + keep', {
            stage,
            tier: label,
            query: target.query,
            title: normalized.title,
            seconds: video?.seconds ?? null,
            author: video?.author?.name ?? null,
          });

          if (phaseResults.length >= maxResults) {
            break;
          }
        }

        logCrawl('Tong ket target', {
          stage,
          tier: label,
          query: target.query,
          kept: keptCount,
          rejected: rejectCount,
          candidates: candidates.length,
        });
      } catch (error) {
        phaseErrorCount += 1;
        logCrawl('crawl_target_skipped', {
          stage,
          tier: label,
          query: target.query,
          type: target.type,
          reason: 'unexpected target processing error',
          error: serializeError(error),
        });
        continue;
      }
    }

    logCrawl(`Ket thuc tier ${label}.`, { stage, tier: label, kept: phaseResults.length, errors: phaseErrorCount });
    return phaseResults;
  };

  logCrawl('Uu tien nhom Ha Nhan truoc, tiep tuc mo rong cho den khi dat toi thieu 30 video giu lai hoac het tier an toan.');
  logCrawl('Thu tu tier/query se chay.', {
    minKeptVideos: MIN_KEPT_VIDEOS,
    tiers: crawlTiers.map(tier => ({ stage: tier.stage, tier: tier.label, targets: tier.targets.map(target => target.query) })),
  });

  for (const tier of crawlTiers) {
    const remainingNeeded = MIN_KEPT_VIDEOS - fetchedResults.length;

    if (remainingNeeded <= 0) {
      logCrawl('Da dat muc toi thieu giu lai, dung mo rong tier tiep theo.', { minKeptVideos: MIN_KEPT_VIDEOS, kept: fetchedResults.length });
      break;
    }

    if (tier.stage !== 'primary') {
      logCrawl('Mo rong crawl sang tier an toan tiep theo.', {
        stage: tier.stage,
        tier: tier.label,
        reason: tier.reason,
        stillNeeded: remainingNeeded,
        minKeptVideos: MIN_KEPT_VIDEOS,
      });
    } else {
      logCrawl('Chay tier khoi tao Ha Nhan.', {
        stage: tier.stage,
        tier: tier.label,
        reason: tier.reason,
        stillNeeded: remainingNeeded,
        minKeptVideos: MIN_KEPT_VIDEOS,
      });
    }

    const tierResults = await crawlTargets(tier, remainingNeeded);
    fetchedResults = [...fetchedResults, ...tierResults];

    logCrawl('Ket qua sau tier.', {
      stage: tier.stage,
      tier: tier.label,
      keptFromTier: tierResults.length,
      totalKept: fetchedResults.length,
      stillNeeded: Math.max(MIN_KEPT_VIDEOS - fetchedResults.length, 0),
    });
  }

  if (fetchedResults.length >= MIN_KEPT_VIDEOS) {
    logCrawl('Da dat muc toi thieu giu lai cho mot run.', { minKeptVideos: MIN_KEPT_VIDEOS, kept: fetchedResults.length });
  } else {
    logCrawl('Da het tat ca tier an toan nhung chua dat muc toi thieu giu lai.', { minKeptVideos: MIN_KEPT_VIDEOS, kept: fetchedResults.length });
  }

  const oldIds = new Set(oldData.map(video => video.id));
  const uniqueNewIds = new Set();
  const newVideos = [];

  for (const video of fetchedResults) {
    if (!oldIds.has(video.id) && !uniqueNewIds.has(video.id)) {
      uniqueNewIds.add(video.id);
      newVideos.push(video);
    }
  }

  const keptOldVideos = oldData.filter(video => {
    const fakeVideoLike = {
      videoId: video.id,
      title: video.title || '',
      seconds: video.type === 'full' ? MIN_VIDEO_SECONDS : MIN_VIDEO_SECONDS + 1,
      author: { name: 'trusted old data' },
    };
    return explainVideoDecision(fakeVideoLike, 'channel', trustedAuthorWords).keep;
  });

  logCrawl('Tong ket video moi.', {
    newVideos: newVideos.length,
    totalFetched: fetchedResults.length,
    existingKept: keptOldVideos.length,
  });

  const finalData = [...newVideos, ...keptOldVideos]
    .slice(0, MAX_STORED_VIDEOS)
    .map(video => ({
      ...video,
      tags: video.tags || classifyTag((video.title || '').toLowerCase()),
    }));

  if (dryRun) {
    const finishedAt = timestamp();
    logCrawl('Dry run crawl, khong ghi vao Postgres.', { runStartedAt, finishedAt, totalVideos: finalData.length });
    return {
      runStartedAt,
      finishedAt,
      totalVideos: finalData.length,
      newVideos: newVideos.length,
      fetchedCount: fetchedResults.length,
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
      fetchedCount: fetchedResults.length,
      source: 'scripts/crawl.mjs',
      metadata: { mode: 'crawl', dryRun: false },
    });

    const finishedAt = timestamp();
    logCrawl('Xong crawl.', { runStartedAt, finishedAt, totalVideos: finalData.length, persistedTo: 'postgres' });

    return {
      runStartedAt,
      finishedAt,
      totalVideos: finalData.length,
      newVideos: newVideos.length,
      fetchedCount: fetchedResults.length,
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
    logCrawl('Xong crawl.', { runStartedAt, finishedAt, totalVideos: finalData.length, persistedTo: 'json-fallback' });

    return {
      runStartedAt,
      finishedAt,
      totalVideos: finalData.length,
      newVideos: newVideos.length,
      fetchedCount: fetchedResults.length,
      dryRun: false,
      persistedTo: 'json-fallback',
      persistenceError: serializeError(error),
    };
  }
}
