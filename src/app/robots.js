import { buildAbsoluteUrl } from '../lib/seo.js';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/watch-popout'],
      },
    ],
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
  };
}
