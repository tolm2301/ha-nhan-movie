"use client";
import React, { useRef } from 'react';
import styles from './MovieCarousel.module.css';
import MovieCard from '../MovieCard/MovieCard';

export default function MovieCarousel({ title, movies }) {
  const scrollRef = useRef(null);

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
          <button className={styles.viewAll}>Xem tất cả ➔</button>
        </div>
      </div>
      
      <div className={styles.slider} ref={scrollRef}>
        {movies.map((movie) => (
          <div key={movie.id} className={styles.slideItem}>
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
