import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const SNAPSHOT_PATH = path.resolve('src/lib/movies.json');
export const MOVIE_SNAPSHOT_VERSION = 1;
export const MOVIE_SNAPSHOT_TTL_MS = 60 * 60 * 1000;

function readSnapshotMovies(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object' && Array.isArray(value.movies)) {
    return value.movies;
  }

  return [];
}

function normalizeSnapshot(value) {
  if (Array.isArray(value)) {
    return {
      snapshotVersion: MOVIE_SNAPSHOT_VERSION,
      source: 'legacy-array',
      generatedAt: null,
      fallbackReason: null,
      movies: value,
    };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    snapshotVersion: Number.isFinite(value.snapshotVersion) ? value.snapshotVersion : MOVIE_SNAPSHOT_VERSION,
    source: String(value.source || 'unknown'),
    generatedAt: value.generatedAt ? String(value.generatedAt) : null,
    fallbackReason: value.fallbackReason ?? null,
    movies: readSnapshotMovies(value),
  };
}

export async function readMovieSnapshot() {
  const raw = await readFile(SNAPSHOT_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const snapshot = normalizeSnapshot(parsed);

  if (!snapshot) {
    throw new Error('Movie snapshot file is empty or malformed.');
  }

  return snapshot;
}

export function isMovieSnapshotStale(snapshot, { maxAgeMs = MOVIE_SNAPSHOT_TTL_MS, now = Date.now() } = {}) {
  if (!snapshot?.generatedAt) {
    return true;
  }

  const generatedAt = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    return true;
  }

  return now - generatedAt >= maxAgeMs;
}

export async function writeMovieSnapshot(movies = [], { source = 'json', generatedAt, fallbackReason = null, forceRewrite = false } = {}) {
  const snapshotMovies = Array.isArray(movies) ? movies : [];
  const snapshot = {
    snapshotVersion: MOVIE_SNAPSHOT_VERSION,
    source,
    generatedAt: generatedAt || new Date().toISOString(),
    fallbackReason,
    movies: snapshotMovies,
  };

  try {
    const currentSnapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
    const sameVersion = currentSnapshot && typeof currentSnapshot === 'object' && currentSnapshot.snapshotVersion === MOVIE_SNAPSHOT_VERSION;
    const sameSource = sameVersion && currentSnapshot.source === source;
    const sameFallbackReason = sameVersion && (currentSnapshot.fallbackReason ?? null) === fallbackReason;
    const sameMovies = sameVersion && Array.isArray(currentSnapshot.movies) && JSON.stringify(currentSnapshot.movies) === JSON.stringify(snapshotMovies);

    if (!forceRewrite && sameVersion && sameSource && sameFallbackReason && sameMovies) {
      return {
        source,
        generatedAt: currentSnapshot.generatedAt || snapshot.generatedAt,
        fallbackReason,
        snapshotVersion: MOVIE_SNAPSHOT_VERSION,
        snapshotPath: 'src/lib/movies.json',
        movies: snapshotMovies.length,
        updated: false,
      };
    }
  } catch {
    // No existing snapshot or unreadable file; rewrite below.
  }

  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  return {
    source,
    generatedAt: snapshot.generatedAt,
    fallbackReason,
    snapshotVersion: MOVIE_SNAPSHOT_VERSION,
    snapshotPath: 'src/lib/movies.json',
    movies: snapshotMovies.length,
    updated: true,
  };
}
