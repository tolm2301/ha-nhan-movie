"use client";
import React, { useRef } from 'react';
import Link from 'next/link';
import { hasRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCarousel.module.css';
import MovieCard from '../MovieCard/MovieCard';

export default function MovieCarousel({ title, movies, viewAllHref }) {
  const scrollRef = useRef(null);
  const visibleMovies = (movies || []).filter(hasRenderableThumbnail);

  if (visibleMovies.length === 0) {
    return null;
  }

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -600, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 600, behavior: 'smooth' });
    }
  };

  return (
    <section className={styles.carouselSection}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.controls}>
          <button className={styles.navBtn} onClick={scrollLeft}>❮</button>
          <button className={styles.navBtn} onClick={scrollRight}>❯</button>
          {viewAllHref ? (
            <Link className={styles.viewAll} href={viewAllHref}>
              Tất cả ➔
            </Link>
          ) : null}
        </div>
      </div>
      
      <div className={styles.slider} ref={scrollRef}>
        {visibleMovies.map((movie) => (
          <div key={movie.id} className={styles.slideItem}>
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
