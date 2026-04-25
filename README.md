# Hanhan Movie

Next.js movie site with automated YouTube crawling and Vercel Git-based deployment.

## Postgres data

Runtime movie data now lives in Postgres (Supabase-compatible). Set the direct Supabase URL in `POSTGRES_URL_NON_POOLING` on Vercel (preferred) or `DATABASE_URL` if that is your server-only direct URL.

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
- Crawls are split by category (`Hà Nhân`, `Tu Tiên`, `Xuyên Không`, `Trọng Sinh`, `Liễu Như Yên`, `Hệ Thống`, `Khác`) and keep roughly 5 new movies per category per day; each bucket now uses a tiered keyword stack (`core`, `expanded`, `fallback-only`, `risky caps`) so broad discovery terms stay capped, the `Hà Nhân` bucket remains first-priority, runtime classification still prefers explicit brand/theme matches before any broader fallback, and the broadest discovery terms stay crawl-only
- Logs include the category batch name, run day, and how many items were added/skipped
- Optional manual access can use `CRON_SECRET` with `x-cron-secret` or `?secret=`

GitHub Actions workflow: `.github/workflows/daily-crawl.yml`

- Retained only as a manual fallback
- No longer owns the daily schedule

Required secret/env vars:

- `POSTGRES_URL_NON_POOLING` (preferred on Vercel) or `DATABASE_URL`: direct Supabase Postgres connection string for server-side reads/writes
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
