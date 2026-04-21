"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { allMovies } from '@/lib/data';
import styles from './Watch.module.css';

export default function WatchPage({ params }) {
  const router = useRouter();
  
  const movieId = params?.id || '1';
  const movie = allMovies.find(m => m.id === movieId) || allMovies[0];
  
  // Fake episode list (could also be fetched from channel)
  const episodes = allMovies.slice(0, 10);

  return (
    <div className={styles.watchLayout}>
      <div className={styles.container}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          ← Quay lại
        </button>
        
        <div className={styles.playerSection}>
             <div className={styles.playerWrapper}>
               <iframe 
                 width="100%" 
                 height="100%" 
                 src={`https://www.youtube.com/embed/${movie.id}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&controls=1&disablekb=1`} 
                 title={movie.title} 
                 frameBorder="0" 
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                 allowFullScreen
               ></iframe>
               {/* Advanced masking layers to hide YT branding */}
               <div className={styles.playerMaskTop}></div>
               <div className={styles.playerMaskBottom}></div>
               <div className={styles.playerMaskLogo}></div>
             </div>
        </div>

        <div className={styles.infoSection}>
          <h1 className={styles.movieTitle}>{movie.title}</h1>
          <div className={styles.meta}>
            <span className={styles.stat}>👁 {movie.views}</span>
            <span className={styles.stat}>★ LƯỢT ĐÁNH GIÁ: {movie.rating}</span>
            <span className={styles.tag}>Full HD</span>
            <span className={styles.tag}>{movie.episodes}</span>
          </div>
          <p className={styles.desc}>
            Nguồn cung cấp: Kênh đối tác (Sưu tầm Internet)
          </p>
        </div>

        <div className={styles.episodeSection}>
          <h3 className={styles.sectionTitle}>Chọn Tập Phim</h3>
          <div className={styles.episodeGrid}>
            {episodes.map(ep => (
              <button 
                key={ep.id} 
                className={`${styles.epBtn} ${ep.id === movieId ? styles.activeEp : ''}`}
                onClick={() => router.push(`/watch/${ep.id}`)}
                title={ep.title}
              >
                Tập Khác
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
