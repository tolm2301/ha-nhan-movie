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
  'hq720.jpg',
  'hq720_custom_1.jpg',
  'hq720_custom_2.jpg',
  'hqdefault.jpg',
  'maxresdefault.jpg',
  'sddefault.jpg',
  'mqdefault.jpg',
]);

function extractThumbnailFilename(thumbnailUrl = '') {
  try {
    return new URL(thumbnailUrl).pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
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

  if (!YOUTUBE_IMAGE_HOSTS.has(url.hostname)) return false;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'vi' || !parts[1] || !parts[2]) return false;

  const filename = extractThumbnailFilename(thumbnail);
  if (/^frame\d+\.jpg$/i.test(filename)) return false;

  return ALLOWED_THUMBNAIL_FILENAMES.has(filename.toLowerCase());
}
