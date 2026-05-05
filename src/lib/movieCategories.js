const CATEGORY_TAXONOMY = [
  {
    slug: 'ha-nhan',
    tag: 'Hà Nhân',
    core: ['Ha Nhân', 'Hà Nhân', 'Hanhan'],
    expanded: ['Hà Nhân sub', 'Hà Nhân vietsub', 'Ha Nhan sub', 'Ha Nhan vietsub', 'Hà Nhân phim', 'Ha Nhan phim', 'Hà Nhân full', 'Ha Nhan full', 'Hà Nhân series', 'Ha Nhan series', 'Hà Nhân tập', 'Ha Nhan tap'],
    fallbackOnly: ['phim Hà Nhân', 'full Hà Nhân', 'series Hà Nhân', 'tập Hà Nhân', 'vietsub Hà Nhân', 'sub Hà Nhân'],
    riskyCaps: ['phim', 'full', 'series', 'vietsub'],
  },
  {
    slug: 'tu-tien',
    tag: 'Tu Tiên',
    core: ['Tu Tiên', 'Tu Tien', 'Tiên Hiệp', 'Tien Hiep'],
    expanded: ['Tu Tiên sub', 'Tu Tiên vietsub', 'Tu Tiên phim', 'Tu Tiên full', 'Tu Tiên series', 'Tu Tiên tập', 'Tu Tien sub', 'Tu Tien vietsub', 'Tu Tien phim', 'Tu Tien full', 'Tu Tien series', 'Tu Tien tap', 'Tiên Hiệp sub', 'Tiên Hiệp vietsub', 'Phàm Nhân', 'Phế Vật', 'Đấu Phá', 'Tiên Nghịch', 'Thôn Thiên Ký', 'Thế Giới Hoàn Mỹ', 'Trường Sinh Giới', 'Thần Mộ', 'Yêu Thần Ký', 'Tiên Võ Truyện', 'Già Thiên', 'Tiên Sinh Bất Tử', 'Tiên Vương', 'Thiên Đô Dị Lục', 'Võ Thần Chúa Tể', 'Đồ Đệ Của Ta Đều Là Đại Lão', 'Ta Có Thể Giác Ngộ Vô Hạn', 'Tiến Hóa Siêu Phàm', 'Thăng Cấp Mạnh Nhất', 'Thương Nguyên Đồ', 'Cửu Dạ Thần Truyện', 'Nhất Thế Độc Tôn'],
    fallbackOnly: ['phim Tu Tiên', 'full Tu Tiên', 'series Tu Tiên', 'tập Tu Tiên', 'vietsub Tu Tiên', 'sub Tu Tiên'],
    riskyCaps: ['phim', 'full', 'series', 'vietsub'],
  },
  {
    slug: 'xuyen-khong',
    tag: 'Xuyên Không',
    core: ['Xuyên Không', 'Xuyen Khong'],
    expanded: ['Xuyên Không sub', 'Xuyên Không vietsub', 'Xuyên Không phim', 'Xuyên Không full', 'Xuyên Không series', 'Xuyên Không tập', 'Xuyen Khong sub', 'Xuyen Khong vietsub', 'Xuyen Khong phim', 'Xuyen Khong full', 'Xuyen Khong series', 'Xuyen Khong tap', 'Xuyên Sách', 'Xuyên Qua', 'Xuyên Vào', 'Xuyên Thành', 'Xuyên Về', 'Xuyên Việt', 'Xuyên Sang', 'Xuyên Làm'],
    fallbackOnly: ['phim Xuyên Không', 'full Xuyên Không', 'series Xuyên Không', 'tập Xuyên Không', 'vietsub Xuyên Không', 'sub Xuyên Không'],
    riskyCaps: ['phim', 'full', 'series', 'vietsub'],
  },
  {
    slug: 'trong-sinh',
    tag: 'Trọng Sinh',
    core: ['Trọng Sinh', 'Trong Sinh'],
    expanded: ['Trọng Sinh sub', 'Trọng Sinh vietsub', 'Trọng Sinh phim', 'Trọng Sinh full', 'Trọng Sinh series', 'Trọng Sinh tập', 'Trong Sinh sub', 'Trong Sinh vietsub', 'Trong Sinh phim', 'Trong Sinh full', 'Trong Sinh series', 'Trong Sinh tap', 'Trùng Sinh', 'Tái Sinh'],
    fallbackOnly: ['phim Trọng Sinh', 'full Trọng Sinh', 'series Trọng Sinh', 'tập Trọng Sinh', 'vietsub Trọng Sinh', 'sub Trọng Sinh'],
    riskyCaps: ['phim', 'full', 'series', 'vietsub'],
  },
  {
    slug: 'lieu-nhu-yen',
    tag: 'Liễu Như Yên',
    core: ['Liễu Như Yên', 'Lieu Nhu Yen'],
    expanded: ['Liễu Như Yên sub', 'Liễu Như Yên vietsub', 'Liễu Như Yên phim', 'Liễu Như Yên full', 'Liễu Như Yên series', 'Liễu Như Yên tập', 'Lieu Nhu Yen sub', 'Lieu Nhu Yen vietsub', 'Lieu Nhu Yen phim', 'Lieu Nhu Yen full', 'Lieu Nhu Yen series', 'Lieu Nhu Yen tap'],
    fallbackOnly: ['phim Liễu Như Yên', 'full Liễu Như Yên', 'series Liễu Như Yên', 'tập Liễu Như Yên', 'vietsub Liễu Như Yên', 'sub Liễu Như Yên'],
    riskyCaps: ['phim', 'full', 'series', 'vietsub'],
  },
  {
    slug: 'he-thong',
    tag: 'Hệ Thống',
    core: ['Hệ Thống', 'He Thong'],
    expanded: ['Hệ Thống AI', 'He Thong AI', 'Hệ Thống anime', 'He Thong anime', 'Hệ Thống phim', 'He Thong phim', 'Kích Hoạt Hệ Thống', 'Thức Tỉnh Hệ Thống', 'Bật Hệ Thống', 'Có Hệ Thống', 'Nhận Hệ Thống', 'Hệ Thống VIP', 'Hệ Thống Tu Luyện', 'Hệ Thống Điểm Danh', 'Hệ Thống Nhặt Rác', 'Hệ Thống Dọn Rác', 'Hệ Thống Lựa Chọn', 'Hệ Thống Vô Hạn', 'Hệ Thống Thôn Phệ', 'Hệ Thống Triệu Hồi', 'Hệ Thống Ngự Thần', 'Hệ Thống Khế Ước', 'Hệ Thống Độc Quyền', 'xuyên không hệ thống', 'xuyen khong he thong', 'trọng sinh hệ thống', 'trong sinh he thong'],
    fallbackOnly: ['phim hệ thống', 'hệ thống phim', 'anime hệ thống', 'series hệ thống', 'vietsub hệ thống', 'sub hệ thống'],
    riskyCaps: ['system', 'ai', 'anime', 'phim', 'series'],
  },
  {
    slug: 'khac',
    tag: 'Khác',
    core: [],
    expanded: ['phim hoạt hình', 'anime 2d', 'review phim'],
    fallbackOnly: ['vietsub', 'series', 'full'],
    riskyCaps: ['phim', 'anime', 'hoat hinh', 'cartoon'],
  },
];

