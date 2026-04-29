import { getMovieCatalog } from '@/lib/data';
import SearchContent from './SearchContent';

export const metadata = {
  title: 'Hanhan Movie / Hà Nhân | Tìm kiếm',
  robots: {
    index: false,
    follow: false,
  },
};

export const revalidate = 300;

export default async function SearchPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const catalog = await getMovieCatalog();
  const query = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q : '';

  return (
    <SearchContent query={query} movies={catalog.allMovies} />
  );
}
