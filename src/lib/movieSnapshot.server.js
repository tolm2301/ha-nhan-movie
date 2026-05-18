import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { hasRenderableThumbnail } from './thumbnailFilters.js';
import { explainWatchPageAvailability } from './watchPageAvailability.server.js';

const SNAPSHOT_PATH = path.resolve('src/lib/movies.json');
export const MOVIE_SNAPSHOT_VERSION = 1;
export const MOVIE_SNAPSHOT_TTL_MS = 60 * 60 * 1000;
const SNAPSHOT_KNOWN_BAD_MOVIE_IDS = new Set([
  'BfnTECe22Cs',
  'SyDmi91WnQU',
  'akN6uJTXhM4',
  'NP57l-JnsIc',
  'BhD8C96rdFg',
  '9q0oiU3BZwg',
  'GZrSLvGsNIM',
  'EVpGPAJ2SiI',
]);
const SNAPSHOT_EXPLICIT_UNAVAILABLE_MARKERS = [
  'unavailable',
  'unplayable',
  'private',
  'removed',
  'deleted',
  'blocked',
];

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

function explainRecordedWatchPageAvailability(movie = {}) {
  const playabilityStatus = movie?.playabilityStatus;
  if (!playabilityStatus || typeof playabilityStatus !== 'object') {
    return null;
  }

  return explainWatchPageAvailability({ playabilityStatus });
}

function hasRenderableSnapshotTitle(movie = {}) {
  return Boolean(String(movie.displayTitle || movie.title || '').trim());
}

function getRecordedAvailabilitySignal(movie = {}) {
  const watchPageAvailability = String(movie.watchPageAvailability || movie.availability || '').trim().toLowerCase();

  if (watchPageAvailability && SNAPSHOT_EXPLICIT_UNAVAILABLE_MARKERS.some(marker => watchPageAvailability.includes(marker))) {
    return { keep: false, reason: `watch page unavailable (${watchPageAvailability})` };
  }

  return explainRecordedWatchPageAvailability(movie);
}

function shouldKeepSnapshotMovie(movie = {}) {
  if (!movie?.id) {
    return false;
  }

  if (SNAPSHOT_KNOWN_BAD_MOVIE_IDS.has(String(movie.id))) {
    return false;
  }

  if (movie.watchPageAvailable === false || movie.available === false) {
    return false;
  }

  const recordedAvailability = getRecordedAvailabilitySignal(movie);
  if (recordedAvailability && recordedAvailability.keep === false) {
    return false;
  }

  if (!hasRenderableThumbnail(movie)) {
    return false;
  }

  if (!hasRenderableSnapshotTitle(movie)) {
    return false;
  }

  return true;
}

export async function cleanSnapshotMovies(movies = []) {
  const sourceMovies = Array.isArray(movies) ? movies : [];
  return sourceMovies.filter(shouldKeepSnapshotMovie);
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

export async function writeMovieSnapshot(movies = [], { source = 'json', generatedAt, fallbackReason = null, forceRewrite = false, cleanMovies = true } = {}) {
  const snapshotMovies = cleanMovies ? await cleanSnapshotMovies(movies) : (Array.isArray(movies) ? movies : []);
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
