import { readFile } from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { cleanSnapshotMovies, isMovieSnapshotStale, readMovieSnapshot, MOVIE_SNAPSHOT_TTL_MS, writeMovieSnapshot } from './movieSnapshot.server.js';

const CHANNEL_SEEDS_PATH = path.resolve('src/lib/channel-seeds.json');
const BATCH_SIZE = 100;
const CHANNEL_QUALITY_BLOCK_THRESHOLD = -6;
const CHANNEL_QUALITY_MAX_SCORE = 20;
const CHANNEL_QUALITY_MIN_SCORE = -20;
const CHANNEL_QUALITY_GOOD_BONUS = 2;
const CHANNEL_QUALITY_EMPTY_PENALTY = 1;
const CHANNEL_QUALITY_BAD_PENALTY = 2;
const CHANNEL_QUALITY_ERROR_PENALTY = 3;
const DATABASE_URL_ENV_KEYS = [
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'SUPABASE_DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_CONNECTION_STRING',
];

let pool;
let refreshMovieSnapshotPromise = null;
let lastSnapshotRefreshFailureAt = 0;
const SNAPSHOT_REFRESH_RETRY_BACKOFF_MS = 5 * 60 * 1000;

function getDatabaseConfig() {
  for (const envKey of DATABASE_URL_ENV_KEYS) {
    const connectionString = process.env[envKey];
    if (connectionString) {
      return { envKey, connectionString };
    }
  }

  return null;
}

function isSupabaseHost(hostname = '') {
  const normalizedHost = String(hostname || '').toLowerCase();
  return normalizedHost.includes('supabase');
}

export function describeDatabaseTarget() {
  const databaseConfig = getDatabaseConfig();
  if (!databaseConfig) return null;

  try {
    const url = new URL(databaseConfig.connectionString);
    const sslmode = String(url.searchParams.get('sslmode') || '').toLowerCase() || null;

    return {
      envKey: databaseConfig.envKey,
      host: url.hostname,
      port: url.port || (url.protocol.startsWith('postgres') ? '5432' : ''),
      sslmode,
      isSupabase: isSupabaseHost(url.hostname),
      isPooled: url.searchParams.get('pgbouncer') === 'true' || url.port === '6543',
      isDirect: /non_pooling/i.test(databaseConfig.envKey) || url.port === '5432',
    };
  } catch {
    return {
      envKey: databaseConfig.envKey,
      host: null,
      port: null,
      sslmode: null,
      isSupabase: null,
      isPooled: null,
      isDirect: null,
    };
  }
}

function getDatabaseUrl() {
  return getDatabaseConfig()?.connectionString || '';
}

function getPoolConfig(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslMode = String(url.searchParams.get('sslmode') || '').toLowerCase();
    const requiresTls = ['require', 'verify-ca', 'verify-full', 'prefer'].includes(sslMode) || isSupabaseHost(url.hostname);
    const config = {
      connectionString,
      max: 3,
    };

    if (!requiresTls) {
      return config;
    }

    if (process.env.NODE_ENV === 'production' && !isSupabaseHost(url.hostname)) {
      return config;
    }

    url.searchParams.delete('sslmode');
    url.searchParams.delete('ssl');

    return {
      ...config,
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
    };
  } catch {
    return {
      connectionString,
      max: 3,
    };
  }
}

export function hasDatabaseConfig() {
  return Boolean(getDatabaseUrl());
}

function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;

  if (!pool) {
    pool = new Pool(getPoolConfig(connectionString));
  }

  return pool;
}

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function dedupeMoviesById(movies = []) {
  const seen = new Set();

  return movies.filter(movie => {
    if (!movie?.id || seen.has(movie.id)) {
      return false;
    }

    seen.add(movie.id);
    return true;
  });
}

function toSafeInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeBoolean(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function clampQualityScore(score) {
  return Math.max(CHANNEL_QUALITY_MIN_SCORE, Math.min(CHANNEL_QUALITY_MAX_SCORE, score));
}

function toTimestampOrNull(value) {
  const text = String(value || '').trim();
  return text ? text : null;
}

function extractChannelIdFromChannelUrl(channelUrl = '') {
  const normalizedUrl = String(channelUrl || '').trim();
  if (!normalizedUrl) {
    return null;
  }

  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]+)/i,
    /[?&]channel_id=(UC[\w-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function readSnapshotMovies(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object' && Array.isArray(value.movies)) {
    return value.movies;
  }

  return [];
}

export function normalizeMovieRecord(movie = {}, sortOrder = 0) {
  return {
    id: String(movie.id || '').trim(),
    title: String(movie.title || '').trim(),
    episodes: String(movie.episodes || 'Full').trim(),
    episodeLabel: String(movie.episodeLabel || movie.episodes || 'Full').trim(),
    episodeNumber: toSafeInteger(movie.episodeNumber, null),
    type: String(movie.type || 'full').trim(),
    seriesKey: String(movie.seriesKey || '').trim(),
    views: String(movie.views || '?? views').trim(),
    thumbnail: String(movie.thumbnail || '').trim(),
    tags: String(movie.tags || 'Khác').trim(),
    rating: String(movie.rating || 'N/A').trim(),
    sortOrder: toSafeInteger(movie.sortOrder ?? movie.sort_order, sortOrder) ?? sortOrder,
  };
}

function normalizeChannelRecord(channel = {}, sortOrder = 0) {
  const slug = String(channel.slug || channel.id || '').trim();
  const displayName = String(channel.displayName || channel.display_name || channel.name || slug || '').trim();
  const status = String(channel.status || (channel.enabled === false ? 'disabled' : 'active')).trim() || 'active';
  const allowed = toSafeBoolean(channel.allowed, channel.enabled === false ? false : true);
  const blocked = toSafeBoolean(channel.blocked, false);
  const qualityScore = toSafeInteger(channel.qualityScore ?? channel.quality_score, 0) ?? 0;
  const lastGoodHit = toTimestampOrNull(channel.lastGoodHit || channel.last_good_hit);
  const lastBadHit = toTimestampOrNull(channel.lastBadHit || channel.last_bad_hit);
  const enabled = channel.enabled === undefined ? allowed !== false && blocked !== true && status !== 'disabled' : Boolean(channel.enabled);

  return {
    id: String(channel.id || slug).trim(),
    slug,
    channelId: String(channel.channelId || channel.channel_id || extractChannelIdFromChannelUrl(channel.channelUrl || channel.channel_url || channel.url || '') || '').trim(),
    channelUrl: String(channel.channelUrl || channel.channel_url || channel.url || '').trim(),
    displayName,
    category: String(channel.category || channel.categorySlug || 'shared').trim() || 'shared',
    status: blocked ? 'blocked' : status,
    allowed,
    blocked,
    qualityScore,
    lastGoodHit,
    lastBadHit,
    enabled,
    priority: toSafeInteger(channel.priority ?? channel.sortOrder ?? channel.order, sortOrder) ?? sortOrder,
    lastCrawledAt: channel.lastCrawledAt || channel.last_crawled_at || null,
  };
}

export function buildChannelQualityUpdate(channel = {}, signal = {}) {
  const current = normalizeChannelRecord(channel);
  const at = signal.at ? String(signal.at) : new Date().toISOString();
  const keptCount = Math.max(0, toSafeInteger(signal.keptCount, 0) ?? 0);
  const candidateCount = Math.max(0, toSafeInteger(signal.candidateCount, 0) ?? 0);
  const rejectedCount = Math.max(0, toSafeInteger(signal.rejectedCount, 0) ?? 0);
  const errorCount = Math.max(0, toSafeInteger(signal.errorCount, 0) ?? 0);
  let qualityScore = current.qualityScore || 0;
  let lastGoodHit = current.lastGoodHit;
  let lastBadHit = current.lastBadHit;

  if (keptCount > 0) {
    qualityScore += CHANNEL_QUALITY_GOOD_BONUS + Math.min(keptCount, 3);
    lastGoodHit = at;
  } else if (errorCount > 0 || signal.failed === true) {
    qualityScore -= CHANNEL_QUALITY_ERROR_PENALTY;
    lastBadHit = at;
  } else if (candidateCount === 0) {
    qualityScore -= CHANNEL_QUALITY_EMPTY_PENALTY;
    lastBadHit = at;
  } else if (rejectedCount === 0) {
    qualityScore -= CHANNEL_QUALITY_EMPTY_PENALTY;
    lastBadHit = at;
  } else if (rejectedCount > 0 || signal.bad === true) {
    qualityScore -= CHANNEL_QUALITY_BAD_PENALTY;
    lastBadHit = at;
  }

  qualityScore = clampQualityScore(qualityScore);

  const blocked = Boolean(current.blocked) || Boolean(signal.blocked) || qualityScore <= CHANNEL_QUALITY_BLOCK_THRESHOLD;
  const allowed = signal.allowed === undefined ? current.allowed !== false : Boolean(signal.allowed);
  const status = blocked ? 'blocked' : allowed ? 'active' : 'disabled';
  const enabled = allowed && !blocked && status !== 'disabled';

  return {
    ...current,
    allowed,
    blocked,
    qualityScore,
    lastGoodHit,
    lastBadHit,
    status,
    enabled,
  };
}

export async function readChannelSeedsFromJsonFile() {
  const raw = await readFile(CHANNEL_SEEDS_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((channel, index) => normalizeChannelRecord(channel, index)).filter(channel => channel.slug);
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS crawl_runs (
      id BIGSERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'running',
      kept_count INTEGER NOT NULL DEFAULT 0,
      fetched_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'scripts/crawl.mjs',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      episodes TEXT NOT NULL,
      episode_label TEXT NOT NULL,
      episode_number INTEGER,
      type TEXT NOT NULL,
      series_key TEXT NOT NULL DEFAULT '',
      views TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT 'Khác',
      rating TEXT NOT NULL DEFAULT 'N/A',
      sort_order INTEGER NOT NULL DEFAULT 0,
      crawl_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS movies_sort_order_idx ON movies (sort_order ASC, created_at DESC);`);
  await client.query(`CREATE INDEX IF NOT EXISTS movies_tags_idx ON movies (tags);`);
  await client.query(`CREATE INDEX IF NOT EXISTS movies_series_key_idx ON movies (series_key);`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      channel_id TEXT,
      channel_url TEXT,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'shared',
      status TEXT NOT NULL DEFAULT 'active',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      allowed BOOLEAN NOT NULL DEFAULT TRUE,
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
      quality_score INTEGER NOT NULL DEFAULT 0,
      last_good_hit TIMESTAMPTZ,
      last_bad_hit TIMESTAMPTZ,
      priority INTEGER NOT NULL DEFAULT 0,
      last_crawled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS allowed BOOLEAN NOT NULL DEFAULT TRUE;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_good_hit TIMESTAMPTZ;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_bad_hit TIMESTAMPTZ;`);

  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS channels_channel_id_idx ON channels (channel_id) WHERE channel_id IS NOT NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS channels_enabled_priority_idx ON channels (enabled ASC, priority ASC, created_at DESC);`);
  await client.query(`CREATE INDEX IF NOT EXISTS channels_category_idx ON channels (category);`);
}

async function withClient(work) {
  const connectionPool = getPool();
  if (!connectionPool) {
    throw new Error('Database connection is not configured. Set POSTGRES_URL_NON_POOLING or DATABASE_URL for Postgres access.');
  }

  const client = await connectionPool.connect();
  try {
    await ensureSchema(client);
    return await work(client);
  } finally {
    client.release();
  }
}

export async function readMoviesFromJsonFile() {
  const movies = (await readMovieSnapshot()).movies;
  const cleanedMovies = await cleanSnapshotMovies(movies);

  return cleanedMovies.map((movie, index) => normalizeMovieRecord(movie, index));
}

async function syncChannelRegistryFromJsonFile(client, channels = []) {
  if (channels.length === 0) {
    await client.query(`UPDATE channels SET enabled = FALSE, status = 'disabled', updated_at = NOW();`);
    return { channels: 0, staleDisabled: 0 };
  }

  const params = [];
  const placeholders = channels.map((channel, index) => {
    const base = index * 15;
    params.push(
      channel.id,
      channel.slug,
      channel.channelId || null,
      channel.channelUrl || null,
      channel.displayName || channel.slug,
      channel.category || 'shared',
      channel.status || 'active',
      channel.enabled,
      channel.allowed,
      channel.blocked,
      channel.qualityScore ?? 0,
      channel.lastGoodHit || null,
      channel.lastBadHit || null,
      channel.priority,
      channel.lastCrawledAt || null,
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15})`;
  });

  await client.query(
    `INSERT INTO channels (
      id, slug, channel_id, channel_url, display_name, category, status, enabled, allowed, blocked, quality_score, last_good_hit, last_bad_hit, priority, last_crawled_at
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (slug) DO UPDATE SET
      channel_id = COALESCE(EXCLUDED.channel_id, channels.channel_id),
      channel_url = COALESCE(EXCLUDED.channel_url, channels.channel_url),
      display_name = EXCLUDED.display_name,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      enabled = EXCLUDED.enabled,
      allowed = EXCLUDED.allowed,
      blocked = EXCLUDED.blocked,
      quality_score = EXCLUDED.quality_score,
      last_good_hit = COALESCE(EXCLUDED.last_good_hit, channels.last_good_hit),
      last_bad_hit = COALESCE(EXCLUDED.last_bad_hit, channels.last_bad_hit),
      priority = EXCLUDED.priority,
      last_crawled_at = COALESCE(EXCLUDED.last_crawled_at, channels.last_crawled_at),
      updated_at = NOW();`,
    params,
  );

  const staleDisabledResult = await client.query(
    `UPDATE channels
     SET enabled = FALSE,
         status = 'disabled',
         updated_at = NOW()
     WHERE slug <> ALL($1::text[]);`,
    [channels.map(channel => channel.slug)],
  );

  return { channels: channels.length, staleDisabled: staleDisabledResult.rowCount || 0 };
}

