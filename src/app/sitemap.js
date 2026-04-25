import { getMovieCatalog } from '../lib/data.js';
import { buildAbsoluteUrl } from '../lib/seo.js';

export const revalidate = 3600;

export default async function sitemap() {
  const catalog = await getMovieCatalog();
  const categories = catalog.categoryBuckets
    .filter(category => category.count > 0)
    .map(category => ({
      url: buildAbsoluteUrl(`/category/${category.slug}`),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

  const movies = catalog.allMovies.map(movie => ({
    url: buildAbsoluteUrl(`/watch/${movie.id}`),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [
    {
      url: buildAbsoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...categories,
    ...movies,
  ];
}
