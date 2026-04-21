"use client";
import { useSyncExternalStore } from 'react';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import { getWatchedHistory } from '@/lib/watchHistory';

const EMPTY_SNAPSHOT = [];
let cachedSnapshot = EMPTY_SNAPSHOT;

function isSameHistory(next, prev) {
  if (next === prev) return true;
  if (!Array.isArray(next) || !Array.isArray(prev)) return false;
  if (next.length !== prev.length) return false;

  for (let i = 0; i < next.length; i += 1) {
    if (next[i]?.id !== prev[i]?.id) return false;
    if (next[i]?.watchedAt !== prev[i]?.watchedAt) return false;
  }

  return true;
}

function subscribeWatchedHistory(callback) {
  if (typeof window === 'undefined') return () => {};

  const onStorage = event => {
    if (!event.key || event.key === 'hanhan:watched-history') {
      callback();
    }
  };

  const onWatchedUpdated = () => callback();

  window.addEventListener('storage', onStorage);
  window.addEventListener('hanhan:watched-history-updated', onWatchedUpdated);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('hanhan:watched-history-updated', onWatchedUpdated);
  };
}

function getWatchedSnapshot() {
  const next = getWatchedHistory(20);
  if (!isSameHistory(next, cachedSnapshot)) {
    cachedSnapshot = next;
  }
  return cachedSnapshot;
}

export default function RecentWatchedSection() {
  const watchedMovies = useSyncExternalStore(subscribeWatchedHistory, getWatchedSnapshot, () => EMPTY_SNAPSHOT);
  if (watchedMovies.length === 0) return null;

  return <MovieCarousel title="🕘 Đã xem gần đây" movies={watchedMovies} />;
}
