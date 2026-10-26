"use client";

import { useEffect, useState } from "react";
import styles from "./AdOrchestrator.module.css";

const STORAGE_KEY = "hanhan_ad_last_time_v2";
const LEGACY_STORAGE_KEY = "hanhan_ad_cycle_v1";
const COOKIE_NAME = "hanhan_ad_seen";
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 tiếng chuẩn

const DIRECT_LINK_URL = "https://uplcm.com/4/11026171";

function isWithinCooldown() {
  if (typeof window === "undefined") return true;

  // 1. Kiểm tra cookie 6 tiếng
  if (document.cookie.includes(`${COOKIE_NAME}=`)) {
    return true;
  }

  // 2. Kiểm tra LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const time = Number(raw);
      if (Number.isFinite(time) && Date.now() - time < COOLDOWN_MS) {
        return true;
      }
    }

    // Kế thừa mốc thời gian từ phiên bản cũ nếu còn trong 6 tiếng
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyData = JSON.parse(legacyRaw);
      if (legacyData && typeof legacyData.cycleStart === "number") {
        if (Date.now() - legacyData.cycleStart < COOLDOWN_MS) {
          localStorage.setItem(STORAGE_KEY, String(legacyData.cycleStart));
          return true;
        }
      }
    }
  } catch {
    // Bỏ qua lỗi truy cập storage
  }

  return false;
}

function markAdShown() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Bỏ qua lỗi storage
  }

  try {
    // Cookie sống 21600 giây (6 tiếng)
    document.cookie = `${COOKIE_NAME}=1; max-age=21600; path=/; SameSite=Lax`;
  } catch {
    // Bỏ qua lỗi cookie
  }
}

export default function AdOrchestrator() {
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // Kiểm tra cooldown: Nếu chưa hết 6 tiếng -> Tuyệt đối không hiện quảng cáo
    if (!isWithinCooldown()) {
      const frame = window.requestAnimationFrame(() => {
        setShowOverlay(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  const handleOverlayClick = () => {
    // Đánh dấu đã xem ngay lập tức để khóa chặt mọi quảng cáo trong 6 tiếng tiếp theo
    markAdShown();
    setShowOverlay(false);

    try {
      window.open(DIRECT_LINK_URL, "_blank", "noopener,noreferrer");
    } catch {
      // Fallback
    }
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
