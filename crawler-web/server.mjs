import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

// Nạp cấu hình môi trường từ .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envLocalPath);
  } catch (error) {
    console.warn('[Local Crawler] Không thể nạp .env.local:', error.message);
  }
}

// Import các module lõi từ src/lib
const { runCrawl, serializeError } = await import('../src/lib/crawl.server.js');
const {
  describeDatabaseTarget,
  hasDatabaseConfig,
  loadPersistedMovies,
  loadChannelRegistry,
  updateChannelRegistryEntry,
  addChannelRegistryEntry,
  deleteChannelRegistryEntry,
  loadChannelSuggestions,
  deletePersistedMovies,
} = await import('../src/lib/movieStore.server.js');
const {
  readMovieSnapshot,
  writeMovieSnapshot,
} = await import('../src/lib/movieSnapshot.server.js');

const PORT = Number(process.env.CRAWLER_PORT) || 4000;
const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

const logHistory = [];
const MAX_LOG_HISTORY = 300;

function pushLog(type, message, details = null) {
  const item = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    time: new Date().toLocaleTimeString('vi-VN'),
    type,
    message,
    details,
  };
  logHistory.push(item);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
  logEmitter.emit('log', item);
}

// Chuyển tiếp console log sang SSE
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  originalConsoleLog(...args);
  const text = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
  pushLog('info', text);
};

console.error = (...args) => {
  originalConsoleError(...args);
  const text = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
  pushLog('error', text);
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  const text = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
  pushLog('warn', text);
};

let isCrawlRunning = false;
let lastCrawlResult = null;

// ==========================================
// BỘ NHỚ ĐỆM SERVER (SERVER RAM CACHE)
// ==========================================
let cachedMovies = null;
let cachedMoviesTime = 0;
let cachedChannels = null;
let cachedChannelsTime = 0;
const CACHE_TTL_MS = 60000;

async function getCachedMovies(force = false) {
  const now = Date.now();
  if (!force && cachedMovies && now - cachedMoviesTime < CACHE_TTL_MS) {
    return deletionQueue.size > 0 ? cachedMovies.filter(m => !deletionQueue.has(m.id)) : cachedMovies;
  }
  try {
    const loaded = await loadPersistedMovies({ allowJsonFallback: true });
    cachedMovies = loaded;
    cachedMoviesTime = Date.now();
    return deletionQueue.size > 0 ? cachedMovies.filter(m => !deletionQueue.has(m.id)) : cachedMovies;
  } catch (err) {
    if (cachedMovies) return deletionQueue.size > 0 ? cachedMovies.filter(m => !deletionQueue.has(m.id)) : cachedMovies;
    throw err;
  }
}

async function getCachedChannels(force = false) {
  const now = Date.now();
  if (!force && cachedChannels && now - cachedChannelsTime < CACHE_TTL_MS) {
    return cachedChannels;
  }
  try {
    cachedChannels = await loadChannelRegistry({ allowJsonFallback: true, includeDisabled: true });
    cachedChannelsTime = Date.now();
    return cachedChannels;
  } catch (err) {
    if (cachedChannels) return cachedChannels;
    throw err;
  }
}

// ==========================================
// HÀNG ĐỢI XOÁ PHIM TÁCH BIỆT (1-MINUTE BUFFER QUEUE)
// Màn hình cứ xoá trong 0ms, Server cứ 1 phút quét hàng đợi để xoá DB
// ==========================================
const DELETION_QUEUE_FILE = path.join(process.cwd(), 'crawler-web', '.deletion-queue.json');
const deletionQueue = new Set();
let isFlushingDeletionQueue = false;

function saveDeletionQueueToDisk() {
  try {
    fs.writeFileSync(DELETION_QUEUE_FILE, JSON.stringify(Array.from(deletionQueue)), 'utf8');
  } catch (err) {}
}

function loadDeletionQueueFromDisk() {
  try {
    if (fs.existsSync(DELETION_QUEUE_FILE)) {
      const content = fs.readFileSync(DELETION_QUEUE_FILE, 'utf8');
      const ids = JSON.parse(content || '[]');
      if (Array.isArray(ids)) {
        ids.forEach(id => deletionQueue.add(String(id)));
      }
      if (deletionQueue.size > 0) {
        pushLog('info', `[Khởi động] Nạp lại ${deletionQueue.size} phim rác đang chờ xoá từ hàng đợi`);
      }
    }
  } catch (err) {}
}

loadDeletionQueueFromDisk();

