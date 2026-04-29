import { notFound } from 'next/navigation';
import { getMovieCatalog } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';
import WatchClient from '@/app/watch/[id]/WatchClient';

export const revalidate = 300;

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
      title: 'Hanhan Mini Popup | Hanhan Movie / Hà Nhân',
      description: 'Cửa sổ tách rời cho Hanhan Movie / Hà Nhân, tương thích với helper ghim Windows.',
      pathname: `/watch-popout/${movieId}`,
    });
  }

  return buildMetadata({
    title: `Hanhan Mini Popup | ${movie.displayTitle || movie.title}`,
    description: `${movie.displayTitle || movie.title} trong cửa sổ tách rời của Hanhan Movie / Hà Nhân, với title khớp helper ghim Windows.`,
    pathname: `/watch-popout/${movie.id}`,
    image: movie.thumbnail,
  });
}

export default async function WatchPopoutPage({ params, searchParams }) {
  const resolvedParams = await params;
  const movieId = typeof resolvedParams?.id === 'string' ? resolvedParams.id : '';
  const catalog = await getMovieCatalog();
  const movie = catalog.getMovieById(movieId);

  if (!movie) {
    notFound();
  }

  const parsedStartTime = Number(searchParams?.t);
  const popupStartTime = Number.isFinite(parsedStartTime) && parsedStartTime > 0 ? parsedStartTime : 0;
  const popupShouldPlay = searchParams?.playing !== '0';

  return (
    <WatchClient
      key={movie.id}
      movieId={movie.id}
      initialMovies={[movie]}
      popupMode
      popupStartTime={popupStartTime}
      popupShouldPlay={popupShouldPlay}
    />
  );
}
