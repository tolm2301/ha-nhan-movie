const terminal = document.getElementById('terminal');
let currentTab = 'dashboard';
let currentMoviePage = 1;
const moviePageLimit = 24;
const selectedMovieIds = new Set();

// ==========================================
// BỘ ĐỆM LOCALSTORAGE CHO PHIM (BUFFER ZONE)
// ==========================================
const KEY_BUFFER_MOVIES = 'hanhan_buffer_movies';
const KEY_PENDING_DELETES = 'hanhan_pending_deletes';
const KEY_SYNCED_AT = 'hanhan_movies_synced_at';

let bufferMovies = [];
let pendingDeleteIds = new Set();
let countdownSec = 10;
let countdownInterval = null;

// Khởi tạo hàng đợi xoá từ LocalStorage nếu có phiên trước dở dang
try {
  const savedPending = localStorage.getItem(KEY_PENDING_DELETES);
  if (savedPending) {
    const parsed = JSON.parse(savedPending);
    if (Array.isArray(parsed) && parsed.length > 0) {
      pendingDeleteIds = new Set(parsed);
    }
  }
} catch {
  pendingDeleteIds = new Set();
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabName));
  if (activeBtn) activeBtn.classList.add('active');

  const targetTab = document.getElementById('tab-' + tabName);
  if (targetTab) targetTab.classList.add('active');

  if (tabName === 'movies') {
    initMovies();
  }
}

function appendLog(time, text, type = 'info') {
  if (!terminal) return;
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = '<span class="log-time">[' + time + ']</span> <span class="log-text ' + type + '">' + escapeHtml(text) + '</span>';
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearLogs() {
  if (terminal) terminal.innerHTML = '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initSSE() {
  const eventSource = new EventSource('/api/crawl/logs');
  eventSource.onmessage = event => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'history') {
        payload.logs.forEach(log => appendLog(log.time, log.message, log.type));
      } else if (payload.type === 'single') {
        appendLog(payload.log.time, payload.log.message, payload.log.type);
        loadStatus();
      }
    } catch (e) {
      console.error('Lỗi SSE:', e);
    }
  };
}

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const badge = document.getElementById('crawlerBadge');
    const runBtn = document.getElementById('btnRunCrawl');
    if (data.crawlerState === 'running') {
      badge.className = 'badge running';
      badge.textContent = 'Đang Cào Dữ Liệu...';
      if (runBtn) runBtn.disabled = true;
    } else {
      badge.className = 'badge';
      badge.textContent = 'Sẵn sàng (Idle)';
      if (runBtn) runBtn.disabled = false;
    }

    const dbStatus = document.getElementById('statDbStatus');
    const dbHost = document.getElementById('statDbHost');
    if (data.hasDatabase && !data.dbError) {
      dbStatus.textContent = 'Đã Kết Nối';
      dbStatus.style.color = 'var(--accent-green)';
      dbHost.textContent = data.dbTarget?.host || 'Supabase Direct';
    } else {
      dbStatus.textContent = 'Chế độ Snapshot';
      dbStatus.style.color = 'var(--accent-red)';
      dbHost.textContent = data.dbError || 'Tệp tĩnh JSON';
    }

    const localCount = bufferMovies.length > 0 ? bufferMovies.length : (data.dbMoviesCount || data.snapshotCount);
    document.getElementById('statDbMovies').textContent = (data.dbMoviesCount != null ? data.dbMoviesCount : 0).toLocaleString('vi-VN');
    document.getElementById('statSnapshotMovies').textContent = (data.snapshotCount || 0).toLocaleString('vi-VN');
    document.getElementById('statChannels').textContent = data.channelsCount || 0;
    document.getElementById('tabMovieCount').textContent = localCount.toLocaleString('vi-VN');
    document.getElementById('tabChannelCount').textContent = data.channelsCount || 0;

    if (data.snapshotMeta?.generatedAt) {
      const dt = new Date(data.snapshotMeta.generatedAt);
      document.getElementById('statSnapshotTime').textContent = 'Lần sinh: ' + dt.toLocaleTimeString('vi-VN') + ' ' + dt.toLocaleDateString('vi-VN');
    }
  } catch (err) {
    console.error('Lỗi loadStatus:', err);
  }
}

