"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import Link from 'next/link';
import { hasRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCard.module.css';

export default function MovieCard({ movie, onRemoveMovie, removeMovieLabel = 'Xóa khỏi danh sách đã xem gần đây' }) {
  const [isHidden, setIsHidden] = useState(false);
  const displayTitle = movie?.displayTitle || movie?.title || 'Không rõ tên phim';
  const canRemove = typeof onRemoveMovie === 'function';

  if (isHidden || !movie?.id || !hasRenderableThumbnail(movie)) {
    return null;
  }

  const handleRemoveClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemoveMovie(movie.id);
  };

  return (
    <div className={styles.card}>
      <Link href={`/watch/${movie.id}`} className={styles.cardLink} title={displayTitle}>
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

      {canRemove ? (
        <button
          type="button"
          className={styles.removeButton}
          aria-label={`${removeMovieLabel}: ${displayTitle}`}
          title={removeMovieLabel}
          onClick={handleRemoveClick}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
