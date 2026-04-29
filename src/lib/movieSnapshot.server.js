import { writeFile } from 'fs/promises';
import path from 'path';

const SNAPSHOT_PATH = path.resolve('src/lib/movies.json');

export async function writeMovieSnapshot(movies = [], { source } = {}) {
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(movies, null, 2)}\n`, 'utf8');

  return {
    source: source || 'json',
    snapshotPath: 'src/lib/movies.json',
    movies: movies.length,
  };
}
