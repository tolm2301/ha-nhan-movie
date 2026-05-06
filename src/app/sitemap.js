import { getMovieCatalog } from '../lib/data.js';
import { buildAbsoluteUrl } from '../lib/seo.js';

export const revalidate = 3600;

function resolveLastModified(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

export default async function sitemap() {
  const catalog = await getMovieCatalog();
  const lastModified = resolveLastModified(catalog.generatedAt);

  const categories = catalog.categoryBuckets
    .filter(category => category.count > 0)
    .map(category => ({
      url: buildAbsoluteUrl(`/category/${category.slug}`),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

  const movies = catalog.allMovies
    .filter(movie => movie.id)
    .map(movie => ({
      url: buildAbsoluteUrl(`/watch/${movie.id}`),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  return [
    {
      url: buildAbsoluteUrl('/'),
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...categories,
    ...movies,
  ];
}
