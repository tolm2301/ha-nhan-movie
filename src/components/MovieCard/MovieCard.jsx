"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import Link from 'next/link';
import { buildFallbackThumbnailUrl, getRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCard.module.css';

export default function MovieCard({ movie }) {
  const displayTitle = movie?.displayTitle || movie?.title || 'Không rõ tên phim';
  const thumbnail = getRenderableThumbnail(movie);
  const fallbackThumbnail = buildFallbackThumbnailUrl(movie);
  const [thumbnailSrc, setThumbnailSrc] = useState(thumbnail);

  return (
    <Link href={`/watch/${movie.id}`} className={styles.card} title={displayTitle}>
      <div className={styles.imageContainer}>
        <img
          src={thumbnailSrc}
          alt={displayTitle}
          className={styles.image}
          loading="lazy"
          decoding="async"
          onError={() => setThumbnailSrc(current => (current === fallbackThumbnail ? current : fallbackThumbnail))}
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
