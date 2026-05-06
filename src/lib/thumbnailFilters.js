const BROKEN_THUMBNAIL_URLS = new Set([
  'https://i.ytimg.com/vi/ESTeyBsZt68/hq720_custom_2.jpg',
  'https://i.ytimg.com/vi/jygfwGrRvtw/hq720.jpg',
  'https://i.ytimg.com/vi/cT4f_09O5NE/hq720.jpg',
  'https://i.ytimg.com/vi/fF8qkLjnRuA/hq720_custom_1.jpg',
]);

const BROKEN_THUMBNAIL_IDS = new Set([
  'ESTeyBsZt68',
  'jygfwGrRvtw',
  'cT4f_09O5NE',
  'fF8qkLjnRuA',
]);

const YOUTUBE_IMAGE_HOSTS = new Set(['i.ytimg.com', 'img.youtube.com']);
const ALLOWED_THUMBNAIL_FILENAMES = new Set([
  'default.jpg',
  'default.webp',
  'default_live.jpg',
  'default_live.webp',
  'hq720.jpg',
  'hq720.webp',
  'hq720_custom_1.jpg',
  'hq720_custom_1.webp',
  'hq720_custom_2.jpg',
  'hq720_custom_2.webp',
  'hqdefault.jpg',
  'hqdefault.webp',
  'hqdefault_live.jpg',
  'hqdefault_live.webp',
  'maxresdefault.jpg',
  'maxresdefault.webp',
  'maxresdefault_live.jpg',
  'maxresdefault_live.webp',
  'mqdefault.jpg',
  'mqdefault.webp',
  'mqdefault_live.jpg',
  'mqdefault_live.webp',
  'sddefault.jpg',
  'sddefault.webp',
  'sddefault_live.jpg',
  'sddefault_live.webp',
]);

const YOUTUBE_THUMBNAIL_PATH_PREFIXES = new Set(['vi', 'vi_webp']);
const RENDERABLE_THUMBNAIL_FILENAME_PATTERN = /^[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp)$/i;
const BLOCKED_THUMBNAIL_FILENAME_PATTERN = /^(?:frame\d+|placeholder|poster)\.(?:jpe?g|png|webp)$/i;
const FALLBACK_THUMBNAIL_ROUTE = '/api/movie-thumbnail';

function extractThumbnailFilename(thumbnailUrl = '') {
  try {
    return new URL(thumbnailUrl).pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

function isRenderableThumbnailFilename(filename = '') {
  const trimmed = String(filename || '').trim().toLowerCase();
  if (!trimmed) return false;
  if (BLOCKED_THUMBNAIL_FILENAME_PATTERN.test(trimmed)) return false;
  if (ALLOWED_THUMBNAIL_FILENAMES.has(trimmed)) return true;
  return RENDERABLE_THUMBNAIL_FILENAME_PATTERN.test(trimmed);
}

function isAllowedThumbnailHost(hostname = '') {
  return YOUTUBE_IMAGE_HOSTS.has(hostname) || /^i\d+\.ytimg\.com$/i.test(String(hostname || ''));
}

export function hasRenderableThumbnail(movie = {}) {
  const thumbnail = String(movie.thumbnail || '').trim();
  if (!thumbnail) return false;

  const movieId = String(movie.id || '').trim();
  if (BROKEN_THUMBNAIL_IDS.has(movieId)) return false;
  if (BROKEN_THUMBNAIL_URLS.has(thumbnail)) return false;

  let url;
  try {
    url = new URL(thumbnail);
  } catch {
    return false;
  }

  if (!isAllowedThumbnailHost(url.hostname)) return false;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || !YOUTUBE_THUMBNAIL_PATH_PREFIXES.has(parts[0]) || !parts[1] || !parts[2]) return false;

  const filename = extractThumbnailFilename(thumbnail);
  if (!isRenderableThumbnailFilename(filename)) return false;

  return true;
}

function buildThumbnailFallbackSeed(movie = {}) {
  const id = String(movie.id || movie.videoId || '').trim();
  const title = String(movie.displayTitle || movie.title || '').trim();
  const tag = String(movie.tags || movie.categoryTag || movie.categorySlug || 'Khác').trim();

  return [id, title, tag].filter(Boolean).join('|') || 'hanhan-movie';
}

export function buildFallbackThumbnailUrl(movie = {}) {
  const title = String(movie.displayTitle || movie.title || 'Không rõ tên phim').trim() || 'Không rõ tên phim';
  const tag = String(movie.tags || movie.categoryTag || movie.categorySlug || 'Khác').trim() || 'Khác';
  const params = new URLSearchParams({
    seed: buildThumbnailFallbackSeed(movie),
    title,
    tag,
  });

  return `${FALLBACK_THUMBNAIL_ROUTE}?${params.toString()}`;
}

export function getRenderableThumbnail(movie = {}) {
  const thumbnail = String(movie.thumbnail || '').trim();
  if (hasRenderableThumbnail(movie)) {
    return thumbnail;
  }

  return buildFallbackThumbnailUrl(movie);
}
