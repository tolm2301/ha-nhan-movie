import { cache } from 'react';
import { readMoviesFromJsonFile } from './movieStore.server.js';

const HIDDEN_CATEGORY_TAGS = new Set(['Tấu Hài']);
const HA_NHAN_CATEGORY = {
  slug: 'ha-nhan',
  tag: 'Hà Nhân',
};

function slugifyTag(tag) {
  return (tag || 'khac')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

export function buildMovieCatalog(movies = []) {
  const allMovies = movies.map(movie => ({
    ...movie,
    displayTitle: cleanMovieTitle(movie.title || ''),
  }));

  const trendingMovies = allMovies.slice(0, 15);

  const haNhanMovies = allMovies.filter(movie => {
    const title = normalizeText(movie.title || '');
    return title.includes('ha nhan') || title.includes('hanhan');
  });

  const tagMap = new Map();

  for (const movie of allMovies) {
    const rawTag = (movie.tags || 'Khác').trim();
    const tag = rawTag || 'Khác';
    const current = tagMap.get(tag) || [];
    current.push(movie);
    tagMap.set(tag, current);
  }

  const tagBuckets = [...tagMap.entries()]
    .map(([tag, bucketMovies]) => ({
      tag,
      slug: slugifyTag(tag),
      movies: bucketMovies,
      count: bucketMovies.length,
    }))
    .sort((a, b) => b.count - a.count);

  const categoryMenu = tagBuckets
    .filter(category => !HIDDEN_CATEGORY_TAGS.has(category.tag))
    .filter(category => category.count >= 3)
    .slice(0, 8)
    .map(category => ({
      slug: category.slug,
      tag: category.tag,
      count: category.count,
    }));

  if (haNhanMovies.length > 0) {
    const hasExistingHaNhan = categoryMenu.some(category => category.slug === HA_NHAN_CATEGORY.slug);
    if (!hasExistingHaNhan) {
      categoryMenu.unshift({
        ...HA_NHAN_CATEGORY,
        count: haNhanMovies.length,
      });
    }
  }

  function getCategoryBySlug(slug = '') {
    if (slug === HA_NHAN_CATEGORY.slug) {
      return {
        ...HA_NHAN_CATEGORY,
        movies: haNhanMovies,
        count: haNhanMovies.length,
      };
    }

    return tagBuckets.find(category => category.slug === slug && !HIDDEN_CATEGORY_TAGS.has(category.tag)) || null;
  }

  function getMovieById(movieId = '') {
    return allMovies.find(movie => movie.id === movieId) || null;
  }

  return {
    allMovies,
    trendingMovies,
    haNhanMovies,
    tagBuckets,
    categoryMenu,
    getCategoryBySlug,
    getMovieById,
    featuredMovie: haNhanMovies[0] || allMovies[0] || null,
  };
}

const getLoadedCatalog = cache(async () => buildMovieCatalog(await readMoviesFromJsonFile()));

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
