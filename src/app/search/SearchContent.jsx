"use client";

import { useSyncExternalStore, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MovieCard from "@/components/MovieCard/MovieCard";
import { buildCategoryBuckets } from "@/lib/movieCategories";
import {
  subscribeCatalog,
  getCatalogMoviesSnapshot,
  getServerCatalogSnapshot,
} from "@/lib/clientCatalog";
import styles from "./Search.module.css";

function normalizeSearchText(value = "") {
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactSearchText(value = "") {
  return normalizeSearchText(value).replace(/\s+/g, "");
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
    .map((value) => (value == null ? "" : String(value)))
    .filter(Boolean);
}

function getMatchScore(movie, normalizedQuery, compactQuery) {
  let bestScore = Number.POSITIVE_INFINITY;

  for (const field of getSearchFields(movie)) {
    const normalizedField = normalizeSearchText(field);
    if (!normalizedField) continue;

    const compactField = normalizedField.replace(/\s+/g, "");
    const directMatch =
      normalizedField.includes(normalizedQuery) || compactField.includes(compactQuery);
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

export default function SearchContent({ query = "", movies = [] }) {
  const router = useRouter();
  const [prevQuery, setPrevQuery] = useState(query);
  const [inputQuery, setInputQuery] = useState(query);

  if (query !== prevQuery) {
    setPrevQuery(query);
    setInputQuery(query);
  }

  const cachedMovies = useSyncExternalStore(
    subscribeCatalog,
    getCatalogMoviesSnapshot,
    getServerCatalogSnapshot
  );

  const activeMovies = cachedMovies && cachedMovies.length > 0 ? cachedMovies : movies;
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = compactSearchText(query);
  const hasQuery = Boolean(normalizedQuery);

  const categoryShortcuts = useMemo(() => {
    return buildCategoryBuckets(activeMovies).filter(
      (cat) => cat.movies && cat.movies.length > 0
    );
  }, [activeMovies]);

  const results = useMemo(() => {
    if (!hasQuery) return activeMovies;

    return activeMovies
      .map((movie) => {
        const matchScore = getMatchScore(movie, normalizedQuery, compactQuery);
        return matchScore === null ? null : { movie, matchScore };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;

        const aTitle = normalizeSearchText(a.movie?.displayTitle || a.movie?.title || "");
        const bTitle = normalizeSearchText(b.movie?.displayTitle || b.movie?.title || "");
        const aStarts = aTitle.startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = bTitle.startsWith(normalizedQuery) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;

        return aTitle.localeCompare(bTitle, "vi");
      })
      .map((item) => item.movie);
  }, [activeMovies, hasQuery, normalizedQuery, compactQuery]);

  const adBreakIndex = results.length >= 10 ? 10 : results.length >= 8 ? 8 : -1;
  const firstResults = adBreakIndex > -1 ? results.slice(0, adBreakIndex) : results;
  const remainingResults = adBreakIndex > -1 ? results.slice(adBreakIndex) : [];
  const isEmptySearch = hasQuery && results.length === 0;
  const isBrowseState = !hasQuery;

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = inputQuery.trim();
    if (!trimmed) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleClear = () => {
    setInputQuery("");
    router.push("/search");
  };

  return (
    <main className={styles.page}>
      <section className={styles.searchHeader}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Tra cứu kho phim</span>
          <h1 className={styles.heading}>
            {query ? (
              <>
                Kết quả cho: <span className="comic-text-yellow">&quot;{query}&quot;</span>
              </>
            ) : (
              "Khám Phá & Tìm Kiếm Phim"
            )}
          </h1>
          <p className={styles.count}>
            {hasQuery
              ? `Tìm thấy ${results.length} bộ phim phù hợp`
              : `${activeMovies.length} bộ phim tuyển chọn sẵn sàng thưởng thức`}
          </p>
        </div>

        <form className={styles.searchBar} onSubmit={handleSubmit} role="search">
          <input
            type="search"
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            placeholder="Nhập tên phim, thể loại (Xuyên Không, Trọng Sinh, Hệ Thống...)"
            aria-label="Nhập từ khóa tìm kiếm phim"
            className={styles.searchInput}
          />
          {inputQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              aria-label="Xóa từ khóa tìm kiếm"
              title="Xóa từ khóa"
            >
              ×
            </button>
          )}
          <button type="submit" className={styles.submitBtn}>
            Tìm Phim
          </button>
        </form>

        {categoryShortcuts.length > 0 && (
          <div className={styles.shortcutRow} aria-label="Lối tắt danh mục phim">
            <span className={styles.shortcutLabel}>Danh mục nổi bật:</span>
            {categoryShortcuts.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className={styles.shortcutChip}
              >
                {category.tag}
              </Link>
            ))}
          </div>
        )}
      </section>

      {isBrowseState && (
        <p className={styles.helperText}>
          Gợi ý: Bạn có thể gõ tên phim không dấu, tên nhân vật hoặc chọn nhanh một danh mục ở trên.
        </p>
      )}

      {isEmptySearch ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            Chưa tìm thấy bộ phim nào khớp với &quot;<strong>{query}</strong>&quot;
          </p>
          <p className={styles.emptyHint}>
            Hệ thống đã tra cứu theo tên phim, thể loại và từ khóa liên quan. Hãy thử rút ngắn từ khóa hoặc khám phá các danh mục bên dưới.
          </p>
          <div className={styles.emptyActions}>
            <Link className="btn-secondary" href="/search">
              Xem Toàn Bộ Kho Phim
            </Link>
            <Link className="btn-primary" href="/">
              Về Trang Chủ
            </Link>
          </div>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className={styles.grid}>
            {firstResults.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>

          {remainingResults.length > 0 && (
            <div className={styles.grid}>
              {remainingResults.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Kho phim đang được đồng bộ dữ liệu.</p>
          <p className={styles.emptyHint}>
            Vui lòng tải lại trang sau giây lát hoặc quay về trang chủ để tiếp tục khám phá.
          </p>
          <Link className="btn-primary" href="/">
            Về Trang Chủ
          </Link>
        </div>
      )}
    </main>
  );
}