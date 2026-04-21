"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { allMovies } from '@/lib/data';
import { getWatchProgress, pushWatchedMovie, setWatchProgress } from '@/lib/watchHistory';
import styles from './Watch.module.css';

const EPISODE_REGEX = /(tập|tap|episode|ep\.?|phần)\s*(\d{1,4})/i;
let youtubeApiPromise;

const QUALITY_LABELS = {
  highres: '4K+',
  hd2160: '2160p',
  hd1440: '1440p',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
  auto: 'Tự động',
};

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

function formatTime(value) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function normalizeQualityValue(value) {
  if (!value || value === 'default') return 'auto';
  return value;
}

function buildQualityLevels(levels = []) {
  const unique = ['auto', ...levels.filter(Boolean).filter(level => level !== 'auto' && level !== 'default')];
  return unique.length > 0 ? unique : ['auto'];
}

function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

export default function WatchPage() {
  const router = useRouter();
  const routeParams = useParams();
  const playerMountRef = useRef(null);
  const playerRef = useRef(null);
  const resumeAppliedRef = useRef(false);
  const selectedQualityRef = useRef('auto');
  const qualityEnforceUntilRef = useRef(0);
  const qualityReloadAttemptedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [qualityLevels, setQualityLevels] = useState(['auto']);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

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
    let pollTimer;
    let saveTimer;

    setIsReady(false);
    resumeAppliedRef.current = false;

    loadYouTubeApi().then(() => {
      if (isCancelled || !window.YT?.Player || !playerMountRef.current) return;

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      const saveCurrentProgress = () => {
        const player = playerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;

        const current = Number(player.getCurrentTime() || 0);
        const total = Number(player.getDuration?.() || 0);

        if (current < 3) return;

        if (total > 0 && current >= total * 0.98) {
          setWatchProgress(movie.id, 0, total);
          return;
        }

        setWatchProgress(movie.id, current, total);
      };

      playerRef.current = new window.YT.Player(playerMountRef.current, {
        host: 'https://www.youtube-nocookie.com',
        videoId: movie.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 1,
          origin: window.location.origin,
          enablejsapi: 1,
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: event => {
            if (isCancelled) return;

            const frame = event.target.getIframe?.();
            if (frame) {
              frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
              frame.setAttribute('allowfullscreen', 'true');
              frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              frame.setAttribute('tabindex', '-1');
            }

            setIsReady(true);
            setDuration(Number(event.target.getDuration?.() || 0));
            setVolume(Number(event.target.getVolume?.() || 100));
            setIsMuted(Boolean(event.target.isMuted?.()));

            const levels = event.target.getAvailableQualityLevels?.() || [];
            setQualityLevels(buildQualityLevels(levels));
            setCurrentQuality(normalizeQualityValue(event.target.getPlaybackQuality?.()));
            setSelectedQuality('auto');
            selectedQualityRef.current = 'auto';

            const progress = getWatchProgress(movie.id);
            const resumePoint = Number(progress?.positionSec || 0);
            const total = Number(event.target.getDuration?.() || 0);

            if (!resumeAppliedRef.current && resumePoint > 5 && (!total || resumePoint < total * 0.95)) {
              event.target.seekTo(resumePoint, true);
              resumeAppliedRef.current = true;
            }

            event.target.playVideo();
          },
          onApiChange: event => {
            if (isCancelled) return;
            const levels = event.target.getAvailableQualityLevels?.() || [];
            setQualityLevels(buildQualityLevels(levels));
          },
          onPlaybackQualityChange: event => {
            if (isCancelled) return;
            setCurrentQuality(normalizeQualityValue(event.data));
          },
          onStateChange: event => {
            if (isCancelled) return;
            setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
          },
        },
      });

      pollTimer = window.setInterval(() => {
        const player = playerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;

        setCurrentTime(Number(player.getCurrentTime() || 0));
        setDuration(Number(player.getDuration?.() || 0));
        setVolume(Number(player.getVolume?.() || 0));
        setIsMuted(Boolean(player.isMuted?.()));
        const levels = buildQualityLevels(player.getAvailableQualityLevels?.() || []);
        setQualityLevels(previous => {
          if (previous.join('|') === levels.join('|')) return previous;
          return levels;
        });
        const actualQuality = normalizeQualityValue(player.getPlaybackQuality?.());
        setCurrentQuality(actualQuality);

        const desiredQuality = selectedQualityRef.current;
        if (desiredQuality !== 'auto' && Date.now() < qualityEnforceUntilRef.current && actualQuality !== desiredQuality) {
          player.setPlaybackQualityRange?.(desiredQuality);
          player.setPlaybackQuality(desiredQuality);

          const confirmed = normalizeQualityValue(player.getPlaybackQuality?.());
          if (confirmed !== desiredQuality && !qualityReloadAttemptedRef.current) {
            qualityReloadAttemptedRef.current = true;
            const current = Number(player.getCurrentTime() || 0);
            player.loadVideoById({
              videoId: movie.id,
              startSeconds: current,
              suggestedQuality: desiredQuality,
            });
          }
        }
      }, 500);

      saveTimer = window.setInterval(saveCurrentProgress, 5000);
      window.addEventListener('pagehide', saveCurrentProgress);
      window.addEventListener('beforeunload', saveCurrentProgress);

      playerRef.current.__saveCurrentProgress = saveCurrentProgress;
    });

    return () => {
      isCancelled = true;

      if (pollTimer) window.clearInterval(pollTimer);
      if (saveTimer) window.clearInterval(saveTimer);

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

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(getFullscreenElement());
      setIsFullscreen(active);
      if (active && isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('msfullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('msfullscreenchange', onFullscreenChange);
    };
  }, [isPseudoFullscreen]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape' && isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPseudoFullscreen]);

  useEffect(() => {
    if (!isPseudoFullscreen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isPseudoFullscreen]);

  const handleTogglePlay = () => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      player.playVideo();
      setIsPlaying(true);
    }
  };

  const handleSeek = value => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    const next = Number(value);
    player.seekTo(next, true);
    setCurrentTime(next);
  };

  const handleVolumeChange = value => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    const next = Number(value);
    player.setVolume(next);
    if (next === 0) {
      player.mute();
      setIsMuted(true);
    } else if (player.isMuted?.()) {
      player.unMute();
      setIsMuted(false);
    }
    setVolume(next);
  };

  const handleToggleMute = () => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    if (isMuted) {
      player.unMute();
      if (volume === 0) {
        player.setVolume(50);
        setVolume(50);
      }
      setIsMuted(false);
      return;
    }

    player.mute();
    setIsMuted(true);
  };

  const handleQualityChange = value => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    setSelectedQuality(value);
    selectedQualityRef.current = value;
    qualityEnforceUntilRef.current = Date.now() + 12000;
    qualityReloadAttemptedRef.current = false;

    if (value === 'auto') {
      player.setPlaybackQuality('default');
      player.setPlaybackQualityRange?.('default');
      setCurrentQuality('auto');
      return;
    }

    const at = Number(player.getCurrentTime() || 0);
    player.setPlaybackQualityRange?.(value);
    player.setPlaybackQuality(value);

    const confirmed = normalizeQualityValue(player.getPlaybackQuality?.());
    if (confirmed !== value) {
      qualityReloadAttemptedRef.current = true;
      player.loadVideoById({
        videoId: movie.id,
        startSeconds: at,
        suggestedQuality: value,
      });
    }

    if (typeof player.setPlaybackQualityRange === 'function') {
      player.setPlaybackQualityRange(value);
    }
    setCurrentQuality(normalizeQualityValue(player.getPlaybackQuality?.()));
  };

  const exitFullscreen = async () => {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
      return true;
    }

    if (typeof document.webkitExitFullscreen === 'function') {
      document.webkitExitFullscreen();
      return true;
    }

    if (typeof document.msExitFullscreen === 'function') {
      document.msExitFullscreen();
      return true;
    }

    return false;
  };

  const handleFullscreen = async () => {
    const hasNativeFullscreen = Boolean(getFullscreenElement());

    if (hasNativeFullscreen) {
      await exitFullscreen();
      return;
    }

    setIsMiniMode(false);
    setIsPseudoFullscreen(value => !value);
  };

  const handleVideoAreaClick = () => {
    handleTogglePlay();
  };

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

        <div
          className={`${styles.playerSection} ${isMiniMode ? styles.playerSectionMini : ''} ${isPseudoFullscreen ? styles.playerSectionPseudoFullscreen : ''}`}
        >
          <div className={styles.videoContainer}>
            <div ref={playerMountRef} className={styles.playerFrame}></div>
            <button
              type="button"
              className={styles.interactionBlocker}
              aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
              onClick={handleVideoAreaClick}
            >
              {!isPlaying && <span className={styles.centerPlayHint}>▶</span>}
            </button>
            <div className={styles.playerMaskTop}></div>
            <div className={styles.playerMaskLogo}></div>

            <div className={styles.inVideoControls}>
              <div className={styles.seekRow}>
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(duration, 0)}
                  step="1"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={event => handleSeek(event.target.value)}
                  className={styles.seekInput}
                  aria-label="Tua video"
                />
                <span>{formatTime(duration)}</span>
              </div>

              <div className={styles.controlRow}>
                <div className={styles.leftControls}>
                  <button className={styles.controlBtn} onClick={handleTogglePlay} disabled={!isReady}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className={styles.controlBtn} onClick={handleToggleMute} disabled={!isReady}>
                    {isMuted || volume === 0 ? '🔇' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={isMuted ? 0 : volume}
                    onChange={event => handleVolumeChange(event.target.value)}
                    className={styles.volumeInput}
                    aria-label="Âm lượng"
                  />
                </div>

                <div className={styles.rightControls}>
                  <select
                    className={styles.qualitySelect}
                    value={selectedQuality || 'auto'}
                    onChange={event => handleQualityChange(event.target.value)}
                    title={`Đang chạy: ${QUALITY_LABELS[currentQuality] || currentQuality}`}
                  >
                    {qualityLevels.map(level => (
                      <option key={level} value={level}>
                        {QUALITY_LABELS[level] || level}
                      </option>
                    ))}
                  </select>
                  <button className={styles.controlBtn} onClick={() => setIsMiniMode(value => !value)}>
                    {isMiniMode ? '🔼' : '🗗'}
                  </button>
                  <button className={styles.controlBtn} onClick={handleFullscreen}>
                    {isFullscreen || isPseudoFullscreen ? '🡽' : '⛶'}
                  </button>
                </div>
              </div>
            </div>
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
