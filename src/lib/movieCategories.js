const CATEGORY_DEFINITIONS = [
  {
    slug: 'ha-nhan',
    tag: 'Hà Nhân',
    keywords: ['ha nhan', 'hanhan'],
  },
  {
    slug: 'xuyen-khong',
    tag: 'Xuyên Không',
    keywords: ['xuyen khong'],
  },
  {
    slug: 'trong-sinh',
    tag: 'Trọng Sinh',
    keywords: ['trong sinh'],
  },
  {
    slug: 'lieu-nhu-yen',
    tag: 'Liễu Như Yên',
    keywords: ['lieu nhu yen'],
  },
  {
    slug: 'he-thong',
    tag: 'Hệ Thống',
    keywords: ['he thong'],
  },
  {
    slug: 'khac',
    tag: 'Khác',
    keywords: [],
  },
];

const CATEGORY_BY_SLUG = new Map(CATEGORY_DEFINITIONS.map(category => [category.slug, category]));
const CATEGORY_BY_TAG = new Map(CATEGORY_DEFINITIONS.map(category => [normalizeText(category.tag), category]));
const HE_THONG_LEGACY_KEYWORDS = ['hoat hinh ai', 'phim hoat hinh ai', 'ai trung quoc', 'trung quoc ai', 'chinese ai', 'animated ai'];

function normalizeText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasKeyword(text, keyword) {
  return text.includes(keyword);
}

function matchesHeThongCategory(text, rawTag) {
  if (CATEGORY_BY_TAG.has(rawTag)) {
    return CATEGORY_BY_TAG.get(rawTag)?.slug === 'he-thong';
  }

  if (rawTag === 'ai') {
    return true;
  }

  return hasKeyword(text, 'he thong') || HE_THONG_LEGACY_KEYWORDS.some(keyword => text.includes(keyword));
}

function matchesHaNhanCategory(titleText = '') {
  return CATEGORY_DEFINITIONS[0].keywords.some(keyword => hasKeyword(titleText, keyword));
}

export function getCategoryDefinitionBySlug(slug = '') {
  return CATEGORY_BY_SLUG.get(slug) || null;
}

export function resolveMovieCategory(movie = {}) {
  const titleText = normalizeText(movie.title || '');
  const tagText = normalizeText(movie.tags || movie.category || '');
  const combinedText = `${titleText} ${tagText}`.trim();
  const taggedCategory = CATEGORY_BY_TAG.get(tagText) || null;

  if (matchesHaNhanCategory(titleText)) {
    return CATEGORY_BY_SLUG.get('ha-nhan');
  }

  if (matchesHeThongCategory(combinedText, tagText)) {
    return CATEGORY_BY_SLUG.get('he-thong');
  }

  if (hasKeyword(combinedText, 'lieu nhu yen')) {
    return CATEGORY_BY_SLUG.get('lieu-nhu-yen');
  }

  if (hasKeyword(combinedText, 'trong sinh')) {
    return CATEGORY_BY_SLUG.get('trong-sinh');
  }

  if (hasKeyword(combinedText, 'xuyen khong')) {
    return CATEGORY_BY_SLUG.get('xuyen-khong');
  }

  if (taggedCategory && taggedCategory.slug !== 'ha-nhan') {
    return taggedCategory;
  }

  return CATEGORY_BY_SLUG.get('khac');
}

export function normalizeMovieCategory(movie = {}) {
  const category = resolveMovieCategory(movie);

  return {
    ...movie,
    tags: category.tag,
    categorySlug: category.slug,
  };
}

export function buildCategoryBuckets(movies = []) {
  return CATEGORY_DEFINITIONS.map(category => {
    const bucketMovies = movies.filter(movie => resolveMovieCategory(movie).slug === category.slug);

    return {
      ...category,
      movies: bucketMovies,
      count: bucketMovies.length,
    };
  });
}

export { CATEGORY_DEFINITIONS, normalizeText };
