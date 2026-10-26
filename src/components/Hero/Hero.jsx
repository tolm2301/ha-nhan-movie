"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildFallbackThumbnailUrl, getRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './Hero.module.css';

export default function Hero({ featuredMovie }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const featuredTitle = featuredMovie?.displayTitle || featuredMovie?.title;
  const fallbackThumbnail = buildFallbackThumbnailUrl(featuredMovie);

  const [prevMovieId, setPrevMovieId] = useState(featuredMovie?.id);
  const [hasError, setHasError] = useState(false);

  if (featuredMovie?.id !== prevMovieId) {
    setPrevMovieId(featuredMovie?.id);
    setHasError(false);
  }

  const router = useRouter();

  const featuredThumbnail = hasError
    ? fallbackThumbnail
    : getRenderableThumbnail(featuredMovie);

  const handleWatch = () => {
    if (featuredMovie) {
      router.push(`/watch/${featuredMovie.id}`);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleImageError = () => {
    setHasError(true);
  };

  const handleImageLoad = (event) => {
    // YouTube's unavailable / broken placeholder image has dimensions 120x90
    if (event.currentTarget.naturalWidth <= 120) {
      setHasError(true);
    }
  };

  return (
    <section className={styles.hero}>
      {featuredMovie && (
        <div className={styles.background}>
          <img
            src={featuredThumbnail}
            alt={featuredTitle}
            className={styles.bgImage}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
          <div className={styles.overlay}></div>
        </div>
      )}
      
      <div className={styles.content}>
        <span className={styles.badge}>🔥 PHIM NỔI BẬT</span>
        <h1 className={styles.title} style={{ fontSize: '3.5rem' }}>
          {featuredMovie ? featuredTitle : "Đang tải dữ liệu..."}
        </h1>
        <p className={styles.description}>
          Tổng hợp phim hoạt hình, tu tiên, xuyên không và trọng sinh chọn lọc chất lượng cao. Cập nhật liên tục các tập phim mới nhất.
        </p>
        
        <div className={styles.actions}>
          <button className="btn-primary" onClick={handleWatch}>▶ XEM PHIM</button>
          <button 
            className={`btn-secondary ${isBookmarked ? styles.bookmarked : ''}`} 
            onClick={handleBookmark}
          >
            {isBookmarked ? '✓ ĐÃ LƯU' : '+ LƯU PHIM'}
          </button>
        </div>
      </div>
    </section>
  );
}
