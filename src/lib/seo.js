import { getRenderableThumbnail } from './thumbnailFilters.js';

const DEFAULT_SITE_URL = 'http://localhost:3000';

function normalizeSiteUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return DEFAULT_SITE_URL;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  return `https://${trimmed.replace(/\/+$/, '')}`;
}

function resolveImageUrl(image = '') {
  const trimmed = String(image || '').trim();
  if (!trimmed) return '';
  if (/^(?:https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }

  return buildAbsoluteUrl(trimmed);
}

export const SITE_NAME = 'Hanhan Movie / Hà Nhân';
export const SITE_DESCRIPTION = 'Hanhan Movie / Hà Nhân cập nhật phim theo các bucket hiện có: Xuyên Không, Trọng Sinh, Liễu Như Yên, Hệ Thống và Khác.';

export function getSiteUrl() {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL
  );
}

export function buildAbsoluteUrl(pathname = '/') {
  return new URL(pathname, getSiteUrl()).toString();
}

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  pathname = '/',
  image,
  card = 'summary_large_image',
} = {}) {
  const url = buildAbsoluteUrl(pathname);
  const resolvedImage = resolveImageUrl(image);
  const images = resolvedImage ? [{ url: resolvedImage, alt: title || SITE_NAME }] : undefined;

  return {
    title: title || SITE_NAME,
    description,
    alternates: { canonical: pathname },
    openGraph: {
      type: 'website',
      locale: 'vi_VN',
      url,
      siteName: SITE_NAME,
      title: title || SITE_NAME,
      description,
      images,
    },
    twitter: {
      card: images ? card : 'summary',
      title: title || SITE_NAME,
      description,
      images: images?.map(({ url: imageUrl }) => imageUrl),
    },
  };
}

export function toJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildBreadcrumbJsonLd(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildItemListJsonLd(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: buildAbsoluteUrl('/'),
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${buildAbsoluteUrl('/search')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildVideoJsonLd(movie, pathname) {
  if (!movie) return null;

  const thumbnailUrl = resolveImageUrl(getRenderableThumbnail(movie));

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: movie.displayTitle || movie.title,
    description: `${movie.displayTitle || movie.title} trên ${SITE_NAME}`,
    thumbnailUrl: thumbnailUrl ? [thumbnailUrl] : undefined,
    url: buildAbsoluteUrl(pathname),
    embedUrl: `https://www.youtube.com/embed/${movie.id}`,
    isFamilyFriendly: true,
  };
}
