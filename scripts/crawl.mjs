import ytSearch from 'yt-search';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const EPISODE_REGEX = /(tập|tap|episode|ep\.?|phần)\s*(\d{1,4})/i;
const MIN_VIDEO_SECONDS = 600;
const MAX_STORED_VIDEOS = 1000;
const RETRY_TIMES = 3;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const CHARACTER_KEYWORDS = [
  { keyword: 'liễu như yên', tag: '2D - Liễu Như Yên' },
  { keyword: 'lieu nhu yen', tag: '2D - Liễu Như Yên' },
  { keyword: 'diệp phàm', tag: '2D - Diệp Phàm' },
  { keyword: 'diep pham', tag: '2D - Diệp Phàm' },
  { keyword: 'tiêu viêm', tag: '2D - Tiêu Viêm' },
  { keyword: 'tieu viem', tag: '2D - Tiêu Viêm' },
  { keyword: 'thạch hạo', tag: '2D - Thạch Hạo' },
  { keyword: 'thach hao', tag: '2D - Thạch Hạo' },
  { keyword: 'hàn lập', tag: '2D - Hàn Lập' },
  { keyword: 'han lap', tag: '2D - Hàn Lập' },
  { keyword: 'vương lâm', tag: '2D - Vương Lâm' },
  { keyword: 'vuong lam', tag: '2D - Vương Lâm' },
];

const TAG_RULES = [
  ...CHARACTER_KEYWORDS,
  { keyword: 'xuyên không', tag: 'Xuyên Không' },
  { keyword: 'trọng sinh', tag: 'Xuyên Không' },
  { keyword: 'hệ thống', tag: 'Hệ Thống' },
  { keyword: 'tu tiên', tag: 'Tu Tiên' },
  { keyword: 'tiên hiệp', tag: 'Tiên Hiệp' },
  { keyword: 'phàm nhân', tag: 'Tiên Hiệp' },
  { keyword: 'anime 2d', tag: 'Hoạt Hình 2D' },
  { keyword: 'hoat hinh 2d', tag: 'Hoạt Hình 2D' },
];

function normalizeSeriesKey(title = '') {
  return title
    .toLowerCase()
    .replace(EPISODE_REGEX, '')
    .replace(/\b(full|trọn bộ|vietsub|thuyết minh|review)\b/gi, '')
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
  return 'Khác';
}

function isAllowedTheme(title = '') {
  const requiredWords = [
    'xuyên không', 'trọng sinh', 'hệ thống', 'tu tiên', 'tiên hiệp',
    'phàm nhân', 'hoạt hình', 'hoat hinh', 'review phim',
    'liễu như yên', 'lieu nhu yen', 'diệp phàm', 'diep pham',
    'tiêu viêm', 'tieu viem', 'thạch hạo', 'thach hao',
  ];
  return requiredWords.some(word => title.includes(word));
}

function isBadVideoTitle(title = '') {
  const badWords = [
    '#marriage', 'tiktok', 'remix', 'music video', 'karaoke',
    'hàn quốc', 'nhạc', 'live stream', 'vlog', 'podcast',
    'kpop', 'k-pop', 'drama hàn', 'phim hàn', '#remembering', '#humor',
    '#xuhuongyoutube', '#mukbang', 'shorts', 'trailer', 'teaser',
    'reaction', 'highlight', 'clip ngắn', 'tin hot', 'news',
    'gấu trúc', 'panda', 'tấu hài', 'gau hai',
  ];
  return badWords.some(word => title.includes(word));
}

function shouldKeepVideo(video, targetType, trustedAuthorWords) {
  if (!video?.videoId) return false;
  if (!video.seconds || video.seconds < MIN_VIDEO_SECONDS) return false;

  const title = (video.title || '').toLowerCase();
  if (isBadVideoTitle(title)) return false;
  if (!isAllowedTheme(title)) return false;

  const authorName = (video.author?.name || '').toLowerCase();
  if (targetType === 'keyword' && authorName) {
    const trusted = trustedAuthorWords.some(word => authorName.includes(word));
    if (!trusted) return false;
  }

  return true;
}

