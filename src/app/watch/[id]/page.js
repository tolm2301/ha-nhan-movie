"use client";
import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { allMovies } from '@/lib/data';
import { getWatchProgress, pushWatchedMovie, setWatchProgress } from '@/lib/watchHistory';
import styles from './Watch.module.css';

const EPISODE_REGEX = /(tập|tap|episode|ep\.?|phần)\s*(\d{1,4})/i;
let youtubeApiPromise;

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise(resolve => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve();
    };

    if (window.YT?.Player) resolve();
  });

  return youtubeApiPromise;
}

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
  const playerMountRef = useRef(null);
  const playerRef = useRef(null);
  const resumeAppliedRef = useRef(false);

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

  useEffect(() => {
    if (!movie) return;
    pushWatchedMovie(movie);
  }, [movie]);

  useEffect(() => {
    if (!movie || !playerMountRef.current) return;

    let isCancelled = false;
    let saveTimer;

    resumeAppliedRef.current = false;

    loadYouTubeApi().then(() => {
      if (isCancelled || !window.YT?.Player || !playerMountRef.current) return;

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player(playerMountRef.current, {
        videoId: movie.id,
        playerVars: {
          autoplay: 1,
          controls: 1,
          fs: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 0,
          origin: window.location.origin,
          enablejsapi: 1,
        },
        events: {
          onReady: event => {
            if (isCancelled) return;

            const frame = event.target.getIframe?.();
            if (frame) {
              frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
              frame.setAttribute('allowfullscreen', 'true');
            }

            const progress = getWatchProgress(movie.id);
            const duration = Number(event.target.getDuration?.() || 0);
            const resumePoint = Number(progress?.positionSec || 0);

            if (!resumeAppliedRef.current && resumePoint > 5 && (!duration || resumePoint < duration * 0.95)) {
              event.target.seekTo(resumePoint, true);
              resumeAppliedRef.current = true;
            }

            event.target.playVideo();
          },
        },
      });

      const saveCurrentProgress = () => {
        const player = playerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;

        const current = Number(player.getCurrentTime() || 0);
        const duration = Number(player.getDuration?.() || 0);

        if (current < 3) return;

        if (duration > 0 && current >= duration * 0.98) {
          setWatchProgress(movie.id, 0, duration);
          return;
        }

        setWatchProgress(movie.id, current, duration);
      };

      saveTimer = window.setInterval(saveCurrentProgress, 5000);
      window.addEventListener('pagehide', saveCurrentProgress);
      window.addEventListener('beforeunload', saveCurrentProgress);

      playerRef.current.__saveCurrentProgress = saveCurrentProgress;
    });

    return () => {
      isCancelled = true;

      if (saveTimer) {
        window.clearInterval(saveTimer);
      }

      const saveCurrentProgress = playerRef.current?.__saveCurrentProgress;
      if (typeof saveCurrentProgress === 'function') {
        saveCurrentProgress();
        window.removeEventListener('pagehide', saveCurrentProgress);
        window.removeEventListener('beforeunload', saveCurrentProgress);
      }

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [movie]);

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
            <div ref={playerMountRef} className={styles.playerFrame}></div>
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
