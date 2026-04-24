# Hanhan Movie

Next.js movie site with automated YouTube crawling and Vercel Git-based deployment.

## Postgres data

Runtime movie data now lives in Postgres (Supabase-compatible). Set `DATABASE_URL` in the server environment for app reads and crawler writes.

## Local development

```bash
npm ci
npm run dev
```

### Local env for DB-backed testing

- Copy or edit `.env.local` for local-only settings.
- Set `DATABASE_URL` (or `SUPABASE_DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_CONNECTION_STRING`) to a local Postgres or Supabase connection string to exercise the DB-backed crawl/runtime path.
- If `DATABASE_URL` is left blank, the app falls back to `src/lib/movies.json` for runtime reads and the crawl can still run in `--dry-run` mode.
- The crawl and migration scripts also load `.env.local`, so the same file can drive `npm run crawl` and `npm run migrate:movies` locally.
- Keep real credentials out of git; `.env.local` is ignored by default.

Useful scripts:

- `npm run crawl`: run data crawler and persist the refreshed dataset to Postgres
- `npm run crawl:dry`: run the crawler without writing to Postgres
- `npm run migrate:movies`: backfill `src/lib/movies.json` into Postgres
- `npm run dev:fresh`: crawl first, then run dev server
- `npm run build`: standard Next.js production build
- `npm run build:fresh`: crawl first, then build
- `npm run lint`: run ESLint

## Batch crawl (daily)

Vercel Cron: `/api/cron/crawl`

- Runs every day at `02:00 UTC`
- Invokes the server-side crawl route and writes refreshed data to Postgres
- Optional manual access can use `CRON_SECRET` with `x-cron-secret` or `?secret=`

GitHub Actions workflow: `.github/workflows/daily-crawl.yml`

- Retained only as a manual fallback
- No longer owns the daily schedule

Required secret/env vars:

- `DATABASE_URL`: Supabase Postgres connection string for server-side reads/writes
- `CRON_SECRET` (optional): manual-access secret for the cron route

## Deploy to Vercel (no token flow)

Deployment is handled by Vercel Git Integration (no GitHub Actions token required):

1. Connect this GitHub repository in Vercel.
2. Set production branch to `main` (or `master`, depending on your repo).
3. Every push to production branch is auto-deployed by Vercel.

Because the crawler now writes to Postgres, deployment refreshes should be driven by the app reading that database instead of repo commits.

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

This keeps crawling in the dedicated daily batch flow, instead of running it on every deployment.