export async function loadChannelRegistry({ allowJsonFallback = true, includeDisabled = false } = {}) {
  const connectionPool = getPool();

  if (!connectionPool) {
    if (allowJsonFallback) {
      return readChannelSeedsFromJsonFile();
    }

    throw new Error('Database connection is not configured. Set POSTGRES_URL_NON_POOLING or DATABASE_URL for Postgres access.');
  }

  return withClient(async client => {
    const seedChannels = await readChannelSeedsFromJsonFile();
    if (seedChannels.length > 0) {
      await syncChannelRegistryFromJsonFile(client, seedChannels);
    }

    if (seedChannels.length === 0) {
      return [];
    }

    const result = await client.query(
      `SELECT
        id,
        slug,
        channel_id AS "channelId",
        channel_url AS "channelUrl",
        display_name AS "displayName",
        category,
        status,
        enabled,
        allowed,
        blocked,
        quality_score AS "qualityScore",
        last_good_hit AS "lastGoodHit",
        last_bad_hit AS "lastBadHit",
        priority,
        last_crawled_at AS "lastCrawledAt"
      FROM channels
      WHERE slug = ANY($1::text[])
      ${includeDisabled ? '' : 'AND enabled = TRUE AND blocked = FALSE'}
      ORDER BY blocked ASC, quality_score DESC, priority ASC, last_good_hit DESC NULLS LAST, created_at ASC, slug ASC;`,
      [seedChannels.map(channel => channel.slug)],
    );

    return result.rows.map((channel, index) => normalizeChannelRecord(channel, index));
  });
}

