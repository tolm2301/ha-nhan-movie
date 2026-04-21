import React from 'react';
import styles from './MovieCarousel.module.css';
import MovieCard from '../MovieCard/MovieCard';

export default function MovieCarousel({ title, movies }) {
  return (
    <section className={styles.carouselSection}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button className={styles.viewAll}>Xem tất cả ➔</button>
      </div>
      
      <div className={styles.grid}>
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
}
