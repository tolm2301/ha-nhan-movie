import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const SNAPSHOT_PATH = path.resolve('src/lib/movies.json');
export const MOVIE_SNAPSHOT_VERSION = 1;

export async function writeMovieSnapshot(movies = [], { source = 'json', generatedAt, fallbackReason = null } = {}) {
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

    if (sameVersion && sameSource && sameFallbackReason && sameMovies) {
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
