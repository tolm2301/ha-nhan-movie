"use client";
import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { allMovies } from '@/lib/data';
import styles from './Watch.module.css';

const EPISODE_REGEX = /(tập|tap|episode|ep\.?|phần)\s*(\d{1,4})/i;

function normalizeSeriesKey(title = '') {
  return title
    .toLowerCase()
    .replace(EPISODE_REGEX, '')
    .replace(/\b(full|trọn bộ|vietsub|thuyết minh|review)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEpisodeNumber(movie) {
  if (typeof movie?.episodeNumber === 'number' && Number.isFinite(movie.episodeNumber)) {
    return movie.episodeNumber;
  }

  const fromTitle = movie?.title?.match(EPISODE_REGEX);
  if (fromTitle) return Number(fromTitle[2]);

  const fromEpisodes = movie?.episodes?.match(/\d+/);
  if (fromEpisodes) return Number(fromEpisodes[0]);

  return null;
}

function getEpisodeLabel(movie) {
  if (movie?.episodeLabel) return movie.episodeLabel;
  const episodeNumber = getEpisodeNumber(movie);
  if (episodeNumber) return `Tập ${episodeNumber}`;
  return movie?.episodes || 'Full';
}

function isSeriesMovie(movie) {
  if (!movie) return false;
  if (movie.type === 'series') return true;
  return EPISODE_REGEX.test(movie.title || '') || /tập|ep\.?\s*\d+/i.test(movie.episodes || '');
}

export default function WatchPage() {
  const router = useRouter();
  const routeParams = useParams();

  const movieId = typeof routeParams?.id === 'string' ? routeParams.id : '';
  const movie = allMovies.find(m => m.id === movieId) || allMovies[0] || null;
  const movieDisplayTitle = movie?.displayTitle || movie?.title;
  const shouldShowEpisodes = isSeriesMovie(movie);

  const episodes = useMemo(() => {
    if (!movie || !shouldShowEpisodes) return [];

    const movieSeriesKey = movie.seriesKey || normalizeSeriesKey(movie.title);
    const related = allMovies
      .filter(item => {
        if (!isSeriesMovie(item)) return false;
        const itemSeriesKey = item.seriesKey || normalizeSeriesKey(item.title);
        return itemSeriesKey && itemSeriesKey === movieSeriesKey;
      })
      .sort((a, b) => {
        const aNum = getEpisodeNumber(a);
        const bNum = getEpisodeNumber(b);
        if (aNum === null && bNum === null) return 0;
        if (aNum === null) return 1;
        if (bNum === null) return -1;
        return aNum - bNum;
      });

    if (!related.some(item => item.id === movie.id)) {
      related.unshift(movie);
    }

    return related.slice(0, 40);
  }, [movie, shouldShowEpisodes]);

  if (!movie) {
    return (
      <div className={styles.watchLayout}>
        <div className={styles.container}>
          <p>Chua co du lieu phim de phat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.watchLayout}>
      <div className={styles.container}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          ← Quay lại
        </button>

        <div className={styles.playerSection}>
          <div className={styles.videoContainer}>
            <iframe
              className={styles.playerFrame}
              src={`https://www.youtube.com/embed/${movie.id}?autoplay=1&controls=1&fs=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&disablekb=0`}
              title={movieDisplayTitle}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
            <div className={styles.playerMaskTop}></div>
            <div className={styles.playerMaskLogo}></div>
          </div>
        </div>

        <div className={styles.infoSection}>
          <h1 className={styles.movieTitle}>{movieDisplayTitle}</h1>
          <div className={styles.meta}>
            <span className={styles.stat}>👁 {movie.views}</span>
            <span className={styles.stat}>★ LƯỢT ĐÁNH GIÁ: {movie.rating || 'N/A'}</span>
            <span className={styles.tag}>Full HD</span>
            <span className={styles.tag}>{getEpisodeLabel(movie)}</span>
          </div>
          <p className={styles.desc}>
            Nguồn cung cấp: Kênh đối tác (Sưu tầm Internet)
          </p>
        </div>

        {shouldShowEpisodes && episodes.length > 1 && (
          <div className={styles.episodeSection}>
            <h3 className={styles.sectionTitle}>Chọn Tập Phim</h3>
            <div className={styles.episodeGrid}>
              {episodes.map(ep => (
                <button
                  key={ep.id}
                  className={`${styles.epBtn} ${ep.id === movie.id ? styles.activeEp : ''}`}
                  onClick={() => router.push(`/watch/${ep.id}`)}
                  title={ep.displayTitle || ep.title}
                >
                  {getEpisodeLabel(ep)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
