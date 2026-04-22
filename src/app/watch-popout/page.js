"use client";
import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

const RETURN_TYPE = 'HANHAN_POPOUT_RETURN';
const SYNC_KEY = 'hanhan:popout-sync';
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

function PopoutContent() {
  const searchParams = useSearchParams();
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const syncTimerRef = useRef(null);

  const videoId = searchParams.get('id') || '';
  const startTime = Number(searchParams.get('t') || '0');
  const shouldPlay = searchParams.get('playing') === '1';
  const quality = searchParams.get('q') || 'auto';

  useEffect(() => {
    if (!videoId || !mountRef.current) return;

    let cancelled = false;

    const sendSync = () => {
      const player = playerRef.current;
      if (!player) return;

      const payload = {
        videoId,
        time: Number(player.getCurrentTime?.() || 0),
        playing: Number(player.getPlayerState?.() || 2) === 1,
        updatedAt: Date.now(),
      };

      try {
        window.localStorage.setItem(SYNC_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage error.
      }

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: RETURN_TYPE, payload }, window.location.origin);
      }
    };

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player || !mountRef.current) return;

      playerRef.current = new window.YT.Player(mountRef.current, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: {
          autoplay: shouldPlay ? 1 : 0,
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
            event.target.seekTo(startTime, true);
            if (quality && quality !== 'auto') {
              event.target.setPlaybackQualityRange?.(quality);
              event.target.setPlaybackQuality(quality);
            }
            if (shouldPlay) {
              event.target.playVideo();
            }
          },
        },
      });

      syncTimerRef.current = window.setInterval(sendSync, 700);
      window.addEventListener('beforeunload', sendSync);
      window.addEventListener('pagehide', sendSync);
    });

    return () => {
      cancelled = true;
      if (syncTimerRef.current) {
        window.clearInterval(syncTimerRef.current);
      }
      const player = playerRef.current;
      if (player) {
        try {
          const payload = {
            videoId,
            time: Number(player.getCurrentTime?.() || 0),
            playing: Number(player.getPlayerState?.() || 2) === 1,
            updatedAt: Date.now(),
          };
          window.localStorage.setItem(SYNC_KEY, JSON.stringify(payload));
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: RETURN_TYPE, payload }, window.location.origin);
          }
        } catch {
          // Ignore storage/postMessage issues.
        }

        player.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, startTime, shouldPlay, quality]);

  const handleReturn = () => {
    const player = playerRef.current;
    const payload = {
      videoId,
      time: Number(player?.getCurrentTime?.() || 0),
      playing: Number(player?.getPlayerState?.() || 2) === 1,
      updatedAt: Date.now(),
    };

    try {
      window.localStorage.setItem(SYNC_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage error.
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: RETURN_TYPE, payload }, window.location.origin);
    }

    window.close();
  };

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#000', margin: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8, background: '#111' }}>
        <button
          type="button"
          onClick={handleReturn}
          style={{
            border: 0,
            background: '#f7d038',
            color: '#000',
            fontWeight: 700,
            padding: '7px 11px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Quay lại web
        </button>
      </div>
      <div ref={mountRef} style={{ width: '100%', height: 'calc(100% - 46px)' }}></div>
    </main>
  );
}

export default function WatchPopoutPage() {
  return (
    <Suspense fallback={null}>
      <PopoutContent />
    </Suspense>
  );
}