export async function updateChannelRegistryEntry(slug, updates = {}) {
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    return null;
  }

  return withClient(async client => {
    await client.query(
      `UPDATE channels
       SET channel_id = COALESCE($2, channel_id),
           channel_url = COALESCE($3, channel_url),
           last_crawled_at = COALESCE($4, last_crawled_at),
           allowed = COALESCE($5, allowed),
           blocked = COALESCE($6, blocked),
           quality_score = COALESCE($7, quality_score),
           last_good_hit = COALESCE($8, last_good_hit),
           last_bad_hit = COALESCE($9, last_bad_hit),
           status = COALESCE($10, status),
           enabled = COALESCE($11, enabled),
           updated_at = NOW()
        WHERE slug = $1;`,
      [
        normalizedSlug,
        updates.channelId || null,
        updates.channelUrl || null,
        updates.lastCrawledAt || new Date().toISOString(),
        updates.allowed === undefined ? null : Boolean(updates.allowed),
        updates.blocked === undefined ? null : Boolean(updates.blocked),
        Number.isFinite(updates.qualityScore) ? Math.trunc(updates.qualityScore) : null,
        updates.lastGoodHit || null,
        updates.lastBadHit || null,
        updates.status || null,
        updates.enabled === undefined ? null : Boolean(updates.enabled),
      ],
    );

    const result = await client.query(
      `SELECT
        id,
        slug,
        channel_id AS "channelId",
        channel_url AS "channelUrl",
        display_name AS "displayName",
        category,
        status,
        enabled,
        allowed,
        blocked,
        quality_score AS "qualityScore",
        last_good_hit AS "lastGoodHit",
        last_bad_hit AS "lastBadHit",
        priority,
        last_crawled_at AS "lastCrawledAt"
      FROM channels
      WHERE slug = $1;`,
      [normalizedSlug],
    );

    return result.rows[0] ? normalizeChannelRecord(result.rows[0], 0) : null;
  });
}

