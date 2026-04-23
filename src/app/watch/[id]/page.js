"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const POPOUT_RETURN_TYPE = 'HANHAN_POPOUT_RETURN';
const POPOUT_SYNC_KEY = 'hanhan:popout-sync';

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

export default function WatchPage() {
  const router = useRouter();
  const routeParams = useParams();
  const playerSectionRef = useRef(null);
  const playerMountRef = useRef(null);
  const viewMenuRef = useRef(null);
  const playerRef = useRef(null);
  const pipWindowRef = useRef(null);
  const popoutWatchTimerRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const videoAreaClickTimerRef = useRef(null);
  const suppressNextVideoAreaClickRef = useRef(false);
  const resumeAppliedRef = useRef(false);
  const selectedQualityRef = useRef('auto');
  const qualityEnforceUntilRef = useRef(0);
  const qualityReloadAttemptedRef = useRef(false);
  const lastKnownTimeRef = useRef(0);
  const lastKnownPlayingRef = useRef(true);

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
  const [isNativePlayerFullscreen, setIsNativePlayerFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isSystemPopout, setIsSystemPopout] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

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

  const restoreFromSystemPopout = useCallback((closeWindow = true) => {
    const mainPlayer = playerRef.current;
    const popoutWindow = pipWindowRef.current;
    let syncPayload = null;

    try {
      const raw = window.localStorage.getItem(POPOUT_SYNC_KEY);
      syncPayload = raw ? JSON.parse(raw) : null;
    } catch {
      syncPayload = null;
    }

    let playbackTime = Number(syncPayload?.time ?? mainPlayer?.getCurrentTime?.() ?? lastKnownTimeRef.current ?? currentTime ?? 0);
    if (playbackTime < 1 && lastKnownTimeRef.current > 1) {
      playbackTime = Number(lastKnownTimeRef.current);
    }
    const shouldPlay =
      typeof syncPayload?.playing === 'boolean'
        ? syncPayload.playing
        : Number(mainPlayer?.getPlayerState?.() || 2) === 1 || lastKnownPlayingRef.current;

    if (popoutWatchTimerRef.current) {
      window.clearInterval(popoutWatchTimerRef.current);
      popoutWatchTimerRef.current = null;
    }

    if (closeWindow && popoutWindow && !popoutWindow.closed) {
      popoutWindow.close();
    }

    pipWindowRef.current = null;

    if (mainPlayer && isReady) {
      mainPlayer.seekTo(playbackTime, true);
      if (shouldPlay) {
        mainPlayer.playVideo();
        setIsPlaying(true);
      } else {
        mainPlayer.pauseVideo();
        setIsPlaying(false);
      }
      setCurrentTime(playbackTime);
      lastKnownTimeRef.current = playbackTime;
      lastKnownPlayingRef.current = shouldPlay;
    }

    setIsViewMenuOpen(false);
    setIsControlsVisible(true);
    clearHideControlsTimer();
    setIsSystemPopout(false);
  }, [clearHideControlsTimer, currentTime, isReady]);

  useEffect(() => {
    if (!movie) return;
    pushWatchedMovie(movie);
  }, [movie]);

  useEffect(() => {
    const handlePopoutSync = event => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== POPOUT_RETURN_TYPE) return;
      if (!['return', 'close'].includes(event.data?.action)) return;

      const payload = event.data.payload || null;
      if (payload?.videoId && payload.videoId !== movie?.id) {
        return;
      }

      restoreFromSystemPopout(false);
    };

    window.addEventListener('message', handlePopoutSync);
    return () => {
      window.removeEventListener('message', handlePopoutSync);
    };
  }, [movie?.id, restoreFromSystemPopout]);

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
            const playing = event.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            lastKnownPlayingRef.current = playing;
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

      if (popoutWatchTimerRef.current) {
        window.clearInterval(popoutWatchTimerRef.current);
        popoutWatchTimerRef.current = null;
      }

      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }

      pipWindowRef.current = null;
      setIsSystemPopout(false);
    };
  }, [movie]);

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
    if (!isPseudoFullscreen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen, isPseudoFullscreen]);

  useEffect(() => {
    if (!isViewMenuOpen) return;

    const handlePointerDown = event => {
      if (!viewMenuRef.current?.contains(event.target)) {
        setIsViewMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isViewMenuOpen]);

  useEffect(() => () => clearVideoAreaClickTimer(), [clearVideoAreaClickTimer]);

  const handleTogglePlay = () => {
    const player = playerRef.current;
    if (!player || !isReady || isSystemPopout) return;

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
    if (!player || !isReady || isSystemPopout) return;

    const next = clamp(Number(value), 0, Number(duration || 0));
    player.seekTo(next, true);
    setCurrentTime(next);
    lastKnownTimeRef.current = next;
  };

  const handleVolumeChange = value => {
    const player = playerRef.current;
    if (!player || !isReady || isSystemPopout) return;

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
    if (!player || !isReady || isSystemPopout) return;

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
      if (isFullscreen || isPseudoFullscreen) {
        armControlsAutoHide();
      }

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
        handleSeekByOffset(-15);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSeekByOffset(15);
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
  }, [armControlsAutoHide, clearHideControlsTimer, handleSeekByOffset, handleVolumeByOffset, isFullscreen, isPseudoFullscreen]);

  const handleQualityChange = value => {
    const player = playerRef.current;
    if (!player || !isReady || isSystemPopout) return;

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

  const handlePopout = () => {
    if (isSystemPopout) {
      restoreFromSystemPopout(true);
      return;
    }

    setIsViewMenuOpen(false);
    setIsPseudoFullscreen(false);
    setIsMiniMode(false);
  };

  const startSystemPopout = async () => {
    if (typeof window.open !== 'function' || !movie?.id || !playerRef.current) {
      return false;
    }

    const player = playerRef.current;
    if (!player || !isReady) return false;

    try {
      const startAt = Number(player.getCurrentTime?.() || 0);
      const shouldPlay = Number(player.getPlayerState?.() || 2) === 1;
      const quality = selectedQualityRef.current || 'auto';

      const url = new URL('/watch-popout', window.location.origin);
      url.searchParams.set('id', movie.id);
      url.searchParams.set('t', String(Math.max(0, Math.floor(startAt))));
      url.searchParams.set('playing', shouldPlay ? '1' : '0');
      url.searchParams.set('q', quality);

      const width = 420;
      const height = 300;
      const left = Math.max(0, window.screenX + window.outerWidth - width - 30);
      const top = Math.max(0, window.screenY + window.outerHeight - height - 90);
      const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`;

      const popup = window.open(url.toString(), 'hanhan-mini-web', features);
      if (!popup) return false;

      pipWindowRef.current = popup;
      if (popoutWatchTimerRef.current) window.clearInterval(popoutWatchTimerRef.current);
      popoutWatchTimerRef.current = window.setInterval(() => {
        if (!pipWindowRef.current || pipWindowRef.current.closed) {
          restoreFromSystemPopout(false);
        }
      }, 800);

      player.pauseVideo();
      setIsPlaying(false);

      setIsSystemPopout(true);
      return true;
    } catch {
      return false;
    }
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

  const handleFullscreen = async () => {
    const hasNativeFullscreen = Boolean(getFullscreenElement());

    if (hasNativeFullscreen) {
      await exitFullscreen();
      setIsControlsVisible(true);
      clearHideControlsTimer();
      return;
    }

    setIsMiniMode(false);
    setIsViewMenuOpen(false);

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

  const handleToggleMiniMode = () => {
    if (isSystemPopout) {
      restoreFromSystemPopout(true);
    }

    setIsPseudoFullscreen(false);
    setIsViewMenuOpen(false);
    setIsMiniMode(value => !value);
  };

  const handleToggleSystemPopout = async () => {
    setIsViewMenuOpen(false);
    if (isSystemPopout) {
      restoreFromSystemPopout(true);
      return;
    }

    const opened = await startSystemPopout();
    if (!opened) {
      setIsMiniMode(true);
    }
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
    const offset = isLeftHalf ? -15 : 15;
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
          ref={playerSectionRef}
          className={`${styles.playerSection} ${isMiniMode ? styles.playerSectionMini : ''} ${isPseudoFullscreen ? styles.playerSectionPseudoFullscreen : ''} ${isNativePlayerFullscreen ? styles.playerSectionNativeFullscreen : ''}`}
        >
          <div
            className={`${styles.videoContainer} ${(isFullscreen || isPseudoFullscreen) && !isControlsVisible ? styles.videoContainerUiHidden : ''}`}
            onPointerMove={() => {
              if (!(isFullscreen || isPseudoFullscreen)) return;
              armControlsAutoHide();
            }}
          >
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

            <div className={`${styles.inVideoControls} ${(isFullscreen || isPseudoFullscreen) && !isControlsVisible ? styles.inVideoControlsHidden : ''}`}>
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
                  <div ref={viewMenuRef} className={styles.viewMenuWrap}>
                    <button
                      className={`${styles.controlBtn} ${styles.menuTriggerBtn}`}
                      onClick={() => setIsViewMenuOpen(value => !value)}
                      aria-haspopup="menu"
                      aria-expanded={isViewMenuOpen}
                      title="Tuỳ chọn hiển thị"
                    >
                      ⋯
                    </button>
                    {isViewMenuOpen && (
                      <div className={styles.viewMenu} role="menu" aria-label="Tuỳ chọn hiển thị trình phát">
                        <button type="button" className={styles.viewMenuItem} onClick={handleToggleMiniMode} role="menuitem">
                          {isMiniMode ? 'Tắt mini player' : 'Mini player trong trang'}
                        </button>
                        <button type="button" className={styles.viewMenuItem} onClick={handleToggleSystemPopout} role="menuitem">
                          {isSystemPopout ? 'Tắt popup nổi' : 'Popup nổi (pin trên màn hình)'}
                        </button>
                      </div>
                    )}
                  </div>
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
