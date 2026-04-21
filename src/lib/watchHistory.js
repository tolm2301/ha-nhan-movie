const WATCHED_HISTORY_KEY = 'hanhan:watched-history';
const WATCH_PROGRESS_KEY = 'hanhan:watch-progress';

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
  const history = readStorage(WATCHED_HISTORY_KEY, []);
  if (!Array.isArray(history)) return [];
  return history.slice(0, limit);
}

export function pushWatchedMovie(movie) {
  if (!movie?.id) return;

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
