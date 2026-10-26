"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import Link from 'next/link';
import { buildFallbackThumbnailUrl, hasRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCard.module.css';

export default function MovieCard({ movie, onRemoveMovie, removeMovieLabel = 'Xóa khỏi danh sách đã xem gần đây' }) {
  const displayTitle = movie?.displayTitle || movie?.title || 'Không rõ tên phim';
  const fallbackThumbnail = buildFallbackThumbnailUrl(movie);
  
  // Điều chỉnh state khi movie prop thay đổi mà không cần useEffect (Chuẩn React.dev)
  const [prevMovieId, setPrevMovieId] = useState(movie?.id);
  const [hasError, setHasError] = useState(false);

  if (movie?.id !== prevMovieId) {
    setPrevMovieId(movie?.id);
    setHasError(false);
  }

  const canRemove = typeof onRemoveMovie === 'function';

  if (!movie?.id) {
    return null;
  }

  const thumbSrc = hasError
    ? fallbackThumbnail
    : (hasRenderableThumbnail(movie) && movie?.thumbnail ? movie.thumbnail : fallbackThumbnail);

  const handleImageError = () => {
    setHasError(true);
  };

  const handleImageLoad = (event) => {
    // YouTube's unavailable / broken placeholder image has dimensions 120x90
    if (event.currentTarget.naturalWidth <= 120) {
      setHasError(true);
    }
  };

  const handleRemoveClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemoveMovie(movie.id);
  };

  const viewsLabel = movie.views && !movie.views.includes('NaN') ? movie.views : 'Mới cập nhật';

  return (
    <div className={styles.card}>
      <Link href={`/watch/${movie.id}`} className={styles.cardLink} title={displayTitle}>
        <div className={styles.imageContainer}>
          <img
            src={thumbSrc}
            alt={displayTitle}
            className={styles.image}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          <span className={styles.tagBadge}>{movie.tags || 'Khác'}</span>
          <span className={styles.durationBadge}>{movie.episodes || 'Full'}</span>
        </div>

        <div className={styles.info}>
          <h3 className={styles.title}>{displayTitle}</h3>
          <p className={styles.channel}>{movie.tags || 'Danh mục khác'}</p>
          <p className={styles.meta}>{viewsLabel} • {movie.episodes || 'Full'}</p>
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
