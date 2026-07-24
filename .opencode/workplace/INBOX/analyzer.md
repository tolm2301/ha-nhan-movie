# Analyzer Inbox — hanhan-movie

## Current Assignments

### CRAWL-001 — Feasibility of Admin Crawl Trigger and UI Auto-Refresh
- Status: todo
- Objective: Evaluate feasibility, find optimal implementation paths, and identify risks for adding a hidden admin page with a manual crawl button, and auto-refreshing the frontend UI from the DB snapshot every ~30 minutes.
- Questions to Answer: 
  - How is crawl currently triggered (Vercel Cron/GitHub Actions/API)?
  - How can we expose a manual crawl trigger via a hidden admin route?
  - How does the UI currently load the snapshot (JSON vs DB, polling vs ISR/SSR)?
  - What is the best Next.js pattern (e.g. `revalidate`, `useSWR`, `router.refresh()`) to achieve a 30-minute auto-refresh?
- Files / Areas to Inspect: `src/app/api/cron/crawl/route.js`, `src/lib/crawl.server.js`, `src/app/page.js` (or layout), caching strategies.
- Scope IN: Backend crawl trigger endpoints, Next.js page data-fetching mechanisms, caching behavior.
- Scope OUT: Implementing the solution, styling the admin page, modifying actual crawl logic/filters.
- Required Evidence: File paths, code snippets of current fetching/crawl logic, Next.js doc references if needed.
- Due / Priority: High

## Assignment Template
```md
### <Task ID> — <Title>
- Status:
- Objective:
- Questions to Answer:
- Files / Areas to Inspect:
- Scope IN:
- Scope OUT:
- Required Evidence:
- Due / Priority:
```
### CRAWL-005 — Investigate 1-Movie Crawl Limit
- Status: todo
- Objective: The user reported that the current crawl flow is only fetching/saving 1 movie at a time. Investigate the codebase to identify the root cause of this limitation and find how to optimize the crawl flow to fetch more movies.
- Questions to Answer:
  - Where are the limits defined for crawl fetching (e.g. per category, per run, total)?
  - Is there a bug causing the crawler to stop after 1 movie, or is it a hardcoded limit?
  - How can we safely increase this limit without hitting timeouts or memory issues?
- Files / Areas to Inspect: `src/lib/crawl.server.js`, `src/app/api/cron/crawl/route.js`, `scripts/crawl.mjs`
- Scope IN: Backend crawl logic, limits, quotas, and filtering.
- Scope OUT: Writing the fix code.
- Required Evidence: Code snippets showing the limits and variables.
- Due / Priority: High
