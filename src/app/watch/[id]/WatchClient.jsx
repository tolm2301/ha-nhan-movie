"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWatchProgress, pushWatchedMovie, setWatchProgress } from '@/lib/watchHistory';
import AdSlot from '@/components/Adsense/AdSlot';
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

const SEEK_STEP_SECONDS = 30;
const YOUTUBE_API_LOAD_TIMEOUT_MS = 10000;
const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
const POPUP_HELPER_TITLE = 'Hanhan Mini Popup';
const POPUP_HELPER_PIN_COMMAND = 'powershell -ExecutionPolicy Bypass -File ".\\tools\\window-pin\\PinHanhanPopup.ps1" -Mode pin';
const POPUP_HELPER_UNPIN_COMMAND = 'powershell -ExecutionPolicy Bypass -File ".\\tools\\window-pin\\PinHanhanPopup.ps1" -Mode unpin';

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
    const script = existing || document.createElement('script');
    let settled = false;
    let timeoutId;

    const finish = callback => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (script) {
        script.removeEventListener('error', handleError);
      }
      callback();
    };

    const handleError = () => {
      finish(() => reject(new Error('YouTube API failed to load.')));
    };

    if (!existing) {
      script.src = YOUTUBE_IFRAME_API_SRC;
      script.async = true;
      script.addEventListener('error', handleError);
      document.body.appendChild(script);
    } else {
      existing.addEventListener('error', handleError);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      finish(resolve);
    };

    timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('YouTube API load timed out.')));
    }, YOUTUBE_API_LOAD_TIMEOUT_MS);

    if (window.YT?.Player) {
      finish(resolve);
    }
  }).catch(error => {
    youtubeApiPromise = undefined;
    throw error;
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isInteractiveKeyboardTarget(target) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, button, a[href], [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="button"], [role="menuitem"], [role="slider"]',
    ),
  );
}

