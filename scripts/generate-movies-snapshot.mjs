import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const { hasDatabaseConfig, loadPersistedMovies, readMoviesFromJsonFile } = await import('../src/lib/movieStore.server.js');
const { writeMovieSnapshot } = await import('../src/lib/movieSnapshot.server.js');

async function loadSnapshotMovies() {
  if (!hasDatabaseConfig()) {
    return {
      source: 'snapshot-fallback',
      fallbackReason: 'database-unavailable',
      movies: await readMoviesFromJsonFile(),
    };
  }

  try {
    return {
      source: 'db',
      fallbackReason: null,
      movies: await loadPersistedMovies({ allowJsonFallback: false }),
    };
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] snapshot_generation_db_failed ${JSON.stringify({
      fallback: 'snapshot-fallback',
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    })}`);

    return {
      source: 'snapshot-fallback',
      fallbackReason: error instanceof Error ? error.message : String(error),
      movies: await readMoviesFromJsonFile(),
    };
  }
}

async function main() {
  const { source, fallbackReason, movies } = await loadSnapshotMovies();
  const result = await writeMovieSnapshot(movies, { source, fallbackReason });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