export async function loadPersistedMovies({ allowJsonFallback = true } = {}) {
  const connectionPool = getPool();

  if (!connectionPool) {
    if (allowJsonFallback) {
      return readMoviesFromJsonFile();
    }

    throw new Error('Database connection is not configured. Set POSTGRES_URL_NON_POOLING or DATABASE_URL for Postgres access.');
  }

  return withClient(async client => {
    const result = await client.query(`
      SELECT
        id,
        title,
        episodes,
        episode_label AS "episodeLabel",
        episode_number AS "episodeNumber",
        type,
        series_key AS "seriesKey",
        views,
        thumbnail,
        tags,
        rating,
        sort_order AS "sortOrder"
      FROM movies
      ORDER BY sort_order ASC, created_at DESC, id ASC;
    `);

    return result.rows.map((movie, index) => normalizeMovieRecord(movie, index));
  });
}

export async function ensureFreshMovieSnapshot({ maxAgeMs = MOVIE_SNAPSHOT_TTL_MS } = {}) {
  const currentSnapshot = await readMovieSnapshot();
  const stale = isMovieSnapshotStale(currentSnapshot, { maxAgeMs });

  if (!stale) {
    return {
      ...currentSnapshot,
      stale: false,
      refreshed: false,
      refreshAttempted: false,
      refreshFailed: false,
      refreshSkipped: false,
    };
  }

  const now = Date.now();

  if (refreshMovieSnapshotPromise) {
    return refreshMovieSnapshotPromise;
  }

  if (lastSnapshotRefreshFailureAt && now - lastSnapshotRefreshFailureAt < SNAPSHOT_REFRESH_RETRY_BACKOFF_MS) {
    return {
      ...currentSnapshot,
      stale: true,
      refreshed: false,
      refreshAttempted: false,
      refreshFailed: false,
      refreshSkipped: true,
      refreshSkippedReason: 'recent-refresh-failure',
    };
  }

  refreshMovieSnapshotPromise = (async () => {
    try {
      const persistedMovies = await loadPersistedMovies({ allowJsonFallback: false });
      await writeMovieSnapshot(persistedMovies, {
        source: 'db',
        generatedAt: new Date().toISOString(),
        forceRewrite: true,
      });

      const refreshedSnapshot = await readMovieSnapshot();
      lastSnapshotRefreshFailureAt = 0;

      return {
        ...refreshedSnapshot,
        stale: false,
        refreshed: true,
        refreshAttempted: true,
        refreshFailed: false,
        refreshSkipped: false,
      };
    } catch (error) {
      lastSnapshotRefreshFailureAt = Date.now();

      return {
        ...currentSnapshot,
        stale: true,
        refreshed: false,
        refreshAttempted: true,
        refreshFailed: true,
        refreshSkipped: false,
        refreshError: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
      };
    } finally {
      refreshMovieSnapshotPromise = null;
    }
  })();

  return refreshMovieSnapshotPromise;
}

