"use client";

const KEY_CATALOG = "hanhan_client_catalog";
const KEY_SYNCED_AT = "hanhan_catalog_synced_at";
const SYNC_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 tiếng
const EVENT_CATALOG_UPDATED = "hanhan:catalog-updated";

// Bộ đệm trong bộ nhớ (In-memory Cache) đảm bảo tính bảo toàn tham chiếu (Referential Stability)
// Ngăn ngừa triệt để lỗi "The result of getSnapshot should be cached to avoid an infinite loop" của React useSyncExternalStore
let cachedRaw = null;
let cachedCatalog = null;
let cachedMovies = null;

function notifyCatalogUpdated() {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(EVENT_CATALOG_UPDATED));
    } catch {
      // Bỏ qua lỗi môi trường hạn chế
    }
  }
}

function syncFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_CATALOG);
    if (!raw) {
      cachedRaw = null;
      cachedCatalog = null;
      cachedMovies = null;
      return null;
    }
    if (raw === cachedRaw && cachedMovies) {
      return cachedMovies;
    }
    cachedRaw = raw;
    const parsed = JSON.parse(raw);
    cachedCatalog = parsed;
    cachedMovies = Array.isArray(parsed?.movies) ? parsed.movies : null;
    return cachedMovies;
  } catch {
    return cachedMovies;
  }
}

export function subscribeCatalog(listener) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event) => {
    if (!event.key || event.key === KEY_CATALOG) {
      syncFromStorage();
      listener();
    }
  };

  const handleCustom = () => {
    listener();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT_CATALOG_UPDATED, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT_CATALOG_UPDATED, handleCustom);
  };
}

export function getCatalogMoviesSnapshot() {
  return syncFromStorage();
}

export function getServerCatalogSnapshot() {
  return null;
}

export function getCachedCatalog() {
  if (typeof window === "undefined") return null;
  try {
    syncFromStorage();
    const syncedAt = Number(localStorage.getItem(KEY_SYNCED_AT)) || 0;
    if (cachedCatalog) {
      const isExpired = Date.now() - syncedAt >= SYNC_INTERVAL_MS;
      return { data: cachedCatalog, isExpired, syncedAt };
    }
  } catch {
    // Không làm gián đoạn nếu localStorage bị lỗi
  }
  return null;
}

export function saveCachedCatalog(data) {
  if (typeof window === "undefined" || !data) return;
  try {
    const raw = JSON.stringify(data);
    localStorage.setItem(KEY_CATALOG, raw);
    localStorage.setItem(KEY_SYNCED_AT, String(Date.now()));
    cachedRaw = raw;
    cachedCatalog = data;
    cachedMovies = Array.isArray(data.movies) ? data.movies : null;
    notifyCatalogUpdated();
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