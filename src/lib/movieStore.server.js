import { readFile } from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { CATEGORY_TAXONOMY, normalizeText as normalizeCategoryText } from './movieCategories.js';
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
const CHANNEL_SUGGESTION_JUNK_KEYWORDS = ['audio', 'clip', 'lyrics', 'ost', 'soundtrack', 'review', 'reaction', 'recap', 'summary', 'shorts', 'trailer', 'teaser', 'vlog', 'podcast', 'news', 'karaoke', 'nhac', 'nhạc'];
const CATEGORY_TAG_TO_SLUG = new Map(CATEGORY_TAXONOMY.map(category => [normalizeCategoryText(category.tag), category.slug]));
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

function normalizeBrandText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isTrustedBrandChannel(channel = {}, slug = '', displayName = '') {
  const category = String(channel.category || channel.categorySlug || '').trim().toLowerCase();
  if (category === 'ha-nhan') {
    return true;
  }

  const brandText = normalizeBrandText([channel.id, slug, displayName, channel.channelId, channel.channelUrl].filter(Boolean).join(' '));
  return brandText.includes('ha nhan') || brandText.includes('hanhan');
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
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function normalizeCandidateKey(value = '') {
  return normalizeBrandText(value).replace(/\s+/g, '-');
}

function isLikelyJunkChannelName(value = '') {
  const normalized = normalizeBrandText(value);
  return CHANNEL_SUGGESTION_JUNK_KEYWORDS.some(keyword => normalized.includes(normalizeBrandText(keyword)));
}

function resolveCategorySlugFromTag(tag = '') {
  const normalizedTag = normalizeCategoryText(tag);
  const directMatch = CATEGORY_TAG_TO_SLUG.get(normalizedTag);
  if (directMatch) {
    return directMatch;
  }

  const slugMatch = CATEGORY_TAXONOMY.find(category => normalizeCategoryText(category.slug) === normalizedTag);
  return slugMatch?.slug || 'shared';
}

function isPromotableChannelCandidate(candidate = {}) {
  return Boolean(
    candidate
    && candidate.status === 'review-ready'
    && candidate.channelId
    && candidate.channelUrl
    && !candidate.alreadyRegistered
    && (candidate.trustedBrandHint || (Number.isFinite(candidate.score) && candidate.score >= 6))
  );
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
  const trustedBrand = toSafeBoolean(channel.trustedBrand ?? channel.trusted_brand, isTrustedBrandChannel(channel, slug, displayName));
  const allowed = toSafeBoolean(channel.allowed, channel.enabled === false ? false : true);
  const blocked = toSafeBoolean(channel.blocked, false);
  const qualityScore = toSafeInteger(channel.qualityScore ?? channel.quality_score, 0) ?? 0;
  const lastGoodHit = toTimestampOrNull(channel.lastGoodHit || channel.last_good_hit);
  const lastBadHit = toTimestampOrNull(channel.lastBadHit || channel.last_bad_hit);
  const normalizedAllowed = trustedBrand ? true : allowed;
  const normalizedBlocked = trustedBrand ? false : blocked;
  const normalizedStatus = trustedBrand ? 'active' : status;
  const enabled = channel.enabled === undefined ? normalizedAllowed !== false && normalizedBlocked !== true && normalizedStatus !== 'disabled' : Boolean(channel.enabled);

  return {
    id: String(channel.id || slug).trim(),
    slug,
    channelId: String(channel.channelId || channel.channel_id || extractChannelIdFromChannelUrl(channel.channelUrl || channel.channel_url || channel.url || '') || '').trim(),
    channelUrl: String(channel.channelUrl || channel.channel_url || channel.url || '').trim(),
    displayName,
    category: String(channel.category || channel.categorySlug || 'shared').trim() || 'shared',
    status: normalizedBlocked ? 'blocked' : normalizedStatus,
    trustedBrand,
    allowed: normalizedAllowed,
    blocked: normalizedBlocked,
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

  const blocked = current.trustedBrand
    ? false
    : Boolean(current.blocked) || Boolean(signal.blocked) || qualityScore <= CHANNEL_QUALITY_BLOCK_THRESHOLD;
  const allowed = current.trustedBrand
    ? true
    : signal.allowed === undefined ? current.allowed !== false : Boolean(signal.allowed);
  const status = blocked ? 'blocked' : allowed ? 'active' : 'disabled';
  const enabled = allowed && !blocked && status !== 'disabled';

  return {
    ...current,
    trustedBrand: current.trustedBrand,
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
      trusted_brand BOOLEAN NOT NULL DEFAULT FALSE,
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
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS trusted_brand BOOLEAN NOT NULL DEFAULT FALSE;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_good_hit TIMESTAMPTZ;`);
  await client.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_bad_hit TIMESTAMPTZ;`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS channel_candidates (
      candidate_key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      candidate_slug TEXT NOT NULL DEFAULT '',
      channel_id TEXT,
      channel_url TEXT,
      source_channel_slug TEXT NOT NULL DEFAULT '',
      source_channel_id TEXT,
      source_channel_display_name TEXT NOT NULL DEFAULT '',
      source_category TEXT NOT NULL DEFAULT 'shared',
      trusted_brand_hint BOOLEAN NOT NULL DEFAULT FALSE,
      already_registered BOOLEAN NOT NULL DEFAULT FALSE,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      keep_count INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'suggested',
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);

  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS candidate_slug TEXT NOT NULL DEFAULT '';`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS channel_id TEXT;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS channel_url TEXT;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS source_channel_slug TEXT NOT NULL DEFAULT '';`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS source_channel_id TEXT;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS source_channel_display_name TEXT NOT NULL DEFAULT '';`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS source_category TEXT NOT NULL DEFAULT 'shared';`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS trusted_brand_hint BOOLEAN NOT NULL DEFAULT FALSE;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS already_registered BOOLEAN NOT NULL DEFAULT FALSE;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS evidence_count INTEGER NOT NULL DEFAULT 1;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS keep_count INTEGER NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'suggested';`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  await client.query(`ALTER TABLE channel_candidates ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);

  await client.query(`CREATE INDEX IF NOT EXISTS channel_candidates_status_score_idx ON channel_candidates (status ASC, score DESC, last_seen_at DESC);`);

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
    const base = index * 16;
    params.push(
      channel.id,
      channel.slug,
      channel.channelId || null,
      channel.channelUrl || null,
      channel.displayName || channel.slug,
      channel.category || 'shared',
      channel.status || 'active',
      channel.enabled,
      channel.trustedBrand,
      channel.allowed,
      channel.blocked,
      channel.qualityScore ?? 0,
      channel.lastGoodHit || null,
      channel.lastBadHit || null,
      channel.priority,
      channel.lastCrawledAt || null,
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16})`;
  });

  await client.query(
    `INSERT INTO channels (
      id, slug, channel_id, channel_url, display_name, category, status, enabled, trusted_brand, allowed, blocked, quality_score, last_good_hit, last_bad_hit, priority, last_crawled_at
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (slug) DO UPDATE SET
      channel_id = COALESCE(EXCLUDED.channel_id, channels.channel_id),
      channel_url = COALESCE(EXCLUDED.channel_url, channels.channel_url),
      display_name = EXCLUDED.display_name,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      enabled = EXCLUDED.enabled,
      trusted_brand = EXCLUDED.trusted_brand,
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
     WHERE slug <> ALL($1::text[])
       AND trusted_brand = FALSE
       AND COALESCE(quality_score, 0) < 6
       AND last_good_hit IS NULL;`,
    [channels.map(channel => channel.slug)],
  );

  return { channels: channels.length, staleDisabled: staleDisabledResult.rowCount || 0 };
}

async function promoteChannelCandidatesIntoRegistry(client, candidateRows = []) {
  const promotable = candidateRows.filter(isPromotableChannelCandidate);
  if (promotable.length === 0) {
    return { promoted: 0 };
  }

  const params = [];
  const placeholders = promotable.map((candidate, index) => {
    const base = index * 16;
    params.push(
      candidate.candidateKey,
      candidate.candidateSlug,
      candidate.channelId,
      candidate.channelUrl,
      candidate.displayName,
      resolveCategorySlugFromTag(candidate.sourceCategory),
      'active',
      true,
      candidate.trustedBrandHint,
      true,
      false,
      Math.max(0, Number.isFinite(candidate.score) ? candidate.score : 0),
      candidate.lastSeenAt || null,
      null,
      0,
      candidate.lastSeenAt || null,
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16})`;
  });

  await client.query(
    `INSERT INTO channels (
      id, slug, channel_id, channel_url, display_name, category, status, enabled, trusted_brand, allowed, blocked, quality_score, last_good_hit, last_bad_hit, priority, last_crawled_at
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (slug) DO UPDATE SET
      channel_id = COALESCE(EXCLUDED.channel_id, channels.channel_id),
      channel_url = COALESCE(EXCLUDED.channel_url, channels.channel_url),
      display_name = EXCLUDED.display_name,
      category = EXCLUDED.category,
      status = 'active',
      enabled = TRUE,
      trusted_brand = channels.trusted_brand OR EXCLUDED.trusted_brand,
      allowed = TRUE,
      blocked = FALSE,
      quality_score = GREATEST(channels.quality_score, EXCLUDED.quality_score),
      last_good_hit = COALESCE(channels.last_good_hit, EXCLUDED.last_good_hit),
      last_bad_hit = COALESCE(channels.last_bad_hit, EXCLUDED.last_bad_hit),
      priority = LEAST(channels.priority, EXCLUDED.priority),
      last_crawled_at = COALESCE(EXCLUDED.last_crawled_at, channels.last_crawled_at),
      updated_at = NOW();`,
    params,
  );

  return { promoted: promotable.length };
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

    const promotableCandidatesResult = await client.query(
      `SELECT
        candidate_key AS "candidateKey",
        display_name AS "displayName",
        normalized_name AS "normalizedName",
        candidate_slug AS "candidateSlug",
        channel_id AS "channelId",
        channel_url AS "channelUrl",
        source_channel_slug AS "sourceChannelSlug",
        source_channel_id AS "sourceChannelId",
        source_channel_display_name AS "sourceChannelDisplayName",
        source_category AS "sourceCategory",
        trusted_brand_hint AS "trustedBrandHint",
        already_registered AS "alreadyRegistered",
        evidence_count AS "evidenceCount",
        keep_count AS "keepCount",
        score,
        status,
        first_seen_at AS "firstSeenAt",
        last_seen_at AS "lastSeenAt",
        metadata
      FROM channel_candidates
      WHERE status = 'review-ready'
      ORDER BY score DESC, last_seen_at DESC
      LIMIT 50;`,
    );

    await promoteChannelCandidatesIntoRegistry(client, promotableCandidatesResult.rows);

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
        trusted_brand AS "trustedBrand",
        allowed,
        blocked,
        quality_score AS "qualityScore",
        last_good_hit AS "lastGoodHit",
        last_bad_hit AS "lastBadHit",
        priority,
        last_crawled_at AS "lastCrawledAt"
      FROM channels
      WHERE (slug = ANY($1::text[])
        OR (trusted_brand = TRUE OR COALESCE(quality_score, 0) >= 6 OR last_good_hit IS NOT NULL))
      ${includeDisabled ? '' : 'AND enabled = TRUE AND blocked = FALSE'}
      ORDER BY trusted_brand DESC, blocked ASC, quality_score DESC, priority ASC, last_good_hit DESC NULLS LAST, created_at ASC, slug ASC;`,
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
           trusted_brand = COALESCE($5, trusted_brand),
           allowed = COALESCE($6, allowed),
           blocked = COALESCE($7, blocked),
           quality_score = COALESCE($8, quality_score),
           last_good_hit = COALESCE($9, last_good_hit),
           last_bad_hit = COALESCE($10, last_bad_hit),
           status = COALESCE($11, status),
           enabled = COALESCE($12, enabled),
           updated_at = NOW()
        WHERE slug = $1;`,
      [
        normalizedSlug,
        updates.channelId || null,
        updates.channelUrl || null,
        updates.lastCrawledAt || new Date().toISOString(),
        updates.trustedBrand === undefined ? null : Boolean(updates.trustedBrand),
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
        trusted_brand AS "trustedBrand",
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

function buildCandidateScore({ trustedBrandHint = false, keepCount = 0, evidenceCount = 1, alreadyRegistered = false } = {}) {
  let score = 0;

  score += trustedBrandHint ? 4 : 0;
  score += Math.min(Math.max(keepCount, 0), 5);
  score += Math.min(Math.max(evidenceCount, 0), 10) > 1 ? 1 : 0;
  score += alreadyRegistered ? -2 : 0;

  return score;
}

async function candidateRegistryMatch(client, candidate = {}) {
  const candidateSlug = String(candidate.candidateSlug || '').trim();
  const candidateName = String(candidate.displayName || '').trim();
  const candidateId = String(candidate.channelId || '').trim();
  const candidateUrl = String(candidate.channelUrl || '').trim();

  const result = await client.query(
    `SELECT slug
     FROM channels
     WHERE ($1 <> '' AND slug = $1)
        OR ($2 <> '' AND LOWER(display_name) = LOWER($2))
        OR ($3 <> '' AND channel_id = $3)
        OR ($4 <> '' AND channel_url = $4)
     LIMIT 1;`,
    [candidateSlug, candidateName, candidateId, candidateUrl],
  );

  return result.rows[0]?.slug || null;
}

export async function recordChannelSuggestion(candidate = {}, signal = {}) {
  const displayName = String(candidate.displayName || '').trim();
  if (!displayName) {
    return null;
  }

  if (isLikelyJunkChannelName(displayName)) {
    return null;
  }

  const normalizedName = normalizeBrandText(displayName);
  const candidateSlug = normalizeCandidateKey(candidate.candidateSlug || candidate.slug || displayName);
  const candidateKey = candidateSlug || normalizedName;
  if (!candidateKey) {
    return null;
  }

  return withClient(async client => {
    const alreadyRegisteredSlug = await candidateRegistryMatch(client, {
      candidateSlug,
      displayName,
      channelId: candidate.channelId,
      channelUrl: candidate.channelUrl,
    });

    const existingResult = await client.query(
      `SELECT candidate_key, evidence_count, keep_count, score, trusted_brand_hint, already_registered, source_channel_slug, source_category, metadata
       FROM channel_candidates
       WHERE candidate_key = $1
       LIMIT 1;`,
      [candidateKey],
    );

    const existing = existingResult.rows[0] || null;
    const evidenceCount = Math.max(1, (existing?.evidence_count || 0) + 1);
    const keepCount = Math.max(0, (existing?.keep_count || 0) + (signal.kept ? 1 : 0));
    const trustedBrandHint = Boolean(signal.trustedBrandHint ?? candidate.trustedBrandHint ?? false);
    const alreadyRegistered = Boolean(alreadyRegisteredSlug || existing?.already_registered);
    const score = buildCandidateScore({ trustedBrandHint, keepCount, evidenceCount, alreadyRegistered });
    const status = alreadyRegistered
      ? 'registered'
      : score >= 6 && evidenceCount >= 2
        ? 'review-ready'
        : 'suggested';
    const now = new Date().toISOString();
    const metadata = {
      ...(existing?.metadata || {}),
      ...(candidate.metadata || {}),
      ...(signal.metadata || {}),
    };

    const result = await client.query(
      `INSERT INTO channel_candidates (
        candidate_key,
        display_name,
        normalized_name,
        candidate_slug,
        channel_id,
        channel_url,
        source_channel_slug,
        source_channel_id,
        source_channel_display_name,
        source_category,
        trusted_brand_hint,
        already_registered,
        evidence_count,
        keep_count,
        score,
        status,
        first_seen_at,
        last_seen_at,
        metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE($17::timestamptz, NOW()), NOW(), $18::jsonb
      )
      ON CONFLICT (candidate_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        normalized_name = EXCLUDED.normalized_name,
        candidate_slug = EXCLUDED.candidate_slug,
        channel_id = COALESCE(EXCLUDED.channel_id, channel_candidates.channel_id),
        channel_url = COALESCE(EXCLUDED.channel_url, channel_candidates.channel_url),
        source_channel_slug = COALESCE(EXCLUDED.source_channel_slug, channel_candidates.source_channel_slug),
        source_channel_id = COALESCE(EXCLUDED.source_channel_id, channel_candidates.source_channel_id),
        source_channel_display_name = COALESCE(EXCLUDED.source_channel_display_name, channel_candidates.source_channel_display_name),
        source_category = COALESCE(EXCLUDED.source_category, channel_candidates.source_category),
        trusted_brand_hint = EXCLUDED.trusted_brand_hint OR channel_candidates.trusted_brand_hint,
        already_registered = EXCLUDED.already_registered OR channel_candidates.already_registered,
        evidence_count = EXCLUDED.evidence_count,
        keep_count = EXCLUDED.keep_count,
        score = EXCLUDED.score,
        status = EXCLUDED.status,
        last_seen_at = NOW(),
        metadata = EXCLUDED.metadata
      RETURNING
        candidate_key AS "candidateKey",
        display_name AS "displayName",
        normalized_name AS "normalizedName",
        candidate_slug AS "candidateSlug",
        channel_id AS "channelId",
        channel_url AS "channelUrl",
        source_channel_slug AS "sourceChannelSlug",
        source_channel_id AS "sourceChannelId",
        source_channel_display_name AS "sourceChannelDisplayName",
        source_category AS "sourceCategory",
        trusted_brand_hint AS "trustedBrandHint",
        already_registered AS "alreadyRegistered",
        evidence_count AS "evidenceCount",
        keep_count AS "keepCount",
        score,
        status,
        first_seen_at AS "firstSeenAt",
        last_seen_at AS "lastSeenAt",
        metadata;`,
      [
        candidateKey,
        displayName,
        normalizedName,
        candidateSlug,
        candidate.channelId || null,
        candidate.channelUrl || null,
        candidate.sourceChannelSlug || '',
        candidate.sourceChannelId || null,
        candidate.sourceChannelDisplayName || '',
        candidate.sourceCategory || 'shared',
        trustedBrandHint,
        alreadyRegistered,
        evidenceCount,
        keepCount,
        score,
        status,
        candidate.firstSeenAt || now,
        JSON.stringify(metadata),
      ],
    );

    return result.rows[0] ? {
      ...result.rows[0],
      registered: alreadyRegistered,
    } : null;
  });
}

export async function loadChannelSuggestions({ limit = 50, status = null } = {}) {
  return withClient(async client => {
    const params = [Math.max(1, Math.min(200, limit))];
    const statusClause = status ? 'WHERE status = $2' : '';
    if (status) {
      params.push(String(status));
    }

    const result = await client.query(
      `SELECT
        candidate_key AS "candidateKey",
        display_name AS "displayName",
        normalized_name AS "normalizedName",
        candidate_slug AS "candidateSlug",
        channel_id AS "channelId",
        channel_url AS "channelUrl",
        source_channel_slug AS "sourceChannelSlug",
        source_channel_id AS "sourceChannelId",
        source_channel_display_name AS "sourceChannelDisplayName",
        source_category AS "sourceCategory",
        trusted_brand_hint AS "trustedBrandHint",
        already_registered AS "alreadyRegistered",
        evidence_count AS "evidenceCount",
        keep_count AS "keepCount",
        score,
        status,
        first_seen_at AS "firstSeenAt",
        last_seen_at AS "lastSeenAt",
        metadata
      FROM channel_candidates
      ${statusClause}
      ORDER BY status ASC, score DESC, last_seen_at DESC
      LIMIT $1;`,
      params,
    );

    return result.rows;
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