export async function replacePersistedMovies(movies = [], runMeta = {}) {
  return withClient(async client => {
    const normalizedMovies = dedupeMoviesById(movies.map((movie, index) => normalizeMovieRecord(movie, index)).filter(movie => movie.id));
    const startedAt = runMeta.startedAt || new Date().toISOString();
    const finishedAt = runMeta.finishedAt || new Date().toISOString();
    const status = runMeta.status || 'completed';
    const keptCount = Number.isFinite(runMeta.keptCount) ? runMeta.keptCount : normalizedMovies.length;
    const fetchedCount = Number.isFinite(runMeta.fetchedCount) ? runMeta.fetchedCount : normalizedMovies.length;
    const source = runMeta.source || 'scripts/crawl.mjs';
    const syncSnapshot = runMeta.syncSnapshot !== false;
    const metadata = {
      ...((runMeta.metadata && typeof runMeta.metadata === 'object') ? runMeta.metadata : {}),
    };

    if (runMeta.summary) {
      metadata.summary = runMeta.summary;
    }

    await client.query('BEGIN');
    try {
      const runResult = await client.query(
        `INSERT INTO crawl_runs (started_at, finished_at, status, kept_count, fetched_count, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id;`,
        [startedAt, finishedAt, status, keptCount, fetchedCount, source, metadata],
      );

      const crawlRunId = runResult.rows[0]?.id || null;

      for (const batch of chunk(normalizedMovies, BATCH_SIZE)) {
        const params = [];
        const placeholders = batch.map((movie, index) => {
          const base = index * 12;
          params.push(
            movie.id,
            movie.title,
            movie.episodes,
            movie.episodeLabel,
            movie.episodeNumber,
            movie.type,
            movie.seriesKey,
            movie.views,
            movie.thumbnail,
            movie.tags,
            movie.rating,
            movie.sortOrder,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, ${crawlRunId ? `$${batch.length * 12 + 1}` : 'NULL'})`;
        });

        if (crawlRunId) {
          params.push(crawlRunId);
        }

        await client.query(
          `INSERT INTO movies (
            id, title, episodes, episode_label, episode_number, type, series_key, views, thumbnail, tags, rating, sort_order, crawl_run_id
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            episodes = EXCLUDED.episodes,
            episode_label = EXCLUDED.episode_label,
            episode_number = EXCLUDED.episode_number,
            type = EXCLUDED.type,
            series_key = EXCLUDED.series_key,
            views = EXCLUDED.views,
            thumbnail = EXCLUDED.thumbnail,
            tags = EXCLUDED.tags,
            rating = EXCLUDED.rating,
            sort_order = EXCLUDED.sort_order,
            crawl_run_id = COALESCE(EXCLUDED.crawl_run_id, movies.crawl_run_id),
            updated_at = NOW();`,
          params,
        );
      }

      const persistedMoviesResult = await client.query(`
        SELECT
          id,
          title,
          episodes,
          episode_label AS "episodeLabel",
          episode_number AS "episodeNumber",
          type,
          series_key AS "seriesKey",
          views,
          thumbnail,
          tags,
          rating,
          sort_order AS "sortOrder"
        FROM movies
        ORDER BY sort_order ASC, created_at DESC, id ASC;
      `);

      const persistedMovies = persistedMoviesResult.rows.map((movie, index) => normalizeMovieRecord(movie, index));

      await client.query(
        `UPDATE crawl_runs
         SET finished_at = $1, status = $2, kept_count = $3, fetched_count = $4, metadata = $5
         WHERE id = $6;`,
        [finishedAt, status, persistedMovies.length, fetchedCount, metadata, crawlRunId],
      );

      await client.query('COMMIT');
      let snapshotSynced = syncSnapshot;
      let snapshotSkipped = !syncSnapshot;
      let snapshotError = null;

      if (syncSnapshot) {
        try {
          await writeMovieSnapshot(persistedMovies, {
            source: 'db',
            generatedAt: finishedAt,
            cleanMovies: true,
          });
        } catch (error) {
          snapshotSynced = false;
          snapshotSkipped = false;
          snapshotError = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
          console.error(`[${new Date().toISOString()}] snapshot_refresh_failed ${JSON.stringify({
            source: 'db',
            error: snapshotError,
          })}`);
        }
      }

      return { crawlRunId, keptCount: persistedMovies.length, fetchedCount, totalMovies: persistedMovies.length, snapshotSynced, snapshotSkipped, snapshotError };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function seedMoviesFromJson({ dryRun = false } = {}) {
  const movies = await readMoviesFromJsonFile();
  if (dryRun) {
    return { movies, keptCount: movies.length, fetchedCount: movies.length };
  }

  return replacePersistedMovies(movies, {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: 'completed',
    keptCount: movies.length,
    fetchedCount: movies.length,
    source: 'scripts/migrate-movies-to-postgres.mjs',
    metadata: { mode: 'backfill' },
  });
}
