const BROKEN_THUMBNAIL_URLS = new Set([
  'https://i.ytimg.com/vi/ESTeyBsZt68/hq720_custom_2.jpg',
  'https://i.ytimg.com/vi/jygfwGrRvtw/hq720.jpg',
  'https://i.ytimg.com/vi/cT4f_09O5NE/hq720.jpg',
  'https://i.ytimg.com/vi/fF8qkLjnRuA/hq720_custom_1.jpg',
]);

const BROKEN_THUMBNAIL_IDS = new Set([
  '57hnpFpBEVs',
  'ESTeyBsZt68',
  'jygfwGrRvtw',
  'cT4f_09O5NE',
  'fF8qkLjnRuA',
  'Pk85yknde_w',
]);

const UNAVAILABLE_STORAGE_KEY = 'hanhan:unavailable-movie-ids';
const WATCHED_HISTORY_STORAGE_KEY = 'hanhan:watched-history';
const runtimeUnavailableIds = new Set();
let storageHydrated = false;

function hydrateUnavailableIds() {
  if (storageHydrated || typeof window === 'undefined') return;
  storageHydrated = true;

  try {
    const raw = window.localStorage.getItem(UNAVAILABLE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (typeof id === 'string' && id.trim()) {
          runtimeUnavailableIds.add(id.trim());
        }
      }
    }
  } catch {
    // Ignore storage read errors in restricted environments.
  }
}

export function isMovieUnavailable(movieId = '') {
  const id = String(movieId || '').trim();
  if (!id) return true;
  if (BROKEN_THUMBNAIL_IDS.has(id)) return true;
  hydrateUnavailableIds();
  return runtimeUnavailableIds.has(id);
}

export function markMovieUnavailable(movieId = '') {
  const id = String(movieId || '').trim();
  if (!id) return;

  hydrateUnavailableIds();
  const isNew = !runtimeUnavailableIds.has(id);
  runtimeUnavailableIds.add(id);

  if (typeof window === 'undefined') return;

  try {
    if (isNew) {
      window.localStorage.setItem(
        UNAVAILABLE_STORAGE_KEY,
        JSON.stringify(Array.from(runtimeUnavailableIds).slice(-500))
      );
    }

    const rawWatched = window.localStorage.getItem(WATCHED_HISTORY_STORAGE_KEY);
    if (rawWatched) {
      const parsedWatched = JSON.parse(rawWatched);
      if (Array.isArray(parsedWatched)) {
        const filteredWatched = parsedWatched.filter(item => item?.id !== id);
        if (filteredWatched.length !== parsedWatched.length) {
          window.localStorage.setItem(WATCHED_HISTORY_STORAGE_KEY, JSON.stringify(filteredWatched));
          window.dispatchEvent(new Event('hanhan:watched-history-updated'));
        }
      }
    }

    if (isNew) {
      window.dispatchEvent(new CustomEvent('hanhan:unavailable-movies-updated', { detail: { id } }));
    }
  } catch {
    // Ignore storage write errors.
  }
}

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

function normalizeMovie(movie) {
  if (!movie || typeof movie !== 'object' || Array.isArray(movie)) {
    return {};
  }

  return movie;
}

export function hasRenderableThumbnail(movie) {
  const safeMovie = normalizeMovie(movie);
  const thumbnail = String(safeMovie.thumbnail || '').trim();
  if (!thumbnail) return false;

  const movieId = String(safeMovie.id || '').trim();
  if (isMovieUnavailable(movieId)) return false;
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

function buildThumbnailFallbackSeed(movie) {
  const safeMovie = normalizeMovie(movie);
  const id = String(safeMovie.id || safeMovie.videoId || '').trim();
  const title = String(safeMovie.displayTitle || safeMovie.title || '').trim();
  const tag = String(safeMovie.tags || safeMovie.categoryTag || safeMovie.categorySlug || 'Khác').trim();

  return [id, title, tag].filter(Boolean).join('|') || 'hanhan-movie';
}

export function buildFallbackThumbnailUrl(movie) {
  const safeMovie = normalizeMovie(movie);
  const title = String(safeMovie.displayTitle || safeMovie.title || 'Không rõ tên phim').trim() || 'Không rõ tên phim';
  const tag = String(safeMovie.tags || safeMovie.categoryTag || safeMovie.categorySlug || 'Khác').trim() || 'Khác';
  const params = new URLSearchParams({
    seed: buildThumbnailFallbackSeed(safeMovie),
    title,
    tag,
  });

  return `${FALLBACK_THUMBNAIL_ROUTE}?${params.toString()}`;
}

export function getRenderableThumbnail(movie) {
  const safeMovie = normalizeMovie(movie);
  const thumbnail = String(safeMovie.thumbnail || '').trim();
  if (hasRenderableThumbnail(safeMovie)) {
    return thumbnail;
  }

  return '';
}