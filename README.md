# Hanhan Movie

Next.js movie site with automated YouTube crawling, build-time snapshot generation, and Vercel Git-based deployment.

## Snapshot lifecycle

- Runtime reads `src/lib/movies.json`.
- Build/deploy runs `prebuild` first, so `npm run build` always refreshes the snapshot via `npm run snapshot:movies` before Next.js builds.
- Hourly sync is handled by `.github/workflows/hourly-snapshot-sync.yml`, which refreshes the snapshot from Postgres and commits the updated JSON back to the repo.
- Crawl is separate: `.github/workflows/daily-crawl.yml` updates the database only (`npm run crawl -- --no-snapshot`) and is no longer the freshness owner for the runtime snapshot.

## Postgres data

Runtime movie data now lives in Postgres (Supabase-compatible). Set the direct Supabase URL in `POSTGRES_URL_NON_POOLING` on Vercel (preferred) or `DATABASE_URL` if that is your server-only direct URL.

The crawl registry also lives in Postgres as a `channels` table. When that table is empty, the app bootstraps it from `src/lib/channel-seeds.json` so crawl discovery has a repo-backed recovery path.

## AdSense

The shared AdSense framework stays intact, but only four placements are active now: home after the third rail, category after the first block, watch after the related block, and search after 8–12 results. To enable them, set:

- `NEXT_PUBLIC_ADSENSE_SLOT_HOME_AFTER_RAILS`
- `NEXT_PUBLIC_ADSENSE_SLOT_CATEGORY_AFTER_FIRST_BLOCK`
- `NEXT_PUBLIC_ADSENSE_SLOT_WATCH_AFTER_RELATED`
- `NEXT_PUBLIC_ADSENSE_SLOT_SEARCH_AFTER_RESULTS`

Missing slot env vars keep those placements inert.

## Local development

```bash
npm ci
npm run dev
```

### Local env for DB-backed testing

- Copy or edit `.env.local` for local-only settings.
- Set `POSTGRES_URL_NON_POOLING` (preferred on Vercel) or `DATABASE_URL` to a direct Postgres or Supabase connection string to exercise the DB-backed crawl/runtime path.
- Use the direct/non-pooled Supabase URL for SSR on Vercel; pooled URLs are kept as a legacy fallback and are not the primary runtime path.
- If the DB connection fails, the app logs the failure and falls back to `src/lib/movies.json` for runtime reads; the crawl can still run in `--dry-run` mode.
- The crawl and migration scripts also load `.env.local`, so the same file can drive `npm run crawl` and `npm run migrate:movies` locally.
- Keep real credentials out of git; `.env.local` is ignored by default.

Useful scripts:

- `npm run crawl`: run data crawler and upsert the refreshed dataset into Postgres so older movie rows stay retained
- `npm run crawl:dry`: run the crawler without writing to Postgres
- `npm run migrate:movies`: backfill `src/lib/movies.json` into Postgres
- `npm run dev:fresh`: crawl first, then run dev server
- `npm run build`: standard Next.js production build; `prebuild` refreshes `src/lib/movies.json` first
- `npm run build:fresh`: crawl first, then build
- `npm run lint`: run ESLint

## Daily crawl (DB ingestion)

GitHub Actions workflow: `.github/workflows/daily-crawl.yml`

- Runs every day at `02:00 UTC`
- Runs the crawler directly in GitHub Actions and upserts refreshed data into Postgres so repeated runs grow the catalog without duplicating movie ids
- Operational goal: deliver at least `5` new movies per category per day.
- Crawl strategy is category-first and quota-driven: daily crawl/backfill is aimed at filling each category floor, not at collecting generic sources.
- Does not update the runtime snapshot; snapshot freshness is owned by build/deploy and the hourly sync workflow
- Crawls are split by category (`Hà Nhân`, `Tu Tiên`, `Xuyên Không`, `Trọng Sinh`, `Liễu Như Yên`, `Hệ Thống`, `Khác`) and use the DB-backed channel registry as the discovery source. Channel metadata is bootstrapped from `src/lib/channel-seeds.json` when the registry is empty, and crawl reads channel feeds/uploads instead of relying on yt-search for discovery.
- Logs include the category batch name, run day, and how many items were added/skipped

## Hourly snapshot sync

GitHub Actions workflow: `.github/workflows/hourly-snapshot-sync.yml`

- Runs every hour
- Runs `npm run snapshot:movies` only
- Requires Postgres credentials from GitHub Secrets and pushes `src/lib/movies.json` only when the snapshot content actually changes
- Uploads the snapshot log as an artifact for debugging

Required secret/env vars:

- `POSTGRES_URL_NON_POOLING` (preferred) or `DATABASE_URL`: direct Supabase Postgres connection string for the GitHub Actions crawl job
- `CRON_SECRET` (optional): manual-access secret for `/api/cron/crawl` if you still use the endpoint by hand
- `POSTGRES_URL_NON_POOLING` (preferred) or `DATABASE_URL`: direct Supabase Postgres connection string for the hourly snapshot sync job

## Deploy to Vercel (no token flow)

Deployment is handled by Vercel Git Integration (no GitHub Actions token required):

1. Connect this GitHub repository in Vercel.
2. Set production branch to `main` (or `master`, depending on your repo).
3. Every push to production branch is auto-deployed by Vercel.

Because build/deploy regenerates the runtime snapshot first, and the hourly sync keeps `src/lib/movies.json` updated, Vercel deployments stay snapshot-driven without tying freshness to crawl runs.

No `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` secrets are required for this setup.

## CI checks

Workflow: `.github/workflows/ci.yml`

- Runs lint on push and pull requests
- Keeps code quality checks in GitHub Actions while deploy stays on Vercel

## Recommended Vercel project setup

- Framework preset: `Next.js`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: default (`.next`)

This keeps crawling in the dedicated daily batch flow and snapshot refresh in the separate hourly sync, instead of tying either one to Vercel deployment hooks.