function normalizeVideoData(video) {
  const title = (video.title || '').toLowerCase();
  const episodeMatch = title.match(EPISODE_REGEX);
  const episodeNumber = episodeMatch ? Number(episodeMatch[2]) : null;
  const type = episodeNumber ? 'series' : 'full';
  const episodeLabel = episodeNumber ? `Tập ${episodeNumber}` : 'Full';

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

async function searchWithRetry(query) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_TIMES; attempt += 1) {
    try {
      return await ytSearch(query);
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_TIMES) {
        await wait(300 * attempt);
      }
    }
  }

  throw lastError || new Error('Unknown crawl error');
}

async function crawlYouTube() {
  console.log('Bat dau crawl du lieu tu Youtube (Che do Nho Giot)...');

  try {
    const outPath = path.resolve('src/lib/movies.json');
    let oldData = [];

    if (existsSync(outPath)) {
      try {
        const raw = readFileSync(outPath, 'utf8');
        oldData = JSON.parse(raw);
        console.log(`Phat hien list video cu: ${oldData.length} video.`);
      } catch {
        console.log('File cu bi loi, se tao lai tu dau.');
      }
    }

    const channelTargets = [
      '@HaNhanCartoon',
      '@Hanhansubchannel',
      '@keodeovietsub',
      '@Banhbaoreview2026',
      '@CibiiSub-01',
      '@HoatHinhTrungQuoc-3D',
      '@ReviewPhim3DAI',
      '@HoatHinhReview',
    ];

    const keywordTargets = [
      'Liễu Như Yên tập full vietsub',
      'Diệp Phàm hoạt hình 2D',
      'Tiêu Viêm hoạt hình 2D',
      'Thạch Hạo hoạt hình vietsub',
      'Hàn Lập tiên hiệp full',
      'Vương Lâm tu tiên vietsub',
      'xuyên không trọng sinh full bộ',
      'hệ thống tu tiên review phim',
      'phàm nhân tu tiên 2d vietsub',
      'hoạt hình tiên hiệp 2d full',
    ];

    const searchTargets = [
      ...channelTargets.map(query => ({ query, type: 'channel' })),
      ...keywordTargets.map(query => ({ query, type: 'keyword' })),
    ];

    const trustedAuthorWords = [
      'ha nhan', 'hà nhân', 'review phim', 'hoat hinh', 'hoạt hình', 'vietsub',
      'anime', 'phim', 'cartoon',
    ];

    let fetchedResults = [];

    for (const target of searchTargets) {
      console.log(`Crawl: ${target.query}`);
      try {
        const result = await searchWithRetry(target.query);
        const filteredVideos = result.videos.filter(video => shouldKeepVideo(video, target.type, trustedAuthorWords));
        const videos = filteredVideos.map(normalizeVideoData);
        fetchedResults = [...fetchedResults, ...videos];
      } catch (error) {
        console.log(`  -> Loi khi crawl ${target.query}: ${error?.message || 'undefined'}`);
      }
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
      return shouldKeepVideo(fakeVideoLike, 'channel', trustedAuthorWords);
    });

    console.log(`===> Thu duoc ${newVideos.length} VIDEO MOI.`);

    const finalData = [...newVideos, ...keptOldVideos]
      .slice(0, MAX_STORED_VIDEOS)
      .map(video => ({
        ...video,
        tags: video.tags || classifyTag((video.title || '').toLowerCase()),
      }));

    await fs.writeFile(outPath, JSON.stringify(finalData, null, 2));
    console.log(`Xong! Tong he thong: ${finalData.length} video.`);
  } catch (error) {
    console.error('Loi:', error);
  }
}

crawlYouTube();
