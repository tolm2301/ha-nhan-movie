# Hanhan Movie

Next.js movie site with automated YouTube crawling and Vercel deployment workflows.

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

## Deploy to Vercel

Workflow: `.github/workflows/deploy-vercel.yml`

- Auto-runs on push to `main`
- Can also be triggered manually (`workflow_dispatch`)
- Runs lint, builds Vercel artifacts, and deploys production

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

You can get these from your Vercel project settings and Vercel CLI (`vercel link` / `.vercel/project.json`).

## Recommended Vercel project setup

- Framework preset: `Next.js`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: default (`.next`)

This keeps crawling in the dedicated daily batch flow, instead of running it on every deployment.
