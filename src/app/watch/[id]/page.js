import { notFound } from 'next/navigation';
import { getMovieCatalog } from '@/lib/data';
import { getRenderableThumbnail } from '@/lib/thumbnailFilters';
import { buildAbsoluteUrl, buildBreadcrumbJsonLd, buildMetadata, buildVideoJsonLd, toJsonLd } from '@/lib/seo';
import WatchClient from './WatchClient';

export const revalidate = 1800;

export async function generateStaticParams() {
  const catalog = await getMovieCatalog();
  return catalog.allMovies.map(movie => ({ id: movie.id }));
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const movieId = typeof resolvedParams?.id === 'string' ? resolvedParams.id : '';
  const catalog = await getMovieCatalog();
  const movie = catalog.getMovieById(movieId);

  if (!movie) {
    return buildMetadata({
      title: 'Hanhan Movie / Hà Nhân | Không tìm thấy phim',
      description: 'Không tìm thấy phim tương ứng trên Hanhan Movie / Hà Nhân.',
      pathname: `/watch/${movieId}`,
    });
  }

  return buildMetadata({
    title: `Hanhan Movie / Hà Nhân | Xem ${movie.displayTitle || movie.title}`,
    description: `${movie.displayTitle || movie.title} trên Hanhan Movie / Hà Nhân.`,
    pathname: `/watch/${movie.id}`,
    image: getRenderableThumbnail(movie),
    openGraphType: 'video.other',
  });
}

export default async function WatchPage({ params }) {
  const resolvedParams = await params;
  const movieId = typeof resolvedParams?.id === 'string' ? resolvedParams.id : '';
  const catalog = await getMovieCatalog();
  const movie = catalog.getMovieById(movieId);

  if (!movie) {
    notFound();
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: buildAbsoluteUrl('/') },
    { name: movie.tags || 'Phim', url: buildAbsoluteUrl(`/category/${movie.categorySlug || 'khac'}`) },
    { name: movie.displayTitle || movie.title, url: buildAbsoluteUrl(`/watch/${movie.id}`) },
  ]);
  const videoJsonLd = buildVideoJsonLd(movie, `/watch/${movie.id}`);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }} />
      {videoJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(videoJsonLd) }} />}
      <WatchClient key={movie.id} movieId={movie.id} initialMovies={[movie]} />
    </>
  );
}