export default function WatchClient({ movieId = '', initialMovies = [], popupMode = false, popupStartTime = 0, popupShouldPlay = true }) {
  const router = useRouter();
  const [movies, setMovies] = useState(() => initialMovies);
  const [isCatalogLoaded, setIsCatalogLoaded] = useState(() => Array.isArray(initialMovies) && initialMovies.length > 0);
  const playerSectionRef = useRef(null);
  const playerMountRef = useRef(null);
  const playerRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const videoAreaClickTimerRef = useRef(null);
  const suppressNextVideoAreaClickRef = useRef(false);
  const resumeAppliedRef = useRef(false);
  const selectedQualityRef = useRef('auto');
  const qualityEnforceUntilRef = useRef(0);
  const qualityReloadAttemptedRef = useRef(false);
  const playableMarkedRef = useRef(false);
  const lastKnownTimeRef = useRef(0);
  const lastKnownPlayingRef = useRef(true);
  const popupWindowRef = useRef(null);
  const popupRestoreStateRef = useRef({ time: 0, playing: true });
  const popupPollTimerRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlayable, setIsPlayable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [qualityLevels, setQualityLevels] = useState(['auto']);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [isDetachedPopupOpen, setIsDetachedPopupOpen] = useState(false);
  const [isPopupPinned, setIsPopupPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNativePlayerFullscreen, setIsNativePlayerFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [playerLoadError, setPlayerLoadError] = useState('');
  const [popupNotice, setPopupNotice] = useState('');
  const [isPopupPinHelperSupported, setIsPopupPinHelperSupported] = useState(false);

  const movie = movies.find(m => m.id === movieId) || movies[0] || null;
  const movieDisplayTitle = movie?.displayTitle || movie?.title;
  const shouldShowEpisodes = isSeriesMovie(movie);
  const isPopupWindow = Boolean(popupMode);

  useEffect(() => {
    if (!isPopupWindow) return undefined;

    let nextPinned = false;
    try {
      nextPinned = window.localStorage.getItem(`hanhan-popup-pinned:${movieId}`) === '1';
    } catch {
      nextPinned = false;
    }

    const nextSupported = /win/i.test(window.navigator.platform || window.navigator.userAgent || '');
    const frame = window.requestAnimationFrame(() => {
      setIsPopupPinned(nextPinned);
      setIsPopupPinHelperSupported(nextSupported);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isPopupWindow, movieId]);

  useEffect(() => {
    if (!isPopupWindow) return undefined;

    try {
      window.localStorage.setItem(`hanhan-popup-pinned:${movieId}`, isPopupPinned ? '1' : '0');
    } catch {
      // Ignore storage failures; the popup still keeps the current session state.
    }

    document.title = `${POPUP_HELPER_TITLE} • ${isPopupPinned ? 'Đã ghim' : 'Chưa ghim'}${movieDisplayTitle ? ` | ${movieDisplayTitle}` : ''}`;

    return undefined;
  }, [isPopupPinned, isPopupWindow, movieDisplayTitle, movieId]);

  useEffect(() => {
    if (!shouldShowEpisodes || isPopupWindow) {
      return undefined;
    }

    let active = true;
    const fetchTimer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/movies', { cache: 'no-store' });
        const payload = await response.json();

        if (!active) return;

        if (response.ok && Array.isArray(payload.movies)) {
          setMovies(currentMovies => {
            const currentMovie = currentMovies.find(item => item?.id === movieId) || currentMovies[0] || null;
            const mergedMovies = [];

            if (currentMovie) {
              mergedMovies.push(currentMovie);
            }

            for (const item of payload.movies) {
              if (item?.id !== currentMovie?.id) {
                mergedMovies.push(item);
              }
            }

            return mergedMovies;
          });
        } else {
          setMovies([]);
        }
      } catch {
        if (active) setMovies([]);
      } finally {
        if (active) setIsCatalogLoaded(true);
      }
    }, 1200);

    return () => {
      active = false;
      window.clearTimeout(fetchTimer);
    };
  }, [isPopupWindow, movieId, shouldShowEpisodes]);

  const episodes = useMemo(() => {
    if (!movie || !shouldShowEpisodes || isPopupWindow) return [];

    const movieSeriesKey = movie.seriesKey || normalizeSeriesKey(movie.title);
    const related = movies
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
  }, [isPopupWindow, movie, movies, shouldShowEpisodes]);

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const clearVideoAreaClickTimer = useCallback(() => {
    if (videoAreaClickTimerRef.current) {
      window.clearTimeout(videoAreaClickTimerRef.current);
      videoAreaClickTimerRef.current = null;
    }
  }, []);

  const armControlsAutoHide = useCallback(() => {
    setIsControlsVisible(true);
    clearHideControlsTimer();
    hideControlsTimerRef.current = window.setTimeout(() => setIsControlsVisible(false), 2200);
  }, [clearHideControlsTimer]);

  const handlePlayerActivity = useCallback(() => {
    if (!isReady) return;
    armControlsAutoHide();
  }, [armControlsAutoHide, isReady]);

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
    setIsPlayable(false);
    setPlayerLoadError('');
    playableMarkedRef.current = false;
    resumeAppliedRef.current = false;

    if (typeof performance !== 'undefined' && performance.clearMarks) {
      performance.clearMarks('watch-player-ready');
      performance.clearMarks('watch-playable');
      performance.clearMeasures('watch-ready-to-playable');
    }

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
            if (typeof performance !== 'undefined' && performance.mark) {
              performance.mark('watch-player-ready');
            }
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

            if (isPopupWindow && Number.isFinite(popupStartTime) && popupStartTime > 0) {
              event.target.seekTo(popupStartTime, true);
              setCurrentTime(popupStartTime);
              lastKnownTimeRef.current = popupStartTime;
              resumeAppliedRef.current = true;
            }

            if (isPopupWindow && popupShouldPlay === false) {
              event.target.pauseVideo();
              setIsPlaying(false);
              lastKnownPlayingRef.current = false;
            } else {
              event.target.playVideo();
            }
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
            const playing = event.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            lastKnownPlayingRef.current = playing;

            if (playing && !playableMarkedRef.current) {
              playableMarkedRef.current = true;
              setIsPlayable(true);

              if (typeof performance !== 'undefined' && performance.mark) {
                performance.mark('watch-playable');
                try {
                  performance.measure('watch-ready-to-playable', 'watch-player-ready', 'watch-playable');
                } catch {
                  // Ignore if the marks are unavailable in this browser/session.
                }
              }
            }
          },
        },
      });

      pollTimer = window.setInterval(() => {
        const player = playerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;

        const now = Number(player.getCurrentTime() || 0);
        setCurrentTime(now);
        lastKnownTimeRef.current = now;
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
            player.loadVideoById({
              videoId: movie.id,
              startSeconds: now,
              suggestedQuality: desiredQuality,
            });
          }
        }
      }, 500);

      saveTimer = window.setInterval(saveCurrentProgress, 5000);
      window.addEventListener('pagehide', saveCurrentProgress);
      window.addEventListener('beforeunload', saveCurrentProgress);

      playerRef.current.__saveCurrentProgress = saveCurrentProgress;
    }).catch(error => {
      if (isCancelled) return;

      setPlayerLoadError(error?.message || 'Không tải được trình phát YouTube.');
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
  }, [isPopupWindow, movie, popupShouldPlay, popupStartTime]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const activeElement = getFullscreenElement();
      const active = Boolean(activeElement);
      setIsFullscreen(active);
      setIsNativePlayerFullscreen(activeElement === playerSectionRef.current);
      if (active && isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
      }

      if (active) {
        armControlsAutoHide();
      } else if (!isPseudoFullscreen) {
        setIsControlsVisible(true);
        clearHideControlsTimer();
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
  }, [armControlsAutoHide, clearHideControlsTimer, isPseudoFullscreen]);

  useEffect(() => {
    if (!isReady) return undefined;

    const initialHideTimer = window.setTimeout(() => {
      armControlsAutoHide();
    }, 0);

    return () => {
      window.clearTimeout(initialHideTimer);
      clearHideControlsTimer();
    };
  }, [armControlsAutoHide, clearHideControlsTimer, isFullscreen, isPseudoFullscreen, isReady]);

  useEffect(() => {
    if (!isPseudoFullscreen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen, isPseudoFullscreen]);

  useEffect(() => () => clearVideoAreaClickTimer(), [clearVideoAreaClickTimer]);

  const handleTogglePlay = () => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    if (isPlaying) {
      player.pauseVideo();
      setIsPlaying(false);
      lastKnownPlayingRef.current = false;
    } else {
      player.playVideo();
      setIsPlaying(true);
      lastKnownPlayingRef.current = true;
    }
  };

  const handleSeek = value => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    const next = clamp(Number(value), 0, Number(duration || 0));
    player.seekTo(next, true);
    setCurrentTime(next);
    lastKnownTimeRef.current = next;
  };

  const handleVolumeChange = value => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    const next = clamp(Number(value), 0, 100);
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

  const handleSeekByOffset = useCallback(offsetSeconds => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    const current = Number(player.getCurrentTime?.() || 0);
    const durationValue = Number(player.getDuration?.() || 0);
    const next = clamp(current + offsetSeconds, 0, durationValue > 0 ? durationValue : Infinity);

    player.seekTo(next, true);
    setCurrentTime(next);
    lastKnownTimeRef.current = next;
  }, [isReady]);

  const handleVolumeByOffset = useCallback(offsetAmount => {
    const player = playerRef.current;
    if (!player || !isReady) return;

    const currentVolume = clamp(Number(player.getVolume?.() || 0), 0, 100);
    const next = clamp(currentVolume + offsetAmount, 0, 100);

    player.setVolume(next);
    if (next === 0) {
      player.mute();
      setIsMuted(true);
    } else {
      if (player.isMuted?.()) {
        player.unMute();
      }
      setIsMuted(false);
    }

    setVolume(next);
  }, [isReady]);

  useEffect(() => {
    const onKeyDown = event => {
      handlePlayerActivity();

      if (event.key === 'Escape' && isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
        setIsControlsVisible(true);
        clearHideControlsTimer();
      }

      if (event.key === 'Escape') {
        setIsViewMenuOpen(false);
      }

      if (isInteractiveKeyboardTarget(event.target)) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleSeekByOffset(-SEEK_STEP_SECONDS);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSeekByOffset(SEEK_STEP_SECONDS);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleVolumeByOffset(5);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleVolumeByOffset(-5);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearHideControlsTimer, handlePlayerActivity, handleSeekByOffset, handleVolumeByOffset, isPseudoFullscreen]);

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

    setCurrentQuality(normalizeQualityValue(player.getPlaybackQuality?.()));
  };

  const requestElementFullscreen = async element => {
    if (!element) return false;

    try {
      if (typeof element.requestFullscreen === 'function') {
        await element.requestFullscreen();
        return true;
      }

      if (typeof element.webkitRequestFullscreen === 'function') {
        element.webkitRequestFullscreen();
        return true;
      }

      if (typeof element.msRequestFullscreen === 'function') {
        element.msRequestFullscreen();
        return true;
      }
    } catch {
      return false;
    }

    return false;
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

  const closeDetachedPopupWindow = useCallback((restoredState = null) => {
    popupWindowRef.current = null;
    setIsDetachedPopupOpen(false);

    if (popupPollTimerRef.current) {
      window.clearInterval(popupPollTimerRef.current);
      popupPollTimerRef.current = null;
    }

    const player = playerRef.current;
    if (!player || !movie) return;

    const fallbackState = popupRestoreStateRef.current;
    const nextTime = Number.isFinite(restoredState?.time) ? restoredState.time : fallbackState.time;
    const shouldPlay = typeof restoredState?.playing === 'boolean' ? restoredState.playing : fallbackState.playing;

    if (Number.isFinite(nextTime) && nextTime >= 0) {
      player.seekTo(nextTime, true);
      setCurrentTime(nextTime);
      lastKnownTimeRef.current = nextTime;
    }

    if (shouldPlay) {
      player.playVideo();
      setIsPlaying(true);
      lastKnownPlayingRef.current = true;
    } else {
      player.pauseVideo();
      setIsPlaying(false);
      lastKnownPlayingRef.current = false;
    }

  }, [movie]);

  const openDetachedPopupWindow = useCallback(() => {
    if (!movie) return;

    const existingPopup = popupWindowRef.current;
    if (existingPopup && !existingPopup.closed) {
      existingPopup.focus();
      setIsDetachedPopupOpen(true);
      return;
    }

    const player = playerRef.current;
    const nextTime = Number(player?.getCurrentTime?.() || currentTime || lastKnownTimeRef.current || 0);
    const nextPlaying = Boolean(player?.getPlayerState?.() === 1 || isPlaying);
    const popupUrl = new URL(`/watch-popout/${movie.id}`, window.location.origin);
    popupUrl.searchParams.set('t', String(Math.max(0, Math.floor(nextTime))));
    popupUrl.searchParams.set('playing', nextPlaying ? '1' : '0');

    popupRestoreStateRef.current = { time: nextTime, playing: nextPlaying };

    const popupWindow = window.open(
      popupUrl.toString(),
      `hanhan-popup-${movie.id}`,
      'popup=yes,width=1024,height=768,left=80,top=40',
    );

    if (!popupWindow) {
      setPopupNotice('Trình duyệt đã chặn cửa sổ tách rời. Hãy cho phép popup để mở cửa sổ riêng.');
      return;
    }

    setPopupNotice('');
    popupWindowRef.current = popupWindow;
    setIsDetachedPopupOpen(true);

    if (player && typeof player.pauseVideo === 'function') {
      player.pauseVideo();
      setIsPlaying(false);
      lastKnownPlayingRef.current = false;
    }

    if (popupPollTimerRef.current) {
      window.clearInterval(popupPollTimerRef.current);
    }

    popupPollTimerRef.current = window.setInterval(() => {
      if (!popupWindowRef.current || popupWindowRef.current.closed) {
        closeDetachedPopupWindow();
      }
    }, 500);
  }, [closeDetachedPopupWindow, currentTime, isPlaying, movie]);

  useEffect(() => {
    if (isPopupWindow) return undefined;

    const handlePopupMessage = event => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popupWindowRef.current) return;

      const data = event.data;
      if (!data || data.type !== 'hanhan-watch-popup-state' || data.movieId !== movie?.id) return;

      closeDetachedPopupWindow({
        time: Number(data.time),
        playing: Boolean(data.playing),
      });
    };

    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, [closeDetachedPopupWindow, isPopupWindow, movie?.id]);

  useEffect(() => {
    if (!isPopupWindow) return undefined;

    const postPopupState = () => {
      if (!window.opener || !movie) return;

      const player = playerRef.current;
      const state = {
        type: 'hanhan-watch-popup-state',
        movieId: movie.id,
        time: Number(player?.getCurrentTime?.() || lastKnownTimeRef.current || 0),
        playing: Boolean(player?.getPlayerState?.() === 1 || lastKnownPlayingRef.current),
      };

      window.opener.postMessage(state, window.location.origin);
    };

    window.addEventListener('beforeunload', postPopupState);
    window.addEventListener('pagehide', postPopupState);

    return () => {
      postPopupState();
      window.removeEventListener('beforeunload', postPopupState);
      window.removeEventListener('pagehide', postPopupState);
    };
  }, [isPopupWindow, movie]);

  useEffect(() => {
    return () => {
      if (popupPollTimerRef.current) {
        window.clearInterval(popupPollTimerRef.current);
        popupPollTimerRef.current = null;
      }

      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.close();
      }
    };
  }, []);

  const handleFullscreen = async () => {
    const hasNativeFullscreen = Boolean(getFullscreenElement());

    if (hasNativeFullscreen) {
      await exitFullscreen();
      setIsControlsVisible(true);
      clearHideControlsTimer();
      return;
    }

    const enteredNative = await requestElementFullscreen(playerSectionRef.current);
    if (enteredNative) {
      setIsPseudoFullscreen(false);
      armControlsAutoHide();
      return;
    }

    const nextPseudo = !isPseudoFullscreen;
    setIsPseudoFullscreen(nextPseudo);
    if (nextPseudo) {
      armControlsAutoHide();
    } else {
      setIsControlsVisible(true);
      clearHideControlsTimer();
    }
  };

  const handleTogglePopup = () => {
    setIsPseudoFullscreen(false);

    if (isPopupWindow) {
      if (typeof window !== 'undefined') {
        window.close();
      }
      return;
    }

    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close();
      closeDetachedPopupWindow();
      return;
    }

    openDetachedPopupWindow();
  };

  const handleTogglePopupPin = () => {
    setIsPopupPinned(current => {
      const nextPinned = !current;
      setPopupNotice(nextPinned
        ? (isPopupPinHelperSupported
          ? `Windows topmost helper có thể ghim cửa sổ này. ${POPUP_HELPER_PIN_COMMAND}`
          : `Trình duyệt không thể bảo đảm always-on-top; trạng thái ghim này chỉ là nhãn giao diện. ${POPUP_HELPER_PIN_COMMAND}`)
        : `Đã bỏ ghim. ${POPUP_HELPER_UNPIN_COMMAND}`);
      return nextPinned;
    });
  };

  const handleVideoAreaClick = event => {
    if (suppressNextVideoAreaClickRef.current) return;
    if (event.detail > 1) return;

    clearVideoAreaClickTimer();
    videoAreaClickTimerRef.current = window.setTimeout(() => {
      handleTogglePlay();
      videoAreaClickTimerRef.current = null;
    }, 300);
  };

  const handleVideoAreaDoubleClick = event => {
    if (suppressNextVideoAreaClickRef.current) return;

    clearVideoAreaClickTimer();

    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const isLeftHalf = event.clientX < bounds.left + bounds.width / 2;
    const player = playerRef.current;
    if (!player || !isReady) return;

    const current = Number(player.getCurrentTime?.() || currentTime || 0);
    const durationValue = Number(player.getDuration?.() || duration || 0);
    const offset = isLeftHalf ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS;
    const next = Math.min(Math.max(current + offset, 0), durationValue || Infinity);

    player.seekTo(next, true);
    setCurrentTime(next);
    lastKnownTimeRef.current = next;
  };

  const handleVideoAreaPointerUp = event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

    suppressNextVideoAreaClickRef.current = true;
    window.setTimeout(() => {
      suppressNextVideoAreaClickRef.current = false;
    }, 350);

    handleTogglePlay();
  };

  if (!isCatalogLoaded && !movie) {
    return (
      <div className={styles.watchLayout}>
        <div className={styles.container}>
          <p>Đang tải dữ liệu phim...</p>
        </div>
      </div>
    );
  }

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
    <div className={`${styles.watchLayout} ${isPopupWindow ? styles.popupLayout : ''}`}>
      <div className={styles.container}>
        {isPopupWindow ? (
          <div className={styles.popupHeader}>
            <div className={styles.popupHeaderText}>
              <strong>{movieDisplayTitle}</strong>
              <span>Cửa sổ tách rời • {isPopupPinned ? 'Đã ghim' : 'Chưa ghim'}</span>
              <p className={styles.popupHeaderHint}>
                {isPopupPinHelperSupported
                  ? 'Trên Windows, title cửa sổ này khớp helper topmost để giữ popup luôn nổi trên cùng.'
                  : 'Web không thể ép always-on-top; nút ghim chỉ giữ trạng thái và nhắc bạn dùng helper ngoài trình duyệt.'}
              </p>
            </div>
            <div className={styles.popupHeaderActions}>
              <button
                type="button"
                className={`${styles.popupPinBtn} ${isPopupPinned ? styles.popupPinBtnActive : ''}`}
                onClick={handleTogglePopupPin}
                aria-pressed={isPopupPinned}
                title={isPopupPinned ? 'Bỏ ghim cửa sổ' : 'Ghim cửa sổ'}
              >
                {isPopupPinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" className={styles.popupCloseBtn} onClick={handleTogglePopup}>
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => router.back()} className={styles.backBtn}>
            ← Quay lại
          </button>
        )}

        {popupNotice && (
          <p style={{
            margin: '0 0 16px',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(247, 208, 56, 0.12)',
            border: '1px solid rgba(247, 208, 56, 0.32)',
            color: '#f7d038',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}>
            {popupNotice}
          </p>
        )}

        <div
          ref={playerSectionRef}
          className={`${styles.playerSection} ${isPseudoFullscreen ? styles.playerSectionPseudoFullscreen : ''} ${isNativePlayerFullscreen ? styles.playerSectionNativeFullscreen : ''}`}
          data-watch-readiness={isPlayable ? 'playable' : isReady ? 'ready' : 'loading'}
        >
          <div
            className={`${styles.videoContainer} ${(isFullscreen || isPseudoFullscreen) && !isControlsVisible ? styles.videoContainerUiHidden : ''}`}
            onPointerMove={handlePlayerActivity}
            onPointerDown={handlePlayerActivity}
          >
            {playerLoadError ? (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: 24,
                textAlign: 'center',
                color: '#fff',
                background: 'radial-gradient(circle at top, rgba(255, 222, 0, 0.16), rgba(0, 0, 0, 0.96))',
                zIndex: 5,
              }}>
                <strong>Không tải được trình phát YouTube.</strong>
                <p style={{ margin: 0, maxWidth: 520, color: 'rgba(255, 255, 255, 0.78)' }}>
                  {playerLoadError} Vui lòng tải lại trang để thử lại.
                </p>
              </div>
            ) : (
              <>
                <div ref={playerMountRef} className={styles.playerFrame}></div>
                <button
                  type="button"
                  className={styles.interactionBlocker}
                  aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
                  onPointerUp={handleVideoAreaPointerUp}
                  onClick={handleVideoAreaClick}
                  onDoubleClick={handleVideoAreaDoubleClick}
                >
                  {!isPlaying && <span className={styles.centerPlayHint}>▶</span>}
                </button>
                <div className={styles.playerMaskTop}></div>
                <div className={styles.playerMaskLogo}></div>

                <div className={`${styles.inVideoControls} ${!isControlsVisible ? styles.inVideoControlsHidden : ''}`}>
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
                      <button
                        type="button"
                        className={`${styles.controlBtn} ${styles.skipBtn}`}
                        onClick={() => handleSeekByOffset(-SEEK_STEP_SECONDS)}
                        disabled={!isReady}
                        aria-label={`Lùi ${SEEK_STEP_SECONDS} giây`}
                        title={`Lùi ${SEEK_STEP_SECONDS} giây`}
                      >
                        ⏪
                      </button>
                      <button
                        type="button"
                        className={`${styles.controlBtn} ${styles.skipBtn}`}
                        onClick={() => handleSeekByOffset(SEEK_STEP_SECONDS)}
                        disabled={!isReady}
                        aria-label={`Tiến ${SEEK_STEP_SECONDS} giây`}
                        title={`Tiến ${SEEK_STEP_SECONDS} giây`}
                      >
                        ⏩
                      </button>
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
                      <button
                        type="button"
                        className={`${styles.controlBtn} ${styles.skipBtn}`}
                        onClick={handleTogglePopup}
                        aria-pressed={isPopupWindow || isDetachedPopupOpen}
                        title={isPopupWindow || isDetachedPopupOpen ? 'Đóng cửa sổ tách rời' : 'Mở cửa sổ tách rời'}
                      >
                        {isPopupWindow || isDetachedPopupOpen ? 'Đóng cửa sổ' : 'Cửa sổ tách rời'}
                      </button>
                      <button className={styles.controlBtn} onClick={handleFullscreen}>
                        {isFullscreen || isPseudoFullscreen ? '🡽' : '⛶'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {!isPopupWindow && (
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
        )}

        {!isPopupWindow && shouldShowEpisodes && episodes.length > 1 && (
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

        {!isPopupWindow && <AdSlot placement="watchAfterRelated" minHeight={250} />}
      </div>
    </div>
  );
}
