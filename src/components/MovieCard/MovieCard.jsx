"use client";
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import Link from 'next/link';
import { buildFallbackThumbnailUrl, hasRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCard.module.css';

export default function MovieCard({
  movie,
  onRemoveMovie,
  removeMovieLabel = 'Xóa khỏi danh sách tiếp tục xem',
}) {
  const displayTitle = movie?.displayTitle || movie?.title || 'Phim đang cập nhật tên';
  const fallbackThumbnail = buildFallbackThumbnailUrl(movie);

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
    if (event.currentTarget.naturalWidth <= 120) {
      setHasError(true);
    }
  };

  const handleRemoveClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemoveMovie(movie.id);
  };

  const rawViews = movie.views ? String(movie.views) : '';
  const viewsLabel =
    rawViews && !rawViews.includes('NaN') && !rawViews.includes('undefined')
      ? rawViews
      : 'Mới cập nhật';
  const durationLabel = movie.episodes ? String(movie.episodes) : 'Trọn bộ';
  const categoryLabel = movie.tags || 'Tuyển chọn';

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
          <span className={styles.tagBadge}>{categoryLabel}</span>
          {durationLabel && <span className={styles.durationBadge}>{durationLabel}</span>}
        </div>

        <div className={styles.info}>
          <h3 className={styles.title}>{displayTitle}</h3>
          <p className={styles.meta}>
            <span>{categoryLabel}</span>
            <span className={styles.dot}>•</span>
            <span>{viewsLabel}</span>
          </p>
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