"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshClientCatalog } from "@/lib/clientCatalog";

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // 1. Kiểm tra và nạp toàn bộ danh mục vào localStorage (nếu chưa có hoặc quá 5 tiếng)
    refreshClientCatalog(false);

    // 2. Chu kỳ 5 tiếng (18,000,000 ms): Tự động nạp ngầm phiên bản mới nhất từ server
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const intervalId = setInterval(() => {
      refreshClientCatalog(true).then(() => {
        router.refresh();
      });
    }, FIVE_HOURS_MS);

    return () => clearInterval(intervalId);
  }, [router]);

  return null;
}
