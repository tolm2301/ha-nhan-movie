import { runCrawl, serializeError } from '../src/lib/crawl.server.js';

const dryRun = process.argv.includes('--dry-run');

runCrawl({ dryRun }).catch(error => {
  console.error(`[${new Date().toISOString()}] crawl_run_failed ${JSON.stringify({
    error: serializeError(error),
  })}`);
  process.exitCode = 1;
});
