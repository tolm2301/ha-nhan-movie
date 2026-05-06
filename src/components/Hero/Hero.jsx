"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildFallbackThumbnailUrl, getRenderableThumbnail } from '@/lib/thumbnailFilters';
import styles from './Hero.module.css';

export default function Hero({ featuredMovie }) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [featuredThumbnail, setFeaturedThumbnail] = useState(() => getRenderableThumbnail(featuredMovie));
  const router = useRouter();
  const featuredTitle = featuredMovie?.displayTitle || featuredMovie?.title;
  const fallbackThumbnail = buildFallbackThumbnailUrl(featuredMovie);
  const useUnoptimizedImage = featuredThumbnail.startsWith('/api/movie-thumbnail');

  const handleWatch = () => {
    if (featuredMovie) {
      router.push(`/watch/${featuredMovie.id}`);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  return (
    <section className={styles.hero}>
      {featuredMovie && (
        <div className={styles.background}>
          <Image
            src={featuredThumbnail}
            alt={featuredTitle}
            fill
            className={styles.bgImage}
            priority
            sizes="100vw"
            unoptimized={useUnoptimizedImage}
            onError={() => setFeaturedThumbnail(current => (current === fallbackThumbnail ? current : fallbackThumbnail))}
          />
          <div className={styles.overlay}></div>
        </div>
      )}
      
      <div className={styles.content}>
        <span className={styles.badge}>🔥 ĐANG HOT TOP 1 TÓM TẮT 🔥</span>
        <h1 className={styles.title} style={{ fontSize: '3.5rem' }}>
          {featuredMovie ? featuredTitle : "Đang tải dữ liệu..."}
        </h1>
        <p className={styles.description}>
          Phim hay mới cập nhật từ hệ thống cào dữ liệu xịn sò nhất thế giới.
          Click Cày Ngay để xem trọn vẹn bộ phim phá án, xuyên không, hệ thống cực chất!
        </p>
        
        <div className={styles.actions}>
          <button className="btn-primary" onClick={handleWatch}>▶ CÀY NGAY</button>
          <button 
            className={`btn-secondary ${isBookmarked ? styles.bookmarked : ''}`} 
            onClick={handleBookmark}
          >
            {isBookmarked ? '✓ ĐÃ LƯU' : '+ BỎ TÚI'}
          </button>
        </div>
      </div>
    </section>
  );
}