async function flushDeletionQueue() {
  if (deletionQueue.size === 0 || isFlushingDeletionQueue) {
    return;
  }

  isFlushingDeletionQueue = true;
  const batchIds = Array.from(deletionQueue);
  deletionQueue.clear();
  saveDeletionQueueToDisk();

  try {
    pushLog('info', `[Bộ đệm xoá 1 phút] Bắt đầu đồng bộ ${batchIds.length} phim rác lên PostgreSQL & Snapshot...`);
    const result = await deletePersistedMovies(batchIds);
    pushLog('info', `[Bộ đệm xoá 1 phút] Đã xoá sạch ${result.count} phim rác khỏi PostgreSQL và movies.json!`);
  } catch (err) {
    // Nếu có lỗi, đưa lại vào queue để thử lại ở chu kỳ 1 phút tiếp theo
    batchIds.forEach(id => deletionQueue.add(id));
    saveDeletionQueueToDisk();
    pushLog('error', `[Bộ đệm xoá 1 phút] Lỗi đồng bộ DB: ${err.message}. Đã lưu lại hàng đợi để thử lại.`);
  } finally {
    isFlushingDeletionQueue = false;
  }
}

// Tự động quét hàng đợi mỗi 60 giây (1 phút)
setInterval(flushDeletionQueue, 60000);

