"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdOrchestrator.module.css";

const STORAGE_KEY = "hanhan_ad_cycle_v3";
const COOKIE_PREFIX = "hanhan_ad_stage_";
const CYCLE_MS = 6 * 60 * 60 * 1000; // Chu kỳ 6 tiếng (21600s)
const POPUNDER_DELAY_MS = 10 * 60 * 1000; // 10 phút sau Direct Link
const VIGNETTE_DELAY_MS = 20 * 60 * 1000; // 20 phút sau Direct Link (10 phút sau Popunder)

const DIRECT_LINK_URL = "https://uplcm.com/4/11026171";
const POPUNDER_ZONE = "11026098";
const POPUNDER_SRC = "https://al5sm.com/tag.min.js";
const VIGNETTE_ZONE = "11026819";
const VIGNETTE_SRC = "https://n6wxm.com/vignette.min.js";

function hasStageCookie(stage) {
  if (typeof document === "undefined") return false;
  return document.cookie.includes(`${COOKIE_PREFIX}${stage}=1`);
}

function setStageCookie(stage, maxAgeSec = 21600) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${COOKIE_PREFIX}${stage}=1; max-age=${maxAgeSec}; path=/; SameSite=Lax`;
  } catch {
    // Bỏ qua lỗi cookie
  }
}

function getCycleState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.cycleStart === "number") {
        if (Date.now() - data.cycleStart < CYCLE_MS) {
          return {
            cycleStart: data.cycleStart,
            directDone: Boolean(data.directDone || hasStageCookie("direct")),
            popunderDone: Boolean(data.popunderDone || hasStageCookie("popunder")),
            vignetteDone: Boolean(data.vignetteDone || hasStageCookie("vignette")),
          };
        }
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Bỏ qua lỗi storage
  }

  if (hasStageCookie("direct")) {
    return {
      cycleStart: Date.now() - 60000,
      directDone: true,
      popunderDone: hasStageCookie("popunder"),
      vignetteDone: hasStageCookie("vignette"),
    };
  }

  return null;
}

function saveCycleState(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Bỏ qua lỗi storage
  }
  const remainingSec = Math.max(60, Math.floor((CYCLE_MS - (Date.now() - state.cycleStart)) / 1000));
  if (state.directDone) setStageCookie("direct", remainingSec);
  if (state.popunderDone) setStageCookie("popunder", remainingSec);
  if (state.vignetteDone) setStageCookie("vignette", remainingSec);
}

// Chạy Vignette trong iframe cô lập hoặc nạp 1 lần rồi khóa cứng 6 tiếng ngay lập tức
function triggerVignetteOnce() {
  if (typeof window === "undefined") return;
  const current = getCycleState();
  if (!current || current.vignetteDone || hasStageCookie("vignette")) return;

  // Khóa trạng thái TRƯỚC khi nạp script để không bao giờ lặp lại lần 2 trong 6 tiếng
  const updated = { ...current, vignetteDone: true };
  saveCycleState(updated);

  if (document.querySelector(`script[data-zone="${VIGNETTE_ZONE}"]`)) return;

  try {
    const s = document.createElement("script");
    s.dataset.zone = VIGNETTE_ZONE;
    s.src = VIGNETTE_SRC;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);

    // Sau 15 giây tự gỡ script khỏi DOM để không bám theo các lần chuyển trang tiếp theo
    window.setTimeout(() => {
      s.remove();
    }, 15000);
  } catch {
    // Bỏ qua lỗi
  }
}

// Nạp Popunder đúng 1 lần, khóa cờ ngay trước khi gắn script và dọn sạch sau click đầu tiên
function triggerPopunderOnce(onDone) {
  if (typeof window === "undefined") return;
  const current = getCycleState();
  if (!current || current.popunderDone || hasStageCookie("popunder")) return;

  // Khóa cứng cờ Popunder NGAY LẬP TỨC trước khi nạp script để F5/đổi trang không bao giờ nạp lại
  const updated = { ...current, popunderDone: true };
  saveCycleState(updated);

  if (document.querySelector(`script[data-zone="${POPUNDER_ZONE}"]`)) return;

  try {
    const s = document.createElement("script");
    s.dataset.zone = POPUNDER_ZONE;
    s.src = POPUNDER_SRC;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);

    const cleanupAfterFirstClick = () => {
      window.removeEventListener("click", cleanupAfterFirstClick, true);
      window.setTimeout(() => {
        s.remove();
      }, 600);
      if (typeof onDone === "function") onDone();
    };

    window.addEventListener("click", cleanupAfterFirstClick, true);
  } catch {
    // Bỏ qua lỗi
  }
}

export default function AdOrchestrator() {
  const [showOverlay, setShowOverlay] = useState(false);
  const timersRef = useRef([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    const state = getCycleState();

    // Bước 1: Chưa bắt đầu chu kỳ 6h -> Hiện overlay Direct Link
    if (!state || !state.directDone) {
      const frame = window.requestAnimationFrame(() => {
        setShowOverlay(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const elapsed = Date.now() - state.cycleStart;

    // Bước 2: Lên lịch đúng 1 lượt Popunder (mốc 10 phút)
    if (!state.popunderDone) {
      const waitPop = Math.max(0, POPUNDER_DELAY_MS - elapsed);
      const tPop = window.setTimeout(() => {
        triggerPopunderOnce(() => {
          const tVig = window.setTimeout(() => {
            triggerVignetteOnce();
          }, 10 * 60 * 1000);
          timersRef.current.push(tVig);
        });
      }, waitPop);
      timersRef.current.push(tPop);
      return () => clearAllTimers();
    }

    // Bước 3: Lên lịch đúng 1 lượt Vignette Banner (mốc 20 phút)
    if (!state.vignetteDone) {
      const waitVig = Math.max(0, VIGNETTE_DELAY_MS - elapsed);
      const tVig = window.setTimeout(() => {
        triggerVignetteOnce();
      }, waitVig);
      timersRef.current.push(tVig);
    }

    return () => clearAllTimers();
  }, []);

  const handleOverlayClick = () => {
    const newState = {
      cycleStart: Date.now(),
      directDone: true,
      popunderDone: false,
      vignetteDone: false,
    };
    saveCycleState(newState);
    setShowOverlay(false);

    try {
      window.open(DIRECT_LINK_URL, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback
    }

    clearAllTimers();
    const tPop = window.setTimeout(() => {
      triggerPopunderOnce(() => {
        const tVig = window.setTimeout(() => {
          triggerVignetteOnce();
        }, 10 * 60 * 1000);
        timersRef.current.push(tVig);
      });
    }, POPUNDER_DELAY_MS);
    timersRef.current.push(tPop);
  };

  if (!showOverlay) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") handleOverlayClick();
      }}
      role="button"
      tabIndex={0}
      aria-label="Nhấn để bắt đầu xem phim"
    >
      <div className={styles.welcomePill}>
        <span className={styles.dot}></span>
        <span>Nhấn bất kỳ đâu để bắt đầu xem phim</span>
      </div>
    </div>
  );
}
