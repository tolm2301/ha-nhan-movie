import { notFound } from 'next/navigation';
import { getCategoryBySlug, getCategoryMenu } from '@/lib/data';
import { getRenderableThumbnail } from '@/lib/thumbnailFilters';
import Link from 'next/link';
import MovieCard from '@/components/MovieCard/MovieCard';
import AdSlot from '@/components/Adsense/AdSlot';
import styles from './Category.module.css';
import { buildBreadcrumbJsonLd, buildItemListJsonLd, buildMetadata, buildAbsoluteUrl, toJsonLd } from '@/lib/seo';

export const revalidate = 1800;

const PAGE_SIZE = 24;

export async function generateStaticParams() {
  const categoryMenu = await getCategoryMenu();
  return categoryMenu.map(category => ({ type: category.slug }));
}

export async function generateMetadata({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categoryType = resolvedParams?.type || '';
  const category = await getCategoryBySlug(categoryType);

  if (!category) {
    return buildMetadata({
      title: 'Hanhan Movie / Hà Nhân | Danh mục không tồn tại',
      description: 'Danh mục không tồn tại trên Hanhan Movie / Hà Nhân.',
      pathname: `/category/${categoryType}`,
    });
  }

  const requestedPage = Number.parseInt(resolvedSearchParams?.page || '1', 10);
  const totalPages = Math.max(1, Math.ceil(category.movies.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
  const pagePath = currentPage > 1 ? `/category/${category.slug}?page=${currentPage}` : `/category/${category.slug}`;
  const pageMovies = category.movies.slice((currentPage - 1) * PAGE_SIZE, (currentPage - 1) * PAGE_SIZE + PAGE_SIZE);
  const movieCountText = `${category.count} video`;

  return buildMetadata({
    title: `Hanhan Movie / Hà Nhân | ${category.tag} - Xem phim`,
    description: `Khám phá ${movieCountText} ${category.tag.toLowerCase()} đang có trên Hanhan Movie / Hà Nhân${currentPage > 1 ? `, trang ${currentPage}/${totalPages}` : ''}.`,
    pathname: pagePath,
    image: pageMovies[0] ? getRenderableThumbnail(pageMovies[0]) : undefined,
  });
}

export default async function CategoryPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categoryType = resolvedParams?.type || '';
  const category = await getCategoryBySlug(categoryType);

  if (!category) {
    notFound();
  }

  const requestedPage = Number.parseInt(resolvedSearchParams?.page || '1', 10);
  const totalPages = Math.max(1, Math.ceil(category.movies.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageMovies = category.movies.slice(startIndex, startIndex + PAGE_SIZE);
  const pageBaseHref = `/category/${category.slug}`;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: buildAbsoluteUrl('/') },
    { name: category.tag, url: buildAbsoluteUrl(currentPage > 1 ? `${pageBaseHref}?page=${currentPage}` : pageBaseHref) },
  ]);
  const itemListJsonLd = buildItemListJsonLd(pageMovies.map(movie => ({
    name: movie.displayTitle || movie.title,
    url: buildAbsoluteUrl(`/watch/${movie.id}`),
  })));

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(itemListJsonLd) }} />
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
