"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import MovieCard from "@/components/MovieCard/MovieCard";
import { getCachedCatalog } from "@/lib/clientCatalog";
import styles from "./Category.module.css";

const PAGE_SIZE = 24;

function subscribeCatalog(callback) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCatalogSnapshot() {
  const cached = getCachedCatalog();
  return cached?.data?.movies || null;
}

function getServerSnapshot() {
  return null;
}

export default function CategoryContent({
  categorySlug,
  initialCategory,
  initialMovies = [],
  currentPage = 1,
  totalPages = 1,
  pageBaseHref = "",
}) {
  const cachedAllMovies = useSyncExternalStore(subscribeCatalog, getCatalogSnapshot, getServerSnapshot);

  let activeMovies = initialMovies;
  let activeTotal = initialCategory?.count || initialMovies.length;
  let activeTotalPages = totalPages;

  if (cachedAllMovies && Array.isArray(cachedAllMovies) && cachedAllMovies.length > 0) {
    const matched = cachedAllMovies.filter(m => {
      const slug = m.categorySlug || "";
      const tags = m.tags || "";
      return slug === categorySlug || tags === initialCategory?.tag;
    });

    if (matched.length > 0) {
      activeTotal = matched.length;
      activeTotalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));
      const page = Math.min(Math.max(currentPage, 1), activeTotalPages);
      const startIndex = (page - 1) * PAGE_SIZE;
      activeMovies = matched.slice(startIndex, startIndex + PAGE_SIZE);
    }
  }

  return (
    <>
      <div className={styles.header}>
        <span className={styles.emoji}>🏷️</span>
        <h1 className={styles.title}>{initialCategory?.tag}</h1>
        <p className={styles.count}>{activeTotal} video</p>
        <p className={styles.pageInfo}>Trang {currentPage}/{activeTotalPages}</p>
      </div>

      <div className={styles.grid}>
        {activeMovies.map(movie => (
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
            {Array.from({ length: activeTotalPages }, (_, index) => index + 1).map(pageNumber => (
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
