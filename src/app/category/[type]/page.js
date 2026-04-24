import { getCategoryBySlug } from '@/lib/data';
import Link from 'next/link';
import MovieCard from '@/components/MovieCard/MovieCard';
import styles from './Category.module.css';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

export default async function CategoryPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categoryType = resolvedParams?.type || '';
  const category = await getCategoryBySlug(categoryType);

  if (!category) {
    return <main style={{ padding: '100px 24px', textAlign: 'center' }}>
      <h1>Danh mục không tồn tại</h1>
      </main>;
  }

  const requestedPage = Number.parseInt(resolvedSearchParams?.page || '1', 10);
  const totalPages = Math.max(1, Math.ceil(category.movies.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageMovies = category.movies.slice(startIndex, startIndex + PAGE_SIZE);
  const pageBaseHref = `/category/${category.slug}`;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <span className={styles.emoji}>🏷️</span>
        <h1 className={styles.title}>{category.tag}</h1>
        <p className={styles.count}>{category.count} video</p>
        <p className={styles.pageInfo}>Trang {currentPage}/{totalPages}</p>
      </div>

      <div className={styles.grid}>
        {pageMovies.map(movie => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label={`Phân trang ${category.tag}`}>
          <Link
            className={`${styles.pageLink} ${currentPage === 1 ? styles.pageLinkDisabled : ''}`}
            href={`${pageBaseHref}?page=${Math.max(1, currentPage - 1)}`}
            aria-disabled={currentPage === 1}
            tabIndex={currentPage === 1 ? -1 : 0}
          >
            ‹ Trước
          </Link>

          <div className={styles.pageNumbers}>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNumber => (
              <Link
                key={pageNumber}
                className={`${styles.pageLink} ${pageNumber === currentPage ? styles.pageLinkActive : ''}`}
                href={pageNumber === 1 ? pageBaseHref : `${pageBaseHref}?page=${pageNumber}`}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </Link>
            ))}
          </div>

          <Link
            className={`${styles.pageLink} ${currentPage === totalPages ? styles.pageLinkDisabled : ''}`}
            href={`${pageBaseHref}?page=${Math.min(totalPages, currentPage + 1)}`}
            aria-disabled={currentPage === totalPages}
            tabIndex={currentPage === totalPages ? -1 : 0}
          >
            Sau ›
          </Link>
        </nav>
      )}
    </main>
  );
}
