"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './MovieCard.module.css';

export default function MovieCard({ movie }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayTitle = movie?.displayTitle || movie?.title || 'Không rõ tên phim';
  const thumbnail = getRenderableThumbnail(movie);
  const useUnoptimizedImage = thumbnail.startsWith('/api/movie-thumbnail');

  return (
    <Link href={`/watch/${movie.id}`} className={styles.card} title={displayTitle}>
      <div className={styles.imageContainer}>
        {imageFailed ? (
          <div className={styles.placeholder} role="img" aria-label={`Ảnh thay thế cho ${displayTitle}`}>
            <span className={styles.placeholderIcon}>▶</span>
            <span className={styles.placeholderText}>{displayTitle}</span>
          </div>
        ) : (
          <Image
            src={thumbnail}
            alt={displayTitle}
            fill
            className={styles.image}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            unoptimized={useUnoptimizedImage}
            onError={() => setImageFailed(true)}
          />
        )}
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
