"use client";
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MovieCard from '@/components/MovieCard/MovieCard';
import styles from './Search.module.css';

export default function SearchContent() {
  const searchParamsObj = useSearchParams();
  const query = searchParamsObj.get('q') || '';
  const router = useRouter();
  const [movies, setMovies] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMovies() {
      try {
        const response = await fetch('/api/movies', { cache: 'no-store' });
        const payload = await response.json();

        if (!active) return;

        if (response.ok && Array.isArray(payload.movies)) {
          setMovies(payload.movies);
        } else {
          setMovies([]);
        }
      } catch {
        if (active) setMovies([]);
      } finally {
        if (active) setIsLoaded(true);
      }
    }

    loadMovies();

    return () => {
      active = false;
    };
  }, []);

  const results = query
    ? movies.filter(m => {
      const normalizedQuery = query.toLowerCase();
      const rawTitle = (m.title || '').toLowerCase();
      const displayTitle = (m.displayTitle || '').toLowerCase();
      return rawTitle.includes(normalizedQuery) || displayTitle.includes(normalizedQuery);
    })
    : movies;

  if (!isLoaded) {
    return (
      <main className={styles.page}>
        <p className={styles.count}>Đang tải dữ liệu phim...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>
        {query
          ? <>Kết quả cho: <span className="comic-text-yellow">&quot;{query}&quot;</span></>
          : 'TẤT CẢ PHIM'}
      </h1>
      <p className={styles.count}>{results.length} bộ phim tìm được</p>

      {results.length > 0 ? (
        <div className={styles.grid}>
          {results.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>Không tìm thấy phim nào cho &quot;<strong>{query}</strong>&quot;</p>
          <button className="btn-secondary" onClick={() => router.push('/')}>Về Trang Chủ</button>
        </div>
      )}
    </main>
  );
}
