import { ensureFreshMovieSnapshot } from './movieStore.server.js';
import { buildCategoryBuckets, normalizeMovieCategory } from './movieCategories.js';
import { getRenderableThumbnail } from './thumbnailFilters.js';

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

function findHiddenMovieTitleMarker(title = '') {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return '';

  const titleKeywords = [
    'trailer',
    'teaser',
    'clip',
    'recap',
    'highlight',
    'summary',
    'shorts',
    'reaction',
    'tóm tắt',
    'tom tat',
    'review',
    'phim ngắn',
    'phim ngan',
  ];

  const keyword = titleKeywords.find(candidate => normalizedTitle.includes(normalizeText(candidate)));
  if (keyword) {
    return keyword;
  }

  const episodeRangePatterns = [
    /\b(?:ep|episode|tap)\s*\d+\s*[-–~]\s*\d+\b/i,
    /\b(?:ep|episode|tap)\s*\d+\s*(?:to|den|->)\s*\d+\b/i,
  ];

  const episodeRange = episodeRangePatterns.find(pattern => pattern.test(normalizedTitle));
  return episodeRange ? 'episode-range' : '';
}

function shouldIncludeCatalogMovie(movie = {}) {
  if (!movie?.id) return false;

  if ((movie.type && movie.type !== 'full') || Number.isFinite(movie.episodeNumber) || Boolean(movie.seriesKey)) {
    return false;
  }

  return !findHiddenMovieTitleMarker(movie.title || '');
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

function resolveCatalogMovie(movie = {}) {
  const normalizedMovie = normalizeMovieCategory({
    ...movie,
    displayTitle: cleanMovieTitle(movie.title || ''),
  });

  return {
    ...normalizedMovie,
    thumbnail: getRenderableThumbnail(normalizedMovie),
  };
}

function getHomeFeaturedMovie(categoryBuckets, allMovies) {
  const haNhanBucket = categoryBuckets.find(category => category.slug === 'ha-nhan');
  const directHaNhanMovie = haNhanBucket?.movies?.[0] || null;

  return directHaNhanMovie || allMovies[0] || null;
}

export function buildMovieCatalog(movies = [], snapshotMeta = {}) {
  const allMovies = movies.filter(shouldIncludeCatalogMovie).map(resolveCatalogMovie);

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
    generatedAt: snapshotMeta.generatedAt || null,
    snapshotSource: snapshotMeta.source || null,
  };
}

let catalogLoadPromise = null;

async function loadMovieCatalog() {
  const snapshot = await ensureFreshMovieSnapshot();
  return buildMovieCatalog(snapshot.movies, snapshot);
}

export async function getMovieCatalog() {
  if (!catalogLoadPromise) {
    catalogLoadPromise = loadMovieCatalog().finally(() => {
      catalogLoadPromise = null;
    });
  }

  return catalogLoadPromise;
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
