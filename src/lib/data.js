import { cache } from 'react';
import { describeDatabaseTarget, loadPersistedMovies, readMoviesFromJsonFile } from './movieStore.server.js';
import { buildCategoryBuckets, normalizeMovieCategory } from './movieCategories.js';

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

function normalizeText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isChannelSignature(segment = '') {
  const normalized = normalizeText(segment).replace(/[^a-z0-9\s#@._-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const channelKeywords = [
    'ha nhan',
    'hanhan',
    'cartoon',
    'review',
    'official',
    'channel',
    'youtube',
    'vietsub',
    'tv',
    'sub',
  ];

  const contentKeywords = [
    'tap',
    'episode',
    'full',
    'hoat hinh',
    'tien hiep',
    'xuyen khong',
    'he thong',
    'trong sinh',
    'tu tien',
  ];

  if (contentKeywords.some(keyword => normalized.includes(keyword))) {
    return false;
  }

  if (normalized.startsWith('#')) {
    return true;
  }

  const words = normalized.split(' ').filter(Boolean);
  const hasChannelKeyword = channelKeywords.some(keyword => normalized.includes(keyword));
  const compact = normalized.replace(/\s+/g, '');
  const looksLikeHandle = /^@?[a-z0-9_.-]{3,32}$/i.test(compact);

  return hasChannelKeyword || (looksLikeHandle && words.length <= 4);
}

function cleanMovieTitle(title = '') {
  const original = title.toString().trim();
  if (!original) return '';

  let cleaned = original
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.replace(/\s*[\[(]([^\])]{1,60})[\])]\s*$/i, (match, inside) => (
    isChannelSignature(inside) ? '' : match
  )).trim();

  const separators = ['||', '|', '•'];
  let hasTailChannel = true;

  while (hasTailChannel) {
    hasTailChannel = false;

    for (const separator of separators) {
      if (!cleaned.includes(separator)) continue;

      const parts = cleaned.split(separator);
      const tail = (parts[parts.length - 1] || '').trim();
      if (!tail || !isChannelSignature(tail)) continue;

      parts.pop();
      cleaned = parts.join(` ${separator} `).replace(/\s+/g, ' ').replace(/[|•\s]+$/g, '').trim();
      hasTailChannel = true;
      break;
    }
  }

  return cleaned || original;
}

function hasRenderableThumbnail(movie = {}) {
  const thumbnail = String(movie.thumbnail || '').trim();
  if (!thumbnail) return false;

  const movieId = String(movie.id || '').trim();
  if (BROKEN_THUMBNAIL_IDS.has(movieId)) return false;
  if (BROKEN_THUMBNAIL_URLS.has(thumbnail)) return false;

  return true;
}

function moveMovieToFront(movies = [], featuredMovie = null) {
  if (!featuredMovie?.id || !Array.isArray(movies) || movies.length === 0) {
    return featuredMovie?.id ? [featuredMovie] : movies;
  }

  const featuredIndex = movies.findIndex(movie => movie.id === featuredMovie.id);
  if (featuredIndex === -1) {
    return [featuredMovie, ...movies.slice(0, movies.length - 1)];
  }

  if (featuredIndex <= 0) {
    return movies;
  }

  const reordered = movies.slice();
  const [selectedMovie] = reordered.splice(featuredIndex, 1);
  reordered.unshift(selectedMovie);
  return reordered;
}

function getHomeFeaturedMovie(categoryBuckets, allMovies) {
  const haNhanBucket = categoryBuckets.find(category => category.slug === 'ha-nhan');
  const directHaNhanMovie = haNhanBucket?.movies?.[0] || null;

  return directHaNhanMovie || allMovies[0] || null;
}

export function buildMovieCatalog(movies = []) {
  const allMovies = movies.filter(hasRenderableThumbnail).map(movie => normalizeMovieCategory({
    ...movie,
    displayTitle: cleanMovieTitle(movie.title || ''),
  }));

  const trendingMovies = allMovies.slice(0, 15);

  const categoryBuckets = buildCategoryBuckets(allMovies);
  const categoryMenu = categoryBuckets.map(category => ({
    slug: category.slug,
    tag: category.tag,
    count: category.count,
  }));

  const haNhanMovies = categoryBuckets.find(category => category.slug === 'ha-nhan')?.movies || [];
  const homeFeaturedMovie = getHomeFeaturedMovie(categoryBuckets, allMovies);
  const homeTrendingMovies = moveMovieToFront(allMovies.slice(0, 15), homeFeaturedMovie);

  function getCategoryBySlug(slug = '') {
    return categoryBuckets.find(category => category.slug === slug) || null;
  }

  function getMovieById(movieId = '') {
    return allMovies.find(movie => movie.id === movieId) || null;
  }

  return {
    allMovies,
    trendingMovies,
    homeTrendingMovies,
    haNhanMovies,
    tagBuckets: categoryBuckets,
    categoryBuckets,
    categoryMenu,
    getCategoryBySlug,
    getMovieById,
    featuredMovie: homeFeaturedMovie,
    homeFeaturedMovie,
  };
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      type: 'Error',
      name: error.name,
      message: error.message,
    };
  }

  if (error === undefined) {
    return { type: 'undefined', message: 'unknown error' };
  }

  if (error === null) {
    return { type: 'null', message: 'null thrown' };
  }

  if (typeof error === 'string') {
    return { type: 'string', message: error };
  }

  try {
    return {
      type: typeof error,
      value: JSON.parse(JSON.stringify(error)),
    };
  } catch {
    return {
      type: typeof error,
      value: String(error),
    };
  }
}

function logDatabaseFallback(error) {
  const databaseTarget = describeDatabaseTarget();
  console.error(`[${new Date().toISOString()}] movie_catalog_db_failed ${JSON.stringify({
    fallback: 'json',
    databaseTarget,
    error: serializeError(error),
  })}`);
}

const getLoadedCatalog = cache(async () => {
  try {
    return buildMovieCatalog(await loadPersistedMovies({ allowJsonFallback: false }));
  } catch (error) {
    logDatabaseFallback(error);
    return buildMovieCatalog(await readMoviesFromJsonFile());
  }
});

export async function getMovieCatalog() {
  return getLoadedCatalog();
}

export async function getAllMovies() {
  return (await getMovieCatalog()).allMovies;
}

export async function getTrendingMovies() {
  return (await getMovieCatalog()).trendingMovies;
}

export async function getHaNhanMovies() {
  return (await getMovieCatalog()).haNhanMovies;
}

export async function getCategoryMenu() {
  return (await getMovieCatalog()).categoryMenu;
}

export async function getCategoryBySlug(slug = '') {
  return (await getMovieCatalog()).getCategoryBySlug(slug);
}

export async function getMovieById(movieId = '') {
  return (await getMovieCatalog()).getMovieById(movieId);
}