// ==========================================
// QUẢN LÝ PHIM VỚI LOCALSTORAGE (0MS DELAY)
// ==========================================
async function initMovies(forceFetch = false) {
  const grid = document.getElementById('movieGrid');

  // 1. Kiểm tra bộ đệm LocalStorage
  if (!forceFetch) {
    try {
      const cached = localStorage.getItem(KEY_BUFFER_MOVIES);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          bufferMovies = parsed.filter(m => !pendingDeleteIds.has(m.id));
          renderMoviesFromBuffer();
          if (pendingDeleteIds.size > 0) {
            scheduleSync();
          }
          return;
        }
      }
    } catch {
      // LocalStorage hỏng hoặc rỗng -> tải mới
    }
  }

  // 2. Tải toàn bộ phim từ Server về LocalStorage
  grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--accent-yellow); font-size:1.1rem;">⚡ Đang nạp toàn bộ danh sách phim từ Database vào bộ đệm LocalStorage...</div>';

  try {
    const res = await fetch('/api/movies/all' + (forceFetch ? '?refresh=1' : ''));
    const data = await res.json();
    const rawMovies = data.movies || [];

    bufferMovies = rawMovies.filter(m => !pendingDeleteIds.has(m.id));
    localStorage.setItem(KEY_BUFFER_MOVIES, JSON.stringify(bufferMovies));
    localStorage.setItem(KEY_SYNCED_AT, new Date().toISOString());

    renderMoviesFromBuffer();
    if (pendingDeleteIds.size > 0) {
      scheduleSync();
    }
  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--accent-red);">Lỗi kết nối tải phim: ' + err.message + '</div>';
  }
}

function loadMovies(force = false) {
  initMovies(force);
}

