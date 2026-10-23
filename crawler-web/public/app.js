const terminal = document.getElementById('terminal');
let currentTab = 'dashboard';
let currentMoviePage = 1;
const moviePageLimit = 24;
const selectedMovieIds = new Set();
let currentMoviesList = [];

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabName));
  if (activeBtn) activeBtn.classList.add('active');

  const targetTab = document.getElementById('tab-' + tabName);
  if (targetTab) targetTab.classList.add('active');

  if (tabName === 'movies') {
    loadMovies();
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
      console.error('Lỗi phân tích cú pháp SSE:', e);
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
      runBtn.disabled = true;
    } else {
      badge.className = 'badge';
      badge.textContent = 'Sẵn sàng (Idle)';
      runBtn.disabled = false;
    }

    const dbStatus = document.getElementById('statDbStatus');
    const dbHost = document.getElementById('statDbHost');
    if (data.hasDatabase && !data.dbError) {
      dbStatus.textContent = 'Đã Kết Nối';
      dbStatus.style.color = 'var(--accent-green)';
      dbHost.textContent = data.dbTarget?.host || 'Supabase Direct';
    } else {
      dbStatus.textContent = 'Không có kết nối DB';
      dbStatus.style.color = 'var(--accent-red)';
      dbHost.textContent = data.dbError || 'Chạy chế độ tệp JSON';
    }

    const countMovies = data.dbMoviesCount != null ? data.dbMoviesCount : data.snapshotCount;
    document.getElementById('statDbMovies').textContent = (data.dbMoviesCount != null ? data.dbMoviesCount : 0).toLocaleString('vi-VN');
    document.getElementById('statSnapshotMovies').textContent = (data.snapshotCount || 0).toLocaleString('vi-VN');
    document.getElementById('statChannels').textContent = data.channelsCount || 0;
    document.getElementById('tabMovieCount').textContent = countMovies.toLocaleString('vi-VN');
    document.getElementById('tabChannelCount').textContent = data.channelsCount || 0;

    if (data.snapshotMeta?.generatedAt) {
      const dt = new Date(data.snapshotMeta.generatedAt);
      document.getElementById('statSnapshotTime').textContent = 'Lần sinh: ' + dt.toLocaleTimeString('vi-VN') + ' ' + dt.toLocaleDateString('vi-VN');
    }
  } catch (err) {
    console.error('Không thể nạp trạng thái:', err);
  }
}

async function loadMovies() {
  const grid = document.getElementById('movieGrid');
  const search = document.getElementById('movieSearchInput').value.trim();
  const category = document.getElementById('movieCategorySelect').value;

  grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">Đang tải phim...</div>';
  selectedMovieIds.clear();
  updateSelectedUI();

  try {
    const queryParams = new URLSearchParams({
      page: currentMoviePage,
      limit: moviePageLimit,
      search,
      category,
    });

    const res = await fetch('/api/movies?' + queryParams.toString());
    const data = await res.json();

    currentMoviesList = data.movies || [];
    document.getElementById('tabMovieCount').textContent = data.total.toLocaleString('vi-VN');
    document.getElementById('pageInfoText').textContent = 'Trang ' + data.page + ' / ' + data.totalPages + ' (' + data.total.toLocaleString('vi-VN') + ' phim)';

    document.getElementById('btnPrevPage').disabled = data.page <= 1;
    document.getElementById('btnNextPage').disabled = data.page >= data.totalPages;

    if (!currentMoviesList.length) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--text-muted); font-size: 1.1rem;">Không tìm thấy bộ phim nào phù hợp.</div>';
      return;
    }

    grid.innerHTML = currentMoviesList.map(movie => {
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
            '<button class="btn-action btn-delete" onclick="deleteSingleMovie(\'' + movie.id + '\', \'' + escapeHtml(movie.title).replace(/'/g, "\\'") + '\')" title="Xoá phim này khỏi hệ thống">🗑️ Xoá</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--accent-red);">Lỗi tải phim: ' + err.message + '</div>';
  }
}

function searchMovies() {
  currentMoviePage = 1;
  loadMovies();
}

function resetMovieFilter() {
  document.getElementById('movieSearchInput').value = '';
  document.getElementById('movieCategorySelect').value = 'all';
  currentMoviePage = 1;
  loadMovies();
}

function changeMoviePage(delta) {
  currentMoviePage += delta;
  if (currentMoviePage < 1) currentMoviePage = 1;
  loadMovies();
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
  currentMoviesList.forEach(m => {
    if (checked) {
      selectedMovieIds.add(m.id);
    } else {
      selectedMovieIds.delete(m.id);
    }
  });
  document.querySelectorAll('.movie-select-chk').forEach(chk => {
    chk.checked = checked;
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

async function deleteSingleMovie(id, title) {
  if (!confirm('Bạn có chắc chắn muốn xoá phim này không?\n\n"' + title + '" (ID: ' + id + ')')) {
    return;
  }

  try {
    const res = await fetch('/api/movies/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (res.ok) {
      const card = document.getElementById('card-' + id);
      if (card) {
        card.style.opacity = '0.3';
        card.style.pointerEvents = 'none';
      }
      selectedMovieIds.delete(id);
      updateSelectedUI();
      loadStatus();
      setTimeout(loadMovies, 500);
    } else {
      alert('Không thể xoá phim: ' + (data.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi gọi API xoá: ' + err.message);
  }
}

async function deleteSelectedMovies() {
  const ids = Array.from(selectedMovieIds);
  if (!ids.length) return;

  if (!confirm('CẢNH BÁO: Bạn có chắc chắn muốn xoá vĩnh viễn ' + ids.length + ' bộ phim rác đã chọn khỏi Database và Snapshot không?')) {
    return;
  }

  try {
    const res = await fetch('/api/movies/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Đã xoá thành công ' + data.count + ' phim rác!');
      selectedMovieIds.clear();
      updateSelectedUI();
      loadStatus();
      loadMovies();
    } else {
      alert('Lỗi xoá phim: ' + (data.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi kết nối khi xoá: ' + err.message);
  }
}

async function loadChannels() {
  try {
    const res = await fetch('/api/channels');
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

    const html = data.channels.map(ch => {
      const isEnabled = ch.enabled !== false && ch.blocked !== true;
      const score = Number.isFinite(ch.qualityScore) ? ch.qualityScore : 0;
      const scoreClass = score >= 0 ? 'score-good' : 'score-bad';

      return '<div class="channel-item">' +
        '<div class="channel-info">' +
          '<h4>' + escapeHtml(ch.displayName || ch.slug) + '</h4>' +
          '<div class="channel-meta">' +
            '<span class="score-badge ' + scoreClass + '">Điểm: ' + score + '</span>' +
            '<span>Thể loại: ' + escapeHtml(ch.category || 'Hà Nhân') + '</span>' +
            (ch.trustedBrand ? '<span style="color:var(--accent-yellow)">★ Uy Tín</span>' : '') +
          '</div>' +
        '</div>' +
        '<div>' +
          '<button class="toggle-btn ' + (isEnabled ? 'enabled' : 'disabled') + '" onclick="toggleChannel(\'' + escapeHtml(ch.slug) + '\', ' + (!isEnabled) + ')">' +
            (isEnabled ? 'Tắt' : 'Bật lại') +
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
    console.error('Không thể nạp danh bạ kênh:', err);
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
      if (currentTab === 'movies') loadMovies();
    } else {
      alert('Đồng bộ thất bại: ' + (data.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi đồng bộ snapshot: ' + err.message);
  }
}

// Khởi chạy khi nạp trang
initSSE();
loadStatus();
loadChannels();
setInterval(loadStatus, 5000);
