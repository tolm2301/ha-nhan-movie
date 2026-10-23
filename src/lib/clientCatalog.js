"use client";

const KEY_CATALOG = "hanhan_client_catalog";
const KEY_SYNCED_AT = "hanhan_catalog_synced_at";
const SYNC_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 tiếng

export function getCachedCatalog() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_CATALOG);
    const syncedAt = Number(localStorage.getItem(KEY_SYNCED_AT)) || 0;
    if (raw) {
      const parsed = JSON.parse(raw);
      const isExpired = Date.now() - syncedAt >= SYNC_INTERVAL_MS;
      return { data: parsed, isExpired, syncedAt };
    }
  } catch {
    // Không làm gián đoạn nếu localStorage lỗi
  }
  return null;
}

export function saveCachedCatalog(data) {
  if (typeof window === "undefined" || !data) return;
  try {
    localStorage.setItem(KEY_CATALOG, JSON.stringify(data));
    localStorage.setItem(KEY_SYNCED_AT, String(Date.now()));
  } catch (err) {
    console.warn("[clientCatalog] Không thể lưu vào LocalStorage:", err);
  }
}

export async function refreshClientCatalog(force = false) {
  if (typeof window === "undefined") return null;

  const cached = getCachedCatalog();
  if (!force && cached && !cached.isExpired && Array.isArray(cached.data?.movies) && cached.data.movies.length > 0) {
    return cached.data;
  }

  try {
    const res = await fetch("/api/movies");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const catalog = await res.json();
    if (catalog && Array.isArray(catalog.movies)) {
      saveCachedCatalog(catalog);
      return catalog;
    }
  } catch (err) {
    console.warn("[clientCatalog] Lỗi nạp catalog mới từ server:", err.message);
    if (cached?.data) return cached.data;
  }
  return null;
}
