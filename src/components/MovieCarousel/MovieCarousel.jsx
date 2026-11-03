"use client";
import React, { useRef } from 'react';
import Link from 'next/link';
import { hasRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCarousel.module.css';
import MovieCard from '../MovieCard/MovieCard';

export default function MovieCarousel({ title, movies, viewAllHref, onRemoveMovie, removeMovieLabel }) {
  const scrollRef = useRef(null);
  const visibleMovies = (movies || []).filter(movie => Boolean(movie?.id) && hasRenderableThumbnail(movie));

  if (visibleMovies.length === 0) {
    return null;
  }

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -640, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 640, behavior: 'smooth' });
    }
  };

  return (
    <section className={styles.carouselSection}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.controls}>
          <div className={styles.navGroup}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={scrollLeft}
              aria-label={`Cuộn danh sách ${title} sang trái`}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={scrollRight}
              aria-label={`Cuộn danh sách ${title} sang phải`}
            >
              ›
            </button>
          </div>
          {viewAllHref ? (
            <Link className={styles.viewAll} href={viewAllHref}>
              Xem tất cả ›
            </Link>
          ) : null}
        </div>
      </div>

      <div className={styles.slider} ref={scrollRef}>
        {visibleMovies.map((movie) => (
          <div key={movie.id} className={styles.slideItem}>
            <MovieCard movie={movie} onRemoveMovie={onRemoveMovie} removeMovieLabel={removeMovieLabel} />
          </div>
        ))}
      </div>
    </section>
  );
}