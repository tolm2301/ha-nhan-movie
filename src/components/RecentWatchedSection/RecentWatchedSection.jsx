"use client";

import { useSyncExternalStore } from 'react';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import { getCleanWatchedHistory, removeWatchedMovie } from '@/lib/watchHistory';

const EMPTY_SNAPSHOT = [];
let cachedSnapshot = EMPTY_SNAPSHOT;

function isSameHistory(a = [], b = []) {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i]?.id !== b[i]?.id ||
      a[i]?.watchedAt !== b[i]?.watchedAt ||
      a[i]?.thumbnail !== b[i]?.thumbnail ||
      a[i]?.title !== b[i]?.title ||
      a[i]?.displayTitle !== b[i]?.displayTitle
    ) {
      return false;
    }
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
  const next = getCleanWatchedHistory(20);
  if (!isSameHistory(next, cachedSnapshot)) {
    cachedSnapshot = next;
  }
  return cachedSnapshot;
}

export default function RecentWatchedSection() {
  const watchedMovies = useSyncExternalStore(subscribeWatchedHistory, getWatchedSnapshot, () => EMPTY_SNAPSHOT);
  if (watchedMovies.length === 0) return null;

  return (
    <MovieCarousel
      title="Tiếp Tục Xem"
      movies={watchedMovies}
      onRemoveMovie={removeWatchedMovie}
      removeMovieLabel="Xóa khỏi danh sách tiếp tục xem"
    />
  );
}