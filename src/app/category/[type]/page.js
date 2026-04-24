import { getCategoryBySlug } from '@/lib/data';
import MovieCard from '@/components/MovieCard/MovieCard';
import styles from './Category.module.css';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }) {
  const resolvedParams = await params;
  const categoryType = resolvedParams?.type || '';
  const category = await getCategoryBySlug(categoryType);

  if (!category) {
    return <main style={{ padding: '100px 24px', textAlign: 'center' }}>
      <h1>Danh mục không tồn tại</h1>
    </main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <span className={styles.emoji}>🏷️</span>
        <h1 className={styles.title}>{category.tag}</h1>
        <p className={styles.count}>{category.count} video</p>
      </div>

      <div className={styles.grid}>
        {category.movies.map(movie => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </main>
  );
}