function renderMoviesFromBuffer() {
  const grid = document.getElementById('movieGrid');
  const search = document.getElementById('movieSearchInput').value.trim().toLowerCase();
  const category = document.getElementById('movieCategorySelect').value.toLowerCase();

  // Lọc tức thì trong RAM (0ms)
  let filtered = bufferMovies;
  if (category && category !== 'all') {
    filtered = filtered.filter(m => {
      const mCat = String(m.categorySlug || m.tags || '').toLowerCase();
      return mCat.includes(category);
    });
  }

  if (search) {
    filtered = filtered.filter(m => {
      const text = `${m.title || ''} ${m.displayTitle || ''} ${m.id || ''} ${m.tags || ''}`.toLowerCase();
      return text.includes(search);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / moviePageLimit));
  if (currentMoviePage > totalPages) currentMoviePage = totalPages;
  if (currentMoviePage < 1) currentMoviePage = 1;

  const startIndex = (currentMoviePage - 1) * moviePageLimit;
  const pageMovies = filtered.slice(startIndex, startIndex + moviePageLimit);

  document.getElementById('tabMovieCount').textContent = bufferMovies.length.toLocaleString('vi-VN');
  document.getElementById('pageInfoText').textContent = 'Trang ' + currentMoviePage + ' / ' + totalPages + ' (' + total.toLocaleString('vi-VN') + ' phim)';

  document.getElementById('btnPrevPage').disabled = currentMoviePage <= 1;
  document.getElementById('btnNextPage').disabled = currentMoviePage >= totalPages;

  selectedMovieIds.clear();
  updateSelectedUI();

  if (!pageMovies.length) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--text-muted); font-size: 1.1rem;">Không tìm thấy bộ phim nào phù hợp trong bộ đệm.</div>';
    return;
  }

  grid.innerHTML = pageMovies.map(movie => {
    const isChecked = selectedMovieIds.has(movie.id);
    const thumb = movie.thumbnail || ('/api/movie-thumbnail?title=' + encodeURIComponent(movie.title || '') + '&tag=' + encodeURIComponent(movie.tags || 'Phim'));

    return '<div class="movie-card" id="card-' + movie.id + '">' +
      '<div class="movie-thumb-wrap">' +
        '<input type="checkbox" class="movie-select-chk" value="' + movie.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="toggleSelectMovie(\'' + movie.id + '\', this.checked)">' +
        '<img src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(movie.title) + '" class="movie-thumb" loading="lazy" onerror="this.src=\'/api/movie-thumbnail?title=Video&tag=Phim\'">' +
        '<span class="movie-ep-tag">' + escapeHtml(movie.episodes || 'Full') + '</span>' +
      '</div>' +
      '<div class="movie-body">' +
        '<div>' +
          '<h4 class="movie-title" title="' + escapeHtml(movie.title) + '">' + escapeHtml(movie.displayTitle || movie.title) + '</h4>' +
          '<div class="movie-meta-row">' +
            '<span class="movie-category-tag">' + escapeHtml(movie.tags || 'Khác') + '</span>' +
            '<span>👁 ' + escapeHtml(movie.views || '0') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="movie-actions">' +
          '<a href="https://www.youtube.com/watch?v=' + movie.id + '" target="_blank" rel="noreferrer" class="btn-action btn-preview" title="Xem trên YouTube">▶ Xem Thử</a>' +
          '<button class="btn-action btn-delete" onclick="deleteSingleMovie(\'' + movie.id + '\', \'' + escapeHtml(movie.title).replace(/'/g, "\\'") + '\')" title="Xoá phim này vào bộ đệm">🗑️ Xoá</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function searchMovies() {
  currentMoviePage = 1;
  renderMoviesFromBuffer();
}

function resetMovieFilter() {
  document.getElementById('movieSearchInput').value = '';
  document.getElementById('movieCategorySelect').value = 'all';
  currentMoviePage = 1;
  renderMoviesFromBuffer();
}

function changeMoviePage(delta) {
  currentMoviePage += delta;
  renderMoviesFromBuffer();
}

function toggleSelectMovie(id, checked) {
  if (checked) {
    selectedMovieIds.add(id);
  } else {
    selectedMovieIds.delete(id);
  }
  updateSelectedUI();
}

function toggleSelectAllMovies(checked) {
  const chks = document.querySelectorAll('.movie-select-chk');
  chks.forEach(chk => {
    chk.checked = checked;
    if (checked) {
      selectedMovieIds.add(chk.value);
    } else {
      selectedMovieIds.delete(chk.value);
    }
  });
  updateSelectedUI();
}

function updateSelectedUI() {
  const count = selectedMovieIds.size;
  const btn = document.getElementById('btnDeleteSelected');
  const countSpan = document.getElementById('selectedMoviesCount');
  if (count > 0) {
    btn.style.display = 'inline-flex';
    countSpan.textContent = count;
  } else {
    btn.style.display = 'none';
    const allChk = document.getElementById('chkSelectAllMovies');
    if (allChk) allChk.checked = false;
  }
}

// Xoá 1 phim (Cập nhật LocalStorage ngay 0ms + Bắt đầu đếm 10 giây đồng bộ)
function deleteSingleMovie(id, title) {
  if (!confirm('Bạn có chắc chắn muốn xoá phim rác này không?\n\n"' + title + '" (ID: ' + id + ')')) {
    return;
  }
  removeMoviesBuffer([id]);
}

// Xoá hàng loạt phim đã chọn
function deleteSelectedMovies() {
  const ids = Array.from(selectedMovieIds);
  if (!ids.length) return;

  if (!confirm('Xoá ' + ids.length + ' bộ phim rác đã chọn vào bộ đệm LocalStorage? (Sẽ đồng bộ lên Database sau 10s)')) {
    return;
  }

  removeMoviesBuffer(ids);
  selectedMovieIds.clear();
  updateSelectedUI();
}

// Hàm cốt lõi gỡ phim khỏi LocalStorage và hiển thị banner đếm ngược 10s
function removeMoviesBuffer(ids) {
  // 1. Biến mất khỏi DOM ngay tức thì (0ms)
  ids.forEach(id => {
    const card = document.getElementById('card-' + id);
    if (card) {
      card.style.transition = 'all 0.2s';
      card.style.transform = 'scale(0.8)';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 200);
    }
    pendingDeleteIds.add(id);
  });

  // 2. Lưu vào LocalStorage
  const deleteSet = new Set(ids);
  bufferMovies = bufferMovies.filter(m => !deleteSet.has(m.id));
  localStorage.setItem(KEY_BUFFER_MOVIES, JSON.stringify(bufferMovies));
  localStorage.setItem(KEY_PENDING_DELETES, JSON.stringify(Array.from(pendingDeleteIds)));

  // 3. Cập nhật số lượng trên giao diện
  document.getElementById('tabMovieCount').textContent = bufferMovies.length.toLocaleString('vi-VN');

  // 4. Kích hoạt đếm ngược 10 giây để đồng bộ lên DB
  scheduleSync();
}

// ==========================================
// CƠ CHẾ ĐỒNG BỘ DEBOUNCE 10 GIÂY LÊN DATABASE
// ==========================================
function scheduleSync() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownSec = 10;
  updateSyncBanner();

  countdownInterval = setInterval(() => {
    countdownSec--;
    updateSyncBanner();

    if (countdownSec <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      flushPendingDeletesNow();
    }
  }, 1000);
}

function updateSyncBanner() {
  const banner = document.getElementById('syncBanner');
  const icon = document.getElementById('syncBannerIcon');
  const text = document.getElementById('syncBannerText');
  const badge = document.getElementById('syncCountdownBadge');

  if (pendingDeleteIds.size === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.className = 'sync-banner';
  icon.textContent = '⏳';
  text.textContent = 'Đã xoá ' + pendingDeleteIds.size + ' phim vào bộ đệm LocalStorage (Tự đồng bộ lên DB sau)';
  badge.textContent = countdownSec + 's';
  badge.style.display = 'inline-block';
}

async function flushPendingDeletesNow() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  const ids = Array.from(pendingDeleteIds);
  if (!ids.length) {
    document.getElementById('syncBanner').classList.add('hidden');
    return;
  }

  const banner = document.getElementById('syncBanner');
  const icon = document.getElementById('syncBannerIcon');
  const text = document.getElementById('syncBannerText');
  const badge = document.getElementById('syncCountdownBadge');

  banner.className = 'sync-banner syncing';
  icon.textContent = '🔄';
  text.textContent = 'Đang đồng bộ ' + ids.length + ' phim rác lên PostgreSQL & Snapshot...';
  badge.textContent = 'Đang gửi...';

  try {
    const res = await fetch('/api/movies/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();

    if (res.ok) {
      pendingDeleteIds.clear();
      localStorage.removeItem(KEY_PENDING_DELETES);

      banner.className = 'sync-banner synced';
      icon.textContent = '✓';
      text.textContent = 'Đã đồng bộ sạch ' + data.count + ' phim rác lên Database thành công!';
      badge.style.display = 'none';

      loadStatus();
      setTimeout(() => {
        banner.classList.add('hidden');
      }, 3000);
    } else {
      banner.className = 'sync-banner';
      icon.textContent = '⚠️';
      text.textContent = 'Lỗi đồng bộ DB: ' + (data.error || 'Thử lại');
      badge.textContent = 'Lỗi';
    }
  } catch (err) {
    banner.className = 'sync-banner';
    icon.textContent = '⚠️';
    text.textContent = 'Mất kết nối mạng khi đồng bộ: ' + err.message;
    badge.textContent = 'Thử lại';
  }
}

// Đảm bảo dữ liệu được gửi khi người dùng đóng trang
window.addEventListener('beforeunload', () => {
  if (pendingDeleteIds.size > 0) {
    const payload = JSON.stringify({ ids: Array.from(pendingDeleteIds) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/movies/delete', payload);
    }
  }
});

// ==========================================
// QUẢN LÝ KÊNH ĐỐI TÁC (TAB 3)
// ==========================================
function toggleAddChannelForm(forceState) {
  const form = document.getElementById('addChannelForm');
  if (forceState !== undefined) {
    form.style.display = forceState ? 'block' : 'none';
  } else {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
}

async function submitAddChannel() {
  const displayName = document.getElementById('newChannelName').value.trim();
  const channelUrl = document.getElementById('newChannelUrl').value.trim();
  const category = document.getElementById('newChannelCategory').value;
  const trustedBrand = document.getElementById('newChannelTrusted').checked;

  if (!displayName || !channelUrl) {
    alert('Vui lòng nhập tên kênh và link YouTube!');
    return;
  }

  try {
    const res = await fetch('/api/channels/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, channelUrl, category, trustedBrand })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Đã thêm kênh "' + displayName + '" thành công!');
      document.getElementById('newChannelName').value = '';
      document.getElementById('newChannelUrl').value = '';
      toggleAddChannelForm(false);
      loadChannels(true);
      loadStatus();
    } else {
      alert('Lỗi thêm kênh: ' + (data.error || 'Không xác định'));
    }
  } catch (err) {
    alert('Lỗi kết nối: ' + err.message);
  }
}

async function deleteChannel(slug, displayName) {
  if (!confirm('Bạn có chắc muốn XOÁ VĨNH VIỄN kênh này khỏi danh bạ cào?\n\n"' + displayName + '" (' + slug + ')')) {
    return;
  }

  const item = document.getElementById('channel-item-' + slug);
  if (item) item.remove();

  try {
    const res = await fetch('/api/channels/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug })
    });
    const data = await res.json();
    if (res.ok) {
      loadChannels(true);
      loadStatus();
    } else {
      alert('Lỗi xoá kênh: ' + (data.error || 'Không xác định'));
      loadChannels(true);
    }
  } catch (err) {
    alert('Lỗi kết nối xoá kênh: ' + err.message);
    loadChannels(true);
  }
}

async function loadChannels(forceRefresh = false) {
  try {
    const res = await fetch('/api/channels' + (forceRefresh ? '?refresh=1' : ''));
    const data = await res.json();
    const fullContainer = document.getElementById('channelFullList');
    const quickContainer = document.getElementById('channelQuickList');
    const countHeader = document.getElementById('channelCountHeader');

    if (!data.channels || !data.channels.length) {
      if (fullContainer) fullContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Chưa có kênh nào.</div>';
      if (quickContainer) quickContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Chưa có kênh nào.</div>';
      return;
    }

    if (countHeader) countHeader.textContent = data.channels.length;
    document.getElementById('tabChannelCount').textContent = data.channels.length;

    const html = data.channels.map(ch => {
      const isEnabled = ch.enabled !== false && ch.blocked !== true;
      const score = Number.isFinite(ch.qualityScore) ? ch.qualityScore : 0;
      const scoreClass = score >= 0 ? 'score-good' : 'score-bad';

      return '<div class="channel-item" id="channel-item-' + ch.slug + '">' +
        '<div class="channel-info">' +
          '<h4>' + escapeHtml(ch.displayName || ch.slug) + '</h4>' +
          '<div class="channel-meta">' +
            '<span class="score-badge ' + scoreClass + '">Điểm: ' + score + '</span>' +
            '<span>Thể loại: ' + escapeHtml(ch.category || 'Hà Nhân') + '</span>' +
            (ch.trustedBrand ? '<span style="color:var(--accent-yellow)">★ Uy Tín</span>' : '') +
            '<a href="' + escapeHtml(ch.channelUrl || '#') + '" target="_blank" rel="noreferrer" style="color:var(--accent-blue); text-decoration:none; margin-left:6px;">🔗 Link YouTube</a>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex; gap:8px;">' +
          '<button class="toggle-btn ' + (isEnabled ? 'enabled' : 'disabled') + '" onclick="toggleChannel(\'' + escapeHtml(ch.slug) + '\', ' + (!isEnabled) + ')">' +
            (isEnabled ? 'Tắt' : 'Bật lại') +
          '</button>' +
          '<button class="btn btn-danger" style="padding:4px 10px; font-size:0.75rem;" onclick="deleteChannel(\'' + escapeHtml(ch.slug) + '\', \'' + escapeHtml(ch.displayName || ch.slug).replace(/'/g, "\\'") + '\')" title="Xoá kênh rác này">' +
            '🗑️ Xoá' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (fullContainer) fullContainer.innerHTML = html;
    if (quickContainer) {
      quickContainer.innerHTML = data.channels.slice(0, 8).map(ch => {
        const isEnabled = ch.enabled !== false && ch.blocked !== true;
        return '<div class="channel-item" style="padding: 8px 12px;">' +
          '<div class="channel-info"><h4 style="font-size:0.85rem;">' + escapeHtml(ch.displayName || ch.slug) + '</h4></div>' +
          '<div><button class="toggle-btn ' + (isEnabled ? 'enabled' : 'disabled') + '" style="padding: 4px 8px; font-size: 0.75rem;" onclick="toggleChannel(\'' + escapeHtml(ch.slug) + '\', ' + (!isEnabled) + ')">' + (isEnabled ? 'Bật' : 'Tắt') + '</button></div>' +
        '</div>';
      }).join('');
    }
  } catch (err) {
    console.error('Lỗi nạp danh bạ kênh:', err);
  }
}

async function toggleChannel(slug, enable) {
  try {
    await fetch('/api/channels/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, enabled: enable })
    });
    loadChannels();
  } catch (err) {
    alert('Lỗi cập nhật kênh: ' + err.message);
  }
}

async function startCrawl() {
  const dryRun = document.getElementById('chkDryRun').checked;
  const syncSnapshot = document.getElementById('chkSyncSnapshot').checked;
  const strictMode = document.getElementById('chkStrictMode').checked;

  try {
    const res = await fetch('/api/crawl/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun, syncSnapshot, strictMode })
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Không thể bắt đầu crawl: ' + (data.error || 'Lỗi không xác định'));
    } else {
      loadStatus();
    }
  } catch (err) {
    alert('Lỗi gửi lệnh crawl: ' + err.message);
  }
}

async function syncSnapshot() {
  if (!confirm('Bạn có muốn đồng bộ lại tệp snapshot movies.json từ dữ liệu mới nhất trong Postgres không?')) return;
  try {
    const res = await fetch('/api/snapshot/sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert('Đồng bộ thành công! Đã ghi ' + data.total + ' phim vào movies.json.');
      loadStatus();
      if (currentTab === 'movies') initMovies(true);
    } else {
      alert('Đồng bộ thất bại: ' + (data.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi đồng bộ snapshot: ' + err.message);
  }
}

// Khởi chạy
initSSE();
loadStatus();
loadChannels();
setInterval(loadStatus, 15000);
