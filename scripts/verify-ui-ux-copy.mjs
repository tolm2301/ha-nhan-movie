import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');

// 1. Verify Dark Cinema CSS tokens in globals.css
const globalsCss = read('src/app/globals.css');
const requiredTokens = [
  '--color-bg',
  '--color-surface',
  '--color-surface-elevated',
  '--color-surface-glass',
  '--color-border',
  '--color-border-hover',
  '--color-text-main',
  '--color-text-muted',
  '--color-text-subtle',
  '--color-accent-red',
  '--color-accent-yellow',
  '--color-accent-blue',
  '--color-accent-jade',
  '--color-accent-gold',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--shadow-card',
  '--shadow-elevated',
];
for (const token of requiredTokens) {
  assert.ok(globalsCss.includes(token), `Missing CSS token in globals.css: ${token}`);
}

// 2. Verify SEO clean domain language (no "bucket" jargon)
const seoJs = read('src/lib/seo.js');
assert.ok(!seoJs.toLowerCase().includes('bucket'), 'src/lib/seo.js must not leak technical "bucket" term');
assert.ok(
  seoJs.includes('Thưởng thức phim hoạt hình 3D, tu tiên, xuyên không và trọng sinh chọn lọc chất lượng cao'),
  'src/lib/seo.js must contain updated SITE_DESCRIPTION'
);

// 3. Verify Hero UX & copywriting
const heroJsx = read('src/components/Hero/Hero.jsx');
assert.ok(!heroJsx.includes('isBookmarked'), 'Hero.jsx must not contain dead local bookmark state');
assert.ok(heroJsx.includes('Tâm Điểm Hôm Nay'), 'Hero.jsx must display "Tâm Điểm Hôm Nay" badge');
assert.ok(heroJsx.includes('▶ Xem Ngay'), 'Hero.jsx must display "▶ Xem Ngay" primary CTA');
assert.ok(heroJsx.includes('Khám Phá Thể Loại'), 'Hero.jsx must display "Khám Phá Thể Loại" secondary CTA');

// 4. Verify Header active route & mobile drawer UX
const headerJsx = read('src/components/Header/Header.jsx');
assert.ok(headerJsx.includes('usePathname'), 'Header.jsx must use usePathname for active link state');
assert.ok(headerJsx.includes('aria-current'), 'Header.jsx must set aria-current on active nav item');
assert.ok(headerJsx.includes('Escape'), 'Header.jsx must support Escape key to close mobile drawer');
assert.ok(headerJsx.includes('styles.backdrop'), 'Header.jsx must render mobile backdrop overlay');

// 5. Verify CopywritingCatalog across Home, RecentWatched, Carousel, Category, Search, Watch
const homeJsx = read('src/app/HomeContent.jsx');
assert.ok(homeJsx.includes('title="Mới Cập Nhật"'), 'HomeContent.jsx must use "Mới Cập Nhật"');

const recentJsx = read('src/components/RecentWatchedSection/RecentWatchedSection.jsx');
assert.ok(recentJsx.includes('title="Tiếp Tục Xem"'), 'RecentWatchedSection.jsx must use "Tiếp Tục Xem"');

const carouselJsx = read('src/components/MovieCarousel/MovieCarousel.jsx');
assert.ok(carouselJsx.includes('Xem tất cả ›'), 'MovieCarousel.jsx must use "Xem tất cả ›"');

const categoryJsx = read('src/app/category/[type]/CategoryContent.jsx');
assert.ok(categoryJsx.includes('bộ phim'), 'CategoryContent.jsx must display "{total} bộ phim"');

const searchJsx = read('src/app/search/SearchContent.jsx');
assert.ok(searchJsx.includes('Khám Phá & Tìm Kiếm Phim'), 'SearchContent.jsx must display "Khám Phá & Tìm Kiếm Phim"');
assert.ok(searchJsx.includes('bộ phim phù hợp'), 'SearchContent.jsx must display matching movies count');

const watchJsx = read('src/app/watch/[id]/WatchClient.jsx');
assert.ok(watchJsx.includes('Danh Sách Tập'), 'WatchClient.jsx must display "Danh Sách Tập"');
assert.ok(watchJsx.includes('Phim Cùng Thể Loại Đề Xuất'), 'WatchClient.jsx must display "Phim Cùng Thể Loại Đề Xuất"');
assert.ok(!watchJsx.includes('Chua co du lieu phim de phat'), 'WatchClient.jsx must not contain unaccented Vietnamese error text');

console.log('✓ All UI, UX, and Copywriting contract checks passed.');