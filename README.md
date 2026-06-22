# Hanhan Movie

Next.js movie site with automated YouTube crawling, build-time snapshot generation, and Vercel Git-based deployment.

## Snapshot lifecycle

- Runtime reads `src/lib/movies.json`.
- Build/deploy runs `prebuild` first, so `npm run build` always refreshes the snapshot via `npm run snapshot:movies` before Next.js builds.

## Postgres data

Runtime movie data now lives in Postgres (Supabase-compatible). Set the direct Supabase URL in `POSTGRES_URL_NON_POOLING` on Vercel (preferred) or `DATABASE_URL` if that is your server-only direct URL.

The crawl registry also lives in Postgres as a `channels` table. When that table is empty, the app bootstraps it from `src/lib/channel-seeds.json` so crawl discovery has a repo-backed recovery path.

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

## Deploy via GitLab CI/CD to Vercel

1. Configure the following required CI/CD variables in your GitLab project settings:
   - `VERCEL_TOKEN`: Your Vercel personal access token
   - `VERCEL_ORG_ID`: Your Vercel organization ID
   - `VERCEL_PROJECT_ID`: Your Vercel project ID
   - `POSTGRES_URL_NON_POOLING`: Your database connection URL
   - `GITLAB_ACCESS_TOKEN`: A project or personal access token with repository write access (needed for hourly snapshots)

2. Create scheduled pipelines in GitLab:
   - For `daily_crawl`: Create a schedule, add variable `SCHEDULE_TARGET = crawl`
   - For `hourly_snapshot`: Create a schedule, add variable `SCHEDULE_TARGET = snapshot`

3. The pipeline runs automatically on pushes to the `main` branch.

Because build/deploy regenerates the runtime snapshot first, Vercel deployments stay snapshot-driven without tying freshness to crawl runs.

## Recommended Vercel project setup

- Framework preset: `Next.js`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: default (`.next`)

This keeps crawling in the dedicated daily batch flow and snapshot refresh in the separate hourly sync, instead of tying either one to Vercel deployment hooks.
