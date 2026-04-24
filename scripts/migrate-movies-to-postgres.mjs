import { hasDatabaseConfig, seedMoviesFromJson } from '../src/lib/movieStore.server.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const movies = await seedMoviesFromJson({ dryRun: true });

  if (dryRun || !hasDatabaseConfig()) {
    console.log(JSON.stringify({
      mode: dryRun ? 'dry-run' : 'local-fallback',
      source: 'src/lib/movies.json',
      movies: movies.movies.length,
    }, null, 2));
    return;
  }

  const result = await seedMoviesFromJson();
  console.log(JSON.stringify({
    mode: 'migrated',
    crawlRunId: result.crawlRunId,
    totalMovies: result.totalMovies,
    keptCount: result.keptCount,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
