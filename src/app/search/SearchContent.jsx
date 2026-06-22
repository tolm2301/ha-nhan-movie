import Link from 'next/link';
import MovieCard from '@/components/MovieCard/MovieCard';
import AdSlot from '@/components/Adsense/AdSlot';
import styles from './Search.module.css';

function normalizeSearchText(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactSearchText(value = '') {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

function getSearchFields(movie) {
  return [
    movie?.title,
    movie?.displayTitle,
    movie?.tags,
    movie?.category,
    movie?.categorySlug,
    movie?.seriesKey,
    movie?.episodes,
    movie?.episodeLabel,
  ]
    .map(value => (value == null ? '' : String(value)))
    .filter(Boolean);
}

function getMatchScore(movie, normalizedQuery, compactQuery) {
  let bestScore = Number.POSITIVE_INFINITY;

  for (const field of getSearchFields(movie)) {
    const normalizedField = normalizeSearchText(field);
    if (!normalizedField) continue;

    const compactField = normalizedField.replace(/\s+/g, '');
    const directMatch = normalizedField.includes(normalizedQuery) || compactField.includes(compactQuery);
    if (!directMatch) continue;

    let score = 2;
    if (normalizedField === normalizedQuery || compactField === compactQuery) {
      score = 0;
    } else if (field === movie?.title || field === movie?.displayTitle) {
      score = 0;
    } else if (field === movie?.tags || field === movie?.category || field === movie?.categorySlug) {
      score = 1;
    }

    bestScore = Math.min(bestScore, score);
  }

  return Number.isFinite(bestScore) ? bestScore : null;
}

export default function SearchContent({ query = '', movies = [] }) {
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = compactSearchText(query);
  const hasQuery = Boolean(normalizedQuery);

  const results = hasQuery
    ? movies
        .map(movie => {
          const matchScore = getMatchScore(movie, normalizedQuery, compactQuery);
          return matchScore === null ? null : { movie, matchScore };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;

          const aTitle = normalizeSearchText(a.movie?.displayTitle || a.movie?.title || '');
          const bTitle = normalizeSearchText(b.movie?.displayTitle || b.movie?.title || '');
          const aStarts = aTitle.startsWith(normalizedQuery) ? 0 : 1;
          const bStarts = bTitle.startsWith(normalizedQuery) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;

          return aTitle.localeCompare(bTitle, 'vi');
        })
        .map(item => item.movie)
    : movies;

  const adBreakIndex = results.length >= 10 ? 10 : results.length >= 8 ? 8 : -1;
  const firstResults = adBreakIndex > -1 ? results.slice(0, adBreakIndex) : results;
  const remainingResults = adBreakIndex > -1 ? results.slice(adBreakIndex) : [];
  const isEmptySearch = hasQuery && results.length === 0;
  const isBrowseState = !hasQuery;

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>
        {query
          ? <>Kết quả cho: <span className="comic-text-yellow">&quot;{query}&quot;</span></>
          : 'Tìm phim'}
      </h1>
      <p className={styles.count}>
        {hasQuery ? `${results.length} bộ phim tìm được` : `${movies.length} bộ phim sẵn có để duyệt`}
      </p>

      {isBrowseState && (
        <p className={styles.helperText}>
          Nhập tên phim, tag, thể loại hoặc từ khóa gần đúng để tìm nhanh hơn.
        </p>
      )}

      {isEmptySearch ? (
        <div className={styles.empty}>
          <p>Không tìm thấy phim nào cho &quot;<strong>{query}</strong>&quot;</p>
          <p className={styles.emptyHint}>Đã thử khớp theo tiêu đề, tag, thể loại và các từ liên quan.</p>
          <div className={styles.emptyActions}>
            <Link className="btn-secondary" href="/search">
              Xoá từ khoá
            </Link>
            <Link className="btn-secondary" href="/">
              Về Trang Chủ
            </Link>
          </div>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className={styles.grid}>
            {firstResults.map(movie => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>

          {remainingResults.length > 0 && (
            <div className={styles.grid}>
              {remainingResults.map(movie => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <p>Chưa có dữ liệu để hiển thị.</p>
          <p className={styles.emptyHint}>Thử tải lại trang hoặc quay về trang chủ để duyệt nội dung.</p>
          <Link className="btn-secondary" href="/">
            Về Trang Chủ
          </Link>
        </div>
      )}
    </main>
  );
}
