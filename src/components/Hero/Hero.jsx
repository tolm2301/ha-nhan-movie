"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasRenderableThumbnail, markMovieUnavailable } from '@/lib/thumbnailFilters';
import styles from './Hero.module.css';

export default function Hero({ featuredMovie, onMovieUnavailable }) {
  const featuredTitle = featuredMovie?.displayTitle || featuredMovie?.title;

  const [prevMovieId, setPrevMovieId] = useState(featuredMovie?.id);
  const [hasError, setHasError] = useState(false);

  if (featuredMovie?.id !== prevMovieId) {
    setPrevMovieId(featuredMovie?.id);
    setHasError(false);
  }

  const router = useRouter();

  if (!featuredMovie?.id || hasError || !hasRenderableThumbnail(featuredMovie)) {
    return null;
  }

  const featuredThumbnail = featuredMovie.thumbnail;

  const handleWatch = () => {
    router.push(`/watch/${featuredMovie.id}`);
  };

  const handleExploreCategory = () => {
    if (featuredMovie?.categorySlug) {
      router.push(`/category/${featuredMovie.categorySlug}`);
      return;
    }
    router.push('/search');
  };

  const markBroken = () => {
    markMovieUnavailable(featuredMovie.id);
    setHasError(true);
    if (typeof onMovieUnavailable === 'function') {
      onMovieUnavailable(featuredMovie.id);
    }
  };

  const handleImageError = () => {
    markBroken();
  };

  const handleImageLoad = (event) => {
    if (event.currentTarget.naturalWidth <= 120) {
      markBroken();
    }
  };

  return (
    <section className={styles.hero}>
      <div className={styles.background}>
        <img
          src={featuredThumbnail}
          alt={featuredTitle || 'Phim tâm điểm'}
          className={styles.bgImage}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
        <div className={styles.overlay}></div>
      </div>

      <div className={styles.content}>
        <div className={styles.metaRow}>
          <span className={styles.badge}>Tâm Điểm Hôm Nay</span>
          {featuredMovie?.tags && (
            <span className={styles.categoryPill}>{featuredMovie.tags}</span>
          )}
          {featuredMovie?.episodes && (
            <span className={styles.durationPill}>{featuredMovie.episodes}</span>
          )}
        </div>

        <h1 className={styles.title}>{featuredTitle}</h1>

        <p className={styles.description}>
          Tuyển chọn phim hoạt hình 3D, tu tiên, xuyên không và trọng sinh đặc sắc nhất. Trải nghiệm trọn bộ chất lượng cao, cập nhật liên tục mỗi ngày.
        </p>

        <div className={styles.actions}>
          <button type="button" className="btn-primary" onClick={handleWatch}>
            ▶ Xem Ngay
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExploreCategory}
          >
            Khám Phá Thể Loại
          </button>
        </div>
      </div>
    </section>
  );
}