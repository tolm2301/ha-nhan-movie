import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './MovieCard.module.css';

export default function MovieCard({ movie }) {
  return (
    <Link href={`/watch/${movie.id}`} className={styles.card} title={movie.title}>
      <div className={styles.imageContainer}>
        <Image
          src={movie.thumbnail}
          alt={movie.title}
          fill
          className={styles.image}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
        />
        
        <div className={styles.overlay}>
          <button className={styles.playBtn}>▶</button>
        </div>
        
        <div className={styles.badges}>
          <span className={styles.episodeBadge}>{movie.episodes}</span>
          <span className={styles.ratingBadge}>{movie.tags || movie.rating}</span>
        </div>
      </div>
      
      <div className={styles.info}>
        <h3 className={styles.title}>{movie.title}</h3>
        <p className={styles.views}>{movie.views}</p>
      </div>
    </Link>
  );
}
