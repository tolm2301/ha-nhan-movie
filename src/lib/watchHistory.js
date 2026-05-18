import { hasRenderableThumbnail } from './thumbnailFilters.js';

const WATCHED_HISTORY_KEY = 'hanhan:watched-history';
const WATCH_PROGRESS_KEY = 'hanhan:watch-progress';

const BAD_TITLE_KEYWORDS = [
  'trailer',
  'teaser',
  'clip',
  'recap',
  'highlight',
  'summary',
  'shorts',
  'reaction',
  'review',
  'tóm tắt',
  'tom tat',
  'phim ngắn',
  'phim ngan',
];
const SINGLE_EPISODE_PATTERN = /\b(?:ep|episode|tap|tập|phan|phần)\s*\d{1,4}\b/i;
const EPISODE_RANGE_PATTERNS = [
  /\b(?:ep|episode|tap|tập|phan|phần)\s*\d+\s*[-–~]\s*\d+\b/i,
  /\b(?:ep|episode|tap|tập|phan|phần)\s*\d+\s*(?:to|den|đến|->)\s*\d+\b/i,
];
const COMPILATION_RANGE_PATTERNS = [
  /\bfull\b(?:\s+(?:dai|dài|tron bo|trọn bộ|series|collection|compilation|combo|part|tap|tập|episode|ep))?(?:\s+[^\d]{0,18})?\s*\d+\s*[-–~]\s*\d+\b/i,
  /\b(?:tron bo|trọn bộ|collection|compilation|combo)\b.*\b\d+\s*[-–~]\s*\d+\b/i,
];

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getWatchedTitle(movie = {}) {
  return String(movie.displayTitle || movie.title || '').trim();
}

function findBadTitleMarker(title = '') {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return 'missing-title';

  const keyword = BAD_TITLE_KEYWORDS.find(candidate => normalizedTitle.includes(normalizeText(candidate)));
  if (keyword) return keyword;

  if (SINGLE_EPISODE_PATTERN.test(normalizedTitle)) return 'episode';
  if (EPISODE_RANGE_PATTERNS.some(pattern => pattern.test(normalizedTitle))) return 'episode-range';
  if (COMPILATION_RANGE_PATTERNS.some(pattern => pattern.test(normalizedTitle))) return 'full-range';

  return '';
}

function shouldKeepWatchedHistoryItem(movie = {}) {
  if (!movie?.id) return false;
  if ((movie.type && movie.type !== 'full') || Number.isFinite(movie.episodeNumber) || Boolean(movie.seriesKey)) return false;

  const title = getWatchedTitle(movie);
  if (!title) return false;
  if (findBadTitleMarker(title)) return false;

  return hasRenderableThumbnail(movie);
}

function sanitizeWatchedHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.filter(shouldKeepWatchedHistoryItem);
}

export function getCleanWatchedHistory(limit = 20) {
  const history = readStorage(WATCHED_HISTORY_KEY, []);
  if (!Array.isArray(history)) return [];

  return sanitizeWatchedHistory(history).slice(0, limit);
}

function isSameWatchedHistory(next = [], prev = []) {
  if (next === prev) return true;
  if (!Array.isArray(next) || !Array.isArray(prev)) return false;
  if (next.length !== prev.length) return false;

  for (let i = 0; i < next.length; i += 1) {
    if (next[i]?.id !== prev[i]?.id) return false;
    if (next[i]?.watchedAt !== prev[i]?.watchedAt) return false;
  }

  return true;
}

function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors.
  }
}

function notifyWatchedHistoryUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('hanhan:watched-history-updated'));
}

export function getWatchedHistory(limit = 20) {
  return getCleanWatchedHistory(limit);
}

export function cleanupWatchedHistory() {
  const history = readStorage(WATCHED_HISTORY_KEY, []);
  const cleanedHistory = sanitizeWatchedHistory(history);

  if (!isSameWatchedHistory(cleanedHistory, history)) {
    writeStorage(WATCHED_HISTORY_KEY, cleanedHistory);
    notifyWatchedHistoryUpdated();
  }

  return cleanedHistory;
}

export function pushWatchedMovie(movie) {
  if (!movie?.id) return;
  if (!shouldKeepWatchedHistoryItem(movie)) return;

  const history = readStorage(WATCHED_HISTORY_KEY, []);
  const safeHistory = Array.isArray(history) ? history : [];
  const nextItem = {
    id: movie.id,
    title: movie.title || '',
    displayTitle: movie.displayTitle || movie.title || '',
    thumbnail: movie.thumbnail || '',
    views: movie.views || '0 views',
    episodes: movie.episodes || 'Full',
    tags: movie.tags || 'Khác',
    watchedAt: Date.now(),
  };

  const deduped = safeHistory.filter(item => item?.id !== movie.id);
  const nextHistory = [nextItem, ...deduped].slice(0, 30);
  writeStorage(WATCHED_HISTORY_KEY, nextHistory);
  notifyWatchedHistoryUpdated();
}

export function getWatchProgress(videoId) {
  if (!videoId) return null;

  const allProgress = readStorage(WATCH_PROGRESS_KEY, {});
  if (!allProgress || typeof allProgress !== 'object') return null;

  const entry = allProgress[videoId];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

export function setWatchProgress(videoId, positionSec, durationSec) {
  if (!videoId) return;
  if (!Number.isFinite(positionSec) || positionSec < 0) return;

  const allProgress = readStorage(WATCH_PROGRESS_KEY, {});
  const safeProgress = allProgress && typeof allProgress === 'object' ? allProgress : {};

  safeProgress[videoId] = {
    positionSec: Math.floor(positionSec),
    durationSec: Number.isFinite(durationSec) ? Math.floor(durationSec) : 0,
    updatedAt: Date.now(),
  };

  writeStorage(WATCH_PROGRESS_KEY, safeProgress);
}
