"use client";

import { useSyncExternalStore, useMemo } from "react";
import Link from "next/link";
import MovieCard from "@/components/MovieCard/MovieCard";
import {
  subscribeCatalog,
  getCatalogMoviesSnapshot,
  getServerCatalogSnapshot,
} from "@/lib/clientCatalog";
import styles from "./Category.module.css";

const PAGE_SIZE = 24;

export default function CategoryContent({
  categorySlug,
  initialCategory,
  initialMovies = [],
  currentPage = 1,
  totalPages = 1,
  pageBaseHref = "",
}) {
  const cachedAllMovies = useSyncExternalStore(
    subscribeCatalog,
    getCatalogMoviesSnapshot,
    getServerCatalogSnapshot
  );

  const clientData = useMemo(() => {
    if (!cachedAllMovies || !Array.isArray(cachedAllMovies) || cachedAllMovies.length === 0) {
      return null;
    }

    const matched = cachedAllMovies.filter((movie) => {
      const slug = movie.categorySlug || "";
      const tags = movie.tags || "";
      return slug === categorySlug || tags === initialCategory?.tag;
    });

    if (matched.length === 0) return null;

    const total = matched.length;
    const computedTotalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(currentPage, 1), computedTotalPages);
    const startIndex = (page - 1) * PAGE_SIZE;
    const movies = matched.slice(startIndex, startIndex + PAGE_SIZE);

    return { movies, total, totalPages: computedTotalPages };
  }, [cachedAllMovies, categorySlug, initialCategory?.tag, currentPage]);

  const activeMovies = clientData ? clientData.movies : initialMovies;
  const activeTotal = clientData ? clientData.total : (initialCategory?.count || initialMovies.length);
  const activeTotalPages = clientData ? clientData.totalPages : totalPages;

  return (
    <>
      <div className={styles.header}>
        <span className={styles.emoji}>🏷️</span>
        <h1 className={styles.title}>{initialCategory?.tag}</h1>
        <p className={styles.count}>{activeTotal} video</p>
        <p className={styles.pageInfo}>Trang {currentPage}/{activeTotalPages}</p>
      </div>

      <div className={styles.grid}>
        {activeMovies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>

      {activeTotalPages > 1 && (
        <nav className={styles.pagination} aria-label={`Phân trang ${initialCategory?.tag}`}>
          <Link
            className={`${styles.pageLink} ${currentPage === 1 ? styles.pageLinkDisabled : ""}`}
            href={`${pageBaseHref}?page=${Math.max(1, currentPage - 1)}`}
            aria-disabled={currentPage === 1}
            tabIndex={currentPage === 1 ? -1 : 0}
          >
            ‹ Trước
          </Link>

          <div className={styles.pageNumbers}>
            {Array.from({ length: activeTotalPages }, (_, index) => index + 1).map((pageNumber) => (
              <Link
                key={pageNumber}
                className={`${styles.pageLink} ${pageNumber === currentPage ? styles.pageLinkActive : ""}`}
                href={pageNumber === 1 ? pageBaseHref : `${pageBaseHref}?page=${pageNumber}`}
                aria-current={pageNumber === currentPage ? "page" : undefined}
              >
                {pageNumber}
              </Link>
            ))}
          </div>

          <Link
            className={`${styles.pageLink} ${currentPage === activeTotalPages ? styles.pageLinkDisabled : ""}`}
            href={`${pageBaseHref}?page=${Math.min(activeTotalPages, currentPage + 1)}`}
            aria-disabled={currentPage === activeTotalPages}
            tabIndex={currentPage === activeTotalPages ? -1 : 0}
          >
            Sau ›
          </Link>
        </nav>
      )}
    </>
  );
}