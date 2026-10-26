"use client";

import { useEffect } from "react";

export default function MonetagAd() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tránh chèn trùng lặp script khi chuyển trang trong Next.js (SPA)
    const existing = document.querySelector('script[data-zone="11026815"]');
    if (existing) return;

    try {
      // In-Page Push (Zone 11026815): Thông báo nhỏ góc màn hình, có nút đóng [x], không cướp click, không che video
      const script = document.createElement("script");
      script.src = "https://nap5k.com/tag.min.js";
      script.dataset.zone = "11026815";
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      document.body.appendChild(script);
    } catch (err) {
      console.warn("[Monetag] Lỗi nhúng mã quảng cáo In-Page Push:", err);
    }
  }, []);

  return null;
}
