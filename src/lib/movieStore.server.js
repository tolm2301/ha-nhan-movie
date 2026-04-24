import { readFile } from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

const MOVIES_JSON_PATH = path.resolve('src/lib/movies.json');
const BATCH_SIZE = 100;

let pool;

function getDatabaseUrl() {
  return process.env.DATABASE_URL
    || process.env.SUPABASE_DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_CONNECTION_STRING
    || '';
}

function getPoolConfig(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslMode = String(url.searchParams.get('sslmode') || '').toLowerCase();
    const requiresTls = ['require', 'verify-ca', 'verify-full', 'prefer'].includes(sslMode);
    const config = {
      connectionString,
      max: 3,
    };

    if (!requiresTls) {
      return config;
    }

    if (process.env.NODE_ENV === 'production') {
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

function toSafeInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
}

async function withClient(work) {
  const connectionPool = getPool();
  if (!connectionPool) {
    throw new Error('Database connection is not configured. Set DATABASE_URL for Postgres access.');
  }

  const client = await connectionPool.connect();
  try {
    await ensureSchema(client);
    return await work(client);
  } finally {
    client.release();
  }
}

async function readMoviesFromJsonFile() {
  const raw = await readFile(MOVIES_JSON_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed.map((movie, index) => normalizeMovieRecord(movie, index));
}

export async function loadPersistedMovies({ allowJsonFallback = true } = {}) {
  const connectionPool = getPool();

  if (!connectionPool) {
    if (allowJsonFallback) {
      return readMoviesFromJsonFile();
    }

    throw new Error('Database connection is not configured. Set DATABASE_URL for Postgres access.');
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

export async function replacePersistedMovies(movies = [], runMeta = {}) {
  return withClient(async client => {
    const normalizedMovies = movies.map((movie, index) => normalizeMovieRecord(movie, index)).filter(movie => movie.id);
    const startedAt = runMeta.startedAt || new Date().toISOString();
    const finishedAt = runMeta.finishedAt || new Date().toISOString();
    const status = runMeta.status || 'completed';
    const keptCount = Number.isFinite(runMeta.keptCount) ? runMeta.keptCount : normalizedMovies.length;
    const fetchedCount = Number.isFinite(runMeta.fetchedCount) ? runMeta.fetchedCount : normalizedMovies.length;
    const source = runMeta.source || 'scripts/crawl.mjs';
    const metadata = runMeta.metadata || {};

    await client.query('BEGIN');
    try {
      const runResult = await client.query(
        `INSERT INTO crawl_runs (started_at, finished_at, status, kept_count, fetched_count, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id;`,
        [startedAt, finishedAt, status, keptCount, fetchedCount, source, metadata],
      );

      const crawlRunId = runResult.rows[0]?.id || null;

      await client.query('DELETE FROM movies;');

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
          ) VALUES ${placeholders.join(', ')}`,
          params,
        );
      }

      await client.query(
        `UPDATE crawl_runs
         SET finished_at = $1, status = $2, kept_count = $3, fetched_count = $4, metadata = $5
         WHERE id = $6;`,
        [finishedAt, status, keptCount, fetchedCount, metadata, crawlRunId],
      );

      await client.query('COMMIT');
      return { crawlRunId, keptCount, fetchedCount, totalMovies: normalizedMovies.length };
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
