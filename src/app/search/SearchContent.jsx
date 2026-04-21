"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import { allMovies } from '@/lib/data';
import MovieCard from '@/components/MovieCard/MovieCard';
import styles from './Search.module.css';

export default function SearchContent() {
  const searchParamsObj = useSearchParams();
  const query = searchParamsObj.get('q') || '';
  const router = useRouter();

  const results = query
    ? allMovies.filter(m => m.title.toLowerCase().includes(query.toLowerCase()))
    : allMovies;

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>
        {query
          ? <>Kết quả cho: <span className="comic-text-yellow">"{query}"</span></>
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
          <p>Không tìm thấy phim nào cho "<strong>{query}</strong>"</p>
          <button className="btn-secondary" onClick={() => router.push('/')}>Về Trang Chủ</button>
        </div>
      )}
    </main>
  );
}
