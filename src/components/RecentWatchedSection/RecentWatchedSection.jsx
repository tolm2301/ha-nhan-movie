"use client";
import { useEffect, useState } from 'react';
import MovieCarousel from '@/components/MovieCarousel/MovieCarousel';
import { getWatchedHistory } from '@/lib/watchHistory';

export default function RecentWatchedSection() {
  const [watchedMovies, setWatchedMovies] = useState(() => getWatchedHistory(20));

  useEffect(() => {
    const onStorage = () => {
      setWatchedMovies(getWatchedHistory(20));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (watchedMovies.length === 0) return null;

  return <MovieCarousel title="🕘 Đã xem gần đây" movies={watchedMovies} />;
}