async function getSystemStatus() {
  const dbTarget = describeDatabaseTarget();
  let dbMoviesCount = cachedMovies ? cachedMovies.length : null;
  let dbError = null;

  if (cachedMovies === null && hasDatabaseConfig()) {
    try {
      const persisted = await getCachedMovies();
      dbMoviesCount = persisted.length;
    } catch (err) {
      dbError = err.message;
    }
  }

  let snapshotMeta = null;
  let snapshotCount = cachedMovies ? cachedMovies.length : 0;
  try {
    const snapshot = await readMovieSnapshot();
    snapshotCount = snapshot.movies.length;
    snapshotMeta = {
      generatedAt: snapshot.generatedAt,
      source: snapshot.source,
      stale: snapshot.stale,
    };
  } catch (err) {
    snapshotMeta = { error: err.message };
  }

  const channels = await getCachedChannels();
  const channelsCount = channels ? channels.length : 0;

  return {
    crawlerState: isCrawlRunning ? 'running' : 'idle',
    lastCrawlResult,
    hasDatabase: hasDatabaseConfig(),
    dbTarget,
    dbMoviesCount: dbMoviesCount ?? snapshotCount,
    dbError,
    snapshotCount,
    snapshotMeta,
    channelsCount,
    deletionQueueCount: deletionQueue.size,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // SSE Stream log
  if (pathname === '/api/crawl/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'history', logs: logHistory })}\n\n`);

    const logListener = logItem => {
      res.write(`data: ${JSON.stringify({ type: 'single', log: logItem })}\n\n`);
    };

    logEmitter.on('log', logListener);

    req.on('close', () => {
      logEmitter.off('log', logListener);
    });
    return;
  }

  // REST API: Trạng thái hệ thống (< 2ms)
  if (pathname === '/api/status' && req.method === 'GET') {
    try {
      const status = await getSystemStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // REST API: Lấy toàn bộ danh sách phim để lưu đệm vào LocalStorage trên trình duyệt
  if (pathname === '/api/movies/all' && req.method === 'GET') {
    try {
      const forceRefresh = url.searchParams.get('refresh') === '1';
      const movies = await getCachedMovies(forceRefresh);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        movies,
        total: movies.length,
        syncedAt: new Date().toISOString(),
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // REST API: Lấy danh sách phim phân trang fallback
  if (pathname === '/api/movies' && req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '24', 10)));
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const category = (url.searchParams.get('category') || '').trim().toLowerCase();
      const forceRefresh = url.searchParams.get('refresh') === '1';

      let movies = await getCachedMovies(forceRefresh);

      if (category && category !== 'all') {
        movies = movies.filter(m => {
          const mCat = String(m.categorySlug || m.tags || '').toLowerCase();
          return mCat.includes(category);
        });
      }

      if (search) {
        movies = movies.filter(m => {
          const text = `${m.title || ''} ${m.displayTitle || ''} ${m.id || ''} ${m.tags || ''}`.toLowerCase();
          return text.includes(search);
        });
      }

      const total = movies.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const startIndex = (page - 1) * limit;
      const paginatedMovies = movies.slice(startIndex, startIndex + limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        movies: paginatedMovies,
        total,
        page,
        limit,
        totalPages,
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // REST API: Đẩy phim vào hàng đợi xoá (Phản hồi < 1ms, không nghẽn màn hình)
  if (pathname === '/api/movies/queue-delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ids = payload.ids || (payload.id ? [payload.id] : []);
        if (!ids.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Thiếu ID phim cần xoá' }));
          return;
        }

        // 1. Đưa vào hàng đợi xoá DB
        ids.forEach(id => deletionQueue.add(String(id)));
        saveDeletionQueueToDisk();

        // 2. Cập nhật RAM server tức thì
        if (cachedMovies) {
          const deleteSet = new Set(ids);
          cachedMovies = cachedMovies.filter(m => !deleteSet.has(m.id));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          queued: ids.length,
          totalInQueue: deletionQueue.size,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // REST API: Xả hàng đợi xoá ngay lập tức (thủ công)
  if (pathname === '/api/movies/flush-queue' && req.method === 'POST') {
    flushDeletionQueue()
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, remaining: deletionQueue.size }));
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // REST API: Lấy danh bạ kênh (< 5ms)
  if (pathname === '/api/channels' && req.method === 'GET') {
    try {
      const forceRefresh = url.searchParams.get('refresh') === '1';
      const channels = await getCachedChannels(forceRefresh);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ channels }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // REST API: Thêm kênh mới
  if (pathname === '/api/channels/add' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await addChannelRegistryEntry(payload);
        cachedChannels = null;
        pushLog('info', `[Kênh mới] Đã thêm kênh "${payload.displayName}" (${payload.channelUrl})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, channel: result.channel }));
      } catch (error) {
        pushLog('error', `[Kênh mới] Lỗi thêm kênh: ${error.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // REST API: Xoá kênh
  if (pathname === '/api/channels/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { slug } = JSON.parse(body || '{}');
        if (!slug) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Thiếu slug kênh' }));
          return;
        }

        await deleteChannelRegistryEntry(slug);
        if (cachedChannels) {
          cachedChannels = cachedChannels.filter(c => c.slug !== slug && c.id !== slug);
        }
        pushLog('info', `[Xoá kênh] Đã xoá kênh ${slug} khỏi danh bạ và cơ sở dữ liệu`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, deletedSlug: slug }));
      } catch (error) {
        pushLog('error', `[Xoá kênh] Lỗi xoá kênh: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // REST API: Bật/Tắt kênh
  if (pathname === '/api/channels/toggle' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { slug, enabled } = JSON.parse(body || '{}');
        if (!slug) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Thiếu slug kênh' }));
          return;
        }

        const result = await updateChannelRegistryEntry(slug, { enabled: Boolean(enabled) });
        if (cachedChannels) {
          const ch = cachedChannels.find(c => c.slug === slug || c.id === slug);
          if (ch) ch.enabled = Boolean(enabled);
        }
        pushLog('info', `[Kênh] Cập nhật trạng thái kênh ${slug} -> enabled: ${Boolean(enabled)}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // REST API: Kích hoạt Crawl
  if (pathname === '/api/crawl/start' && req.method === 'POST') {
    if (isCrawlRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tiến trình crawl đang thực thi. Vui lòng đợi phiên hiện tại kết thúc.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const options = JSON.parse(body || '{}');
      const dryRun = Boolean(options.dryRun);
      const syncSnapshot = options.syncSnapshot !== false;
      const strictMode = options.strictMode !== false;

      isCrawlRunning = true;
      pushLog('info', `[Crawl] Bắt đầu phiên cào mới (dryRun=${dryRun}, syncSnapshot=${syncSnapshot})`);

      runCrawl({ dryRun, syncSnapshot, strictMode })
        .then(result => {
          lastCrawlResult = {
            ok: true,
            at: new Date().toISOString(),
            newVideos: result.newVideos,
            fetchedCount: result.fetchedCount,
            persistedCatalogTotal: result.persistedCatalogTotal,
            summary: result.summary,
          };
          cachedMovies = null;
          pushLog('info', `[Crawl] Hoàn tất thành công! Video mới: ${result.newVideos}, Tổng phim: ${result.persistedCatalogTotal}`);
        })
        .catch(error => {
          lastCrawlResult = {
            ok: false,
            at: new Date().toISOString(),
            error: serializeError(error),
          };
          pushLog('error', `[Crawl] Thất bại: ${error.message}`);
        })
        .finally(() => {
          isCrawlRunning = false;
        });

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Đã kích hoạt tiến trình crawl' }));
    });
    return;
  }

  // REST API: Đồng bộ Snapshot thủ công
  if (pathname === '/api/snapshot/sync' && req.method === 'POST') {
    try {
      pushLog('info', '[Snapshot] Bắt đầu đồng bộ tệp snapshot movies.json từ Postgres...');
      const movies = await loadPersistedMovies({ allowJsonFallback: false });
      const result = await writeMovieSnapshot(movies, { source: 'db-manual-sync' });
      cachedMovies = movies;
      pushLog('info', `[Snapshot] Đồng bộ thành công ${movies.length} phim vào tệp movies.json!`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, total: movies.length, result }));
    } catch (error) {
      pushLog('error', `[Snapshot] Lỗi đồng bộ: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Phục vụ tệp tĩnh
  const publicDir = path.resolve(process.cwd(), 'crawler-web/public');
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  BỘ ĐIỀU KHIỂN CÀO & QUẢN LÝ CỤC BỘ (LOCAL CONTROL)`);
  console.log(`  Bảng điều khiển: http://localhost:${PORT}`);
  console.log(`  Trạng thái DB:   ${hasDatabaseConfig() ? 'Đã kết nối' : 'Chưa có cấu hình (chế độ JSON)'}`);
  console.log(`  Bộ đệm xoá DB:   Tự động gom mẻ & xoá DB mỗi 1 phút`);
  console.log(`======================================================\n`);
});
