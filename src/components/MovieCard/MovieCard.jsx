"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import Link from 'next/link';
import { hasRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCard.module.css';

export default function MovieCard({ movie }) {
  const [isHidden, setIsHidden] = useState(false);
  const displayTitle = movie?.displayTitle || movie?.title || 'Không rõ tên phim';

  if (isHidden || !movie?.id || !hasRenderableThumbnail(movie)) {
    return null;
  }

  return (
    <Link href={`/watch/${movie.id}`} className={styles.card} title={displayTitle}>
      <div className={styles.imageContainer}>
        <img
          src={movie.thumbnail}
          alt={displayTitle}
          className={styles.image}
          loading="lazy"
          decoding="async"
          onError={() => setIsHidden(true)}
        />
        <span className={styles.tagBadge}>{movie.tags || 'Khác'}</span>
        <span className={styles.durationBadge}>{movie.episodes || 'Full'}</span>
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{displayTitle}</h3>
        <p className={styles.channel}>{movie.tags || 'Danh mục khác'}</p>
        <p className={styles.meta}>{movie.views} • {movie.episodes || 'Full'}</p>
      </div>
    </Link>
  );
}
