import { allMovies } from '@/lib/data';
import MovieCard from '@/components/MovieCard/MovieCard';
import styles from './Category.module.css';

// Map type -> config
const CATEGORY_CONFIG = {
  'tien-hiep': {
    title: 'Tiên Hiệp Ngoại Truyện',
    emoji: '🎬',
    filter: m => m.tags === 'Tiên Hiệp 3D',
    fallback: null,
  },
  'he-thong': {
    title: 'Hệ Thống Vô Địch',
    emoji: '🎮',
    filter: m => m.tags === 'Hệ Thống',
    fallback: null,
  },
  'tau-hai': {
    title: 'Gấu Tấu Hài',
    emoji: '🐼',
    filter: m => m.tags === 'Tấu Hài',
    fallback: null,
  },
  'xuyen-khong': {
    title: 'Xuyên Không',
    emoji: '⚡',
    filter: m => m.tags === 'Xuyên Không',
    fallback: null,
  },
};

export default async function CategoryPage({ params }) {
  const resolvedParams = await params;
  const categoryType = resolvedParams?.type || '';
  const config = CATEGORY_CONFIG[categoryType];

  if (!config) {
    return <main style={{ padding: '100px 24px', textAlign: 'center' }}>
      <h1>Danh mục không tồn tại</h1>
    </main>;
  }

  let movies = allMovies.filter(config.filter);
  // If not enough, use fallback
  if (movies.length < 5 && config.fallback) {
    movies = allMovies.filter(config.fallback);
  }
  // Last resort: show all
  if (movies.length === 0) movies = allMovies;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <span className={styles.emoji}>{config.emoji}</span>
        <h1 className={styles.title}>{config.title}</h1>
        <p className={styles.count}>{movies.length} bộ phim</p>
      </div>

      <div className={styles.grid}>
        {movies.map(movie => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </main>
  );
}