const CATEGORY_DEFINITIONS = CATEGORY_TAXONOMY.map(category => ({
  slug: category.slug,
  tag: category.tag,
  coreKeywords: category.core.map(normalizeText),
  expandedKeywords: category.expanded.map(normalizeText),
  fallbackOnlyKeywords: category.fallbackOnly.map(normalizeText),
  riskyCaps: category.riskyCaps.map(normalizeText),
  keywords: [...category.core, ...category.expanded, ...category.fallbackOnly].map(normalizeText),
}));

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

function matchesAnyKeyword(text, keywords = []) {
  return keywords.some(keyword => hasKeyword(text, keyword));
}

function matchesHeThongCategory(text, rawTag) {
  if (CATEGORY_BY_TAG.has(rawTag)) {
    return CATEGORY_BY_TAG.get(rawTag)?.slug === 'he-thong';
  }

  if (rawTag === 'ai') {
    return true;
  }

  return matchesAnyKeyword(text, CATEGORY_BY_SLUG.get('he-thong')?.coreKeywords || []) ||
    matchesAnyKeyword(text, CATEGORY_BY_SLUG.get('he-thong')?.expandedKeywords || []) ||
    matchesAnyKeyword(text, CATEGORY_BY_SLUG.get('he-thong')?.fallbackOnlyKeywords || []) ||
    HE_THONG_LEGACY_KEYWORDS.some(keyword => text.includes(keyword));
}

function matchesHaNhanCategory(titleText = '') {
  const category = CATEGORY_BY_SLUG.get('ha-nhan');
  return matchesAnyKeyword(titleText, category?.coreKeywords || []) ||
    matchesAnyKeyword(titleText, category?.expandedKeywords || []) ||
    matchesAnyKeyword(titleText, category?.fallbackOnlyKeywords || []);
}

function matchesCategoryByPriority(text, category) {
  return matchesAnyKeyword(text, category.coreKeywords) ||
    matchesAnyKeyword(text, category.expandedKeywords) ||
    matchesAnyKeyword(text, category.fallbackOnlyKeywords);
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

  if (taggedCategory && taggedCategory.slug !== 'khac') {
    return taggedCategory;
  }

  const orderedSlugs = ['lieu-nhu-yen', 'trong-sinh', 'xuyen-khong', 'he-thong', 'tu-tien'];
  for (const slug of orderedSlugs) {
    const category = CATEGORY_BY_SLUG.get(slug);
    if (!category) continue;

    if (slug === 'he-thong') {
      if (matchesHeThongCategory(combinedText, tagText)) {
        return category;
      }
      continue;
    }

    if (matchesCategoryByPriority(combinedText, category)) {
      return category;
    }
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

export { CATEGORY_DEFINITIONS, CATEGORY_TAXONOMY, normalizeText };
