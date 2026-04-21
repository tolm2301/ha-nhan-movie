# Hanhan Movie

Next.js movie site with automated YouTube crawling and Vercel Git-based deployment.

## Local development

```bash
npm ci
npm run dev
```

Useful scripts:

- `npm run crawl`: run data crawler only (`scripts/crawl.mjs`)
- `npm run dev:fresh`: crawl first, then run dev server
- `npm run build`: standard Next.js production build
- `npm run build:fresh`: crawl first, then build
- `npm run lint`: run ESLint

## Batch crawl (daily)

Workflow: `.github/workflows/daily-crawl.yml`

- Runs every day at `02:00 UTC`
- Can also be triggered manually via GitHub Actions (`workflow_dispatch`)
- Crawls latest data and commits `src/lib/movies.json` if changed

## Deploy to Vercel (no token flow)

Deployment is handled by Vercel Git Integration (no GitHub Actions token required):

1. Connect this GitHub repository in Vercel.
2. Set production branch to `main` (or `master`, depending on your repo).
3. Every push to production branch is auto-deployed by Vercel.

Because `daily-crawl.yml` commits updated `src/lib/movies.json`, each successful daily crawl will also trigger a fresh Vercel production deploy automatically.

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
