import { buildAbsoluteUrl } from '../lib/seo.js';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
  };
}
