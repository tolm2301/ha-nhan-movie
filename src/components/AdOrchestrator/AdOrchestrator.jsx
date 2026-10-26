"use client";

import { useEffect, useState } from "react";
import styles from "./AdOrchestrator.module.css";

const STORAGE_KEY = "hanhan_ad_cycle_v1";
const CYCLE_MS = 6 * 60 * 60 * 1000; // 6 tiếng
const POPUNDER_DELAY_MS = 10 * 60 * 1000; // 10 phút
const BANNER_DELAY_MS = 20 * 60 * 1000; // 20 phút (10 phút sau popunder)

const DIRECT_LINK_URL = "https://uplcm.com/4/11026171";
const POPUNDER_ZONE = "11026098";
const POPUNDER_SRC = "https://al5sm.com/tag.min.js";
const VIGNETTE_ZONE = "11026819";
const VIGNETTE_SRC = "https://n6wxm.com/vignette.min.js";

function getCycleState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.cycleStart === "number") {
      if (Date.now() - data.cycleStart >= CYCLE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    }
  } catch {
    // Bỏ qua lỗi truy cập storage
  }
  return null;
}

function saveCycleState(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Bỏ qua lỗi
  }
}

function activateBanner() {
  if (typeof window === "undefined") return;
  const currentState = getCycleState();
  if (!currentState || currentState.bannerDone) return;

  const existing = document.querySelector(`script[data-zone="${VIGNETTE_ZONE}"]`);
  if (existing) return;

  try {
    const s = document.createElement("script");
    s.dataset.zone = VIGNETTE_ZONE;
    s.src = VIGNETTE_SRC;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);

    setTimeout(() => {
      const sUpdated = getCycleState() || currentState;
      sUpdated.bannerDone = true;
      saveCycleState(sUpdated);
    }, 4000);
  } catch (err) {
    console.warn("[AdOrchestrator] Banner error:", err);
  }
}

function activatePopunder() {
  if (typeof window === "undefined") return;
  const currentState = getCycleState();
  if (!currentState || currentState.popunderDone) return;

  const existing = document.querySelector(`script[data-zone="${POPUNDER_ZONE}"]`);
  if (existing) return;

  try {
    const s = document.createElement("script");
    s.dataset.zone = POPUNDER_ZONE;
    s.src = POPUNDER_SRC;
    s.async = true;
    s.setAttribute("data-cfasync", "false");
    document.body.appendChild(s);

    const onFirstInteraction = () => {
      setTimeout(() => {
        const sUpdated = getCycleState() || currentState;
        sUpdated.popunderDone = true;
        saveCycleState(sUpdated);

        const injected = document.querySelector(`script[data-zone="${POPUNDER_ZONE}"]`);
        if (injected) injected.remove();

        window.removeEventListener("click", onFirstInteraction, true);

        // Lên lịch cho giai đoạn tiếp theo: Banner sau 10 phút nữa
        setTimeout(() => {
          activateBanner();
        }, 10 * 60 * 1000);
      }, 800);
    };

    window.addEventListener("click", onFirstInteraction, true);
  } catch (err) {
    console.warn("[AdOrchestrator] Popunder error:", err);
  }
}

export default function AdOrchestrator() {
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const state = getCycleState();

    // 1. GIAI ĐOẠN 1: Nếu chưa có chu kỳ (hoặc đã quá 6 tiếng) -> Kích hoạt Overlay Direct Link
    if (!state || !state.directDone) {
      const frame = window.requestAnimationFrame(() => {
        setShowOverlay(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    // 2. GIAI ĐOẠN 2 & 3: Kiểm tra tiến độ theo thời gian đã trôi qua
    const now = Date.now();
    const elapsed = now - state.cycleStart;

    // A. Lên lịch Popunder (sau 10 phút)
    if (!state.popunderDone) {
      const popunderWait = Math.max(0, POPUNDER_DELAY_MS - elapsed);
      const popunderTimer = setTimeout(() => {
        activatePopunder();
      }, popunderWait);

      return () => clearTimeout(popunderTimer);
    }

    // B. Lên lịch Banner/Vignette (sau 20 phút)
    if (state.popunderDone && !state.bannerDone) {
      const bannerWait = Math.max(0, BANNER_DELAY_MS - elapsed);
      const bannerTimer = setTimeout(() => {
        activateBanner();
      }, bannerWait);

      return () => clearTimeout(bannerTimer);
    }

    // C. Khi cả 3 đã hoàn tất: Toàn bộ quảng cáo ngủ đông đến hết 6 tiếng
    const remainingCycle = Math.max(0, CYCLE_MS - elapsed);
    const resetTimer = setTimeout(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Bỏ qua lỗi
      }
      setShowOverlay(true);
    }, remainingCycle);

    return () => clearTimeout(resetTimer);
  }, []);

  const handleOverlayClick = () => {
    try {
      window.open(DIRECT_LINK_URL, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback
    }

    setShowOverlay(false);

    const newState = {
      cycleStart: Date.now(),
      directDone: true,
      popunderDone: false,
      bannerDone: false,
    };
    saveCycleState(newState);

    setTimeout(() => {
      activatePopunder();
    }, POPUNDER_DELAY_MS);
  };

  if (!showOverlay) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
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
