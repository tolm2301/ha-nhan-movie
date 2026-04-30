# Task Board

## Backlog
- [ ] (template) Task title | Owner: techlead | Priority: medium

## In Progress
- [ ] Fix watch video title mask so fullscreen top edge stays crisp | Owner: developer | Priority: medium
- [ ] Restore local lint/build environment for watch verification | Owner: techlead | Priority: high
- [ ] Implement watch-player double-click seek interaction | Owner: creator | Priority: medium
- [ ] Add keyboard arrow controls to watch player | Owner: creator | Priority: medium
- [ ] Expand Ha Nhân search/tag taxonomy for crawl discovery | Owner: creator | Priority: medium
- [ ] Tighten crawler theme filtering and rejection reasons | Owner: developer | Priority: high
- [ ] Enforce 30-video floor with tiered crawl fallback | Owner: developer | Priority: high
- [ ] Enforce agreed 4-slot AdSense setup: home after rail 3, category after first block, watch after related, search after 8–12 results | Owner: developer | Priority: medium

## Review
- [ ] Fix missing cheerio dependency so /api/cron/crawl can run on Vercel | Owner: developer | Priority: high
- [ ] Fix Vercel cron auth so scheduled crawl runs can execute and refresh the snapshot automatically | Owner: developer | Priority: high
- [ ] Make every crawl category refill until it keeps 10 movies per run, treating duplicates as backfill triggers instead of stopping early | Owner: developer | Priority: high
- [ ] Wire static snapshot regeneration into crawl/cron update flow | Owner: developer | Priority: high
- [ ] Reduce watch page payload and push slower category/watch loads below warning threshold | Owner: developer | Priority: high
- [ ] Test current UI performance and route transitions, prioritizing load speed first | Owner: techlead | Priority: high
- [ ] Wire exact Google AdSense snippet values into the existing integration | Owner: techlead | Priority: medium
- [ ] Move AdSense account verification into Next metadata export | Owner: developer | Priority: medium
- [ ] Reclassify catalog items to the expanded seven-bucket taxonomy | Owner: developer | Priority: high
- [ ] Add `Tu Tiên` as a first-class taxonomy bucket and home rail after `Hà Nhân` | Owner: techlead | Priority: medium
- [ ] Add SEO metadata, robots/sitemap, and structured data for home/category/watch pages | Owner: techlead | Priority: medium
- [ ] Add watch skip backward/forward controls to the watch player | Owner: techlead | Priority: medium
- [ ] Enable normal-mode watch toolbar auto-hide | Owner: techlead | Priority: medium
- [ ] Tighten thumbnail filtering and remove broken/placeholder cards from home/category rails | Owner: developer | Priority: high
- [ ] Tighten Hà Nhân classification to exact brand/source content only | Owner: developer | Priority: high
- [ ] Fix home category rails so each section links to its own category and category pages paginate | Owner: techlead | Priority: medium
- [ ] Keep the home top slot Ha Nhân-first without disturbing the rest of the home ordering | Owner: developer | Priority: medium
- [ ] Move `@keodeovietsub` into shared crawl source anchors | Owner: developer | Priority: medium
- [ ] Rename category bucket to Hệ Thống across crawl/runtime | Owner: developer | Priority: high
- [ ] Fix Vercel Supabase production SSL handling for SSR DB access | Owner: developer | Priority: high
- [ ] Temporary JSON-first runtime fallback for DB certificate failures | Owner: developer | Priority: high
- [ ] Create local env setup for DB-backed crawl/runtime and ignore local env files | Owner: developer | Priority: high
- [ ] Make sitemap URLs resolve to the Vercel production domain reliably | Owner: developer | Priority: medium
- [ ] Move daily crawl trigger from Vercel Cron to GitHub Actions | Owner: developer | Priority: high
- [ ] Migrate crawl data to Postgres and switch runtime reads to DB | Owner: developer | Priority: high
- [ ] Harden crawl retries for transient network/DNS failures | Owner: developer | Priority: high
- [ ] Rebuild crawler logging + Ha Nhân-first small-batch crawl behavior | Owner: developer | Priority: high
- [ ] Implement detailed crawl rejection/failure logging | Owner: developer | Priority: high
- [ ] Apply Ha Nhân taxonomy to crawler discovery order and weighting | Owner: developer | Priority: high

## Done
- [ ] (template) Task title | Owner: techlead | Finished: YYYY-MM-DD
- [x] Move runtime movie reads off the DB critical path by serving a static snapshot with ISR freshness, keeping DB as the update source only | Owner: developer | Finished: 2026-04-30
- [x] Restore current performance changes to baseline, then refactor slow routes toward static generation/ISR or server components where it actually reduces load time | Owner: developer | Finished: 2026-04-29
- [x] Add visible Pin/Unpin control for detached watch popup | Owner: developer | Finished: 2026-04-28
- [x] Restore detached popup window watch UX and keep load quality acceptable | Owner: developer | Finished: 2026-04-28
- [x] Fix player/watch UX, improve search quality, and polish home/category from product-quality review | Owner: developer | Finished: 2026-04-28
- [x] Fix product-quality findings: cron auth spoofing, YouTube API timeout handling, and nested main landmarks | Owner: developer | Finished: 2026-04-28
- [x] Add a dedicated product-quality review agent and wire it into workflow docs | Owner: techlead | Finished: 2026-04-28
- [x] Add Windows topmost helper tool for mini popup window pinning | Owner: creator | Finished: 2026-04-22
- [x] Fix popup sync handshake so main player stays paused until popup closes | Owner: developer | Finished: 2026-04-22
- [x] Switch popup mode to mini web window with reliable return sync | Owner: developer | Finished: 2026-04-22
- [x] Make pinned popup stable by transferring active iframe and restoring in-place playback | Owner: developer | Finished: 2026-04-22
- [x] Stabilize pinned popup playback on production domain and add safe fallback | Owner: developer | Finished: 2026-04-22
- [x] Fix fullscreen element scope, popout Error 153, and popup return time restore | Owner: developer | Finished: 2026-04-22
- [x] Fix watch player flicker/black screen regression after popup-fullscreen changes | Owner: developer | Finished: 2026-04-22
- [x] Re-enable pinned window popup mode and auto-hide controls in fullscreen | Owner: developer | Finished: 2026-04-22
- [x] Add draggable in-page popup player and remember popup position | Owner: developer | Finished: 2026-04-22
- [x] Fix watch popup Error 153 by using route-based popout sync flow | Owner: developer | Finished: 2026-04-22
- [x] Publish standardized team working rules and handoff SOP | Owner: creator | Finished: 2026-04-22
- [x] Fix watch page fullscreen to true window fullscreen and improve popup display controls | Owner: developer | Finished: 2026-04-22
- [x] Fix category bar wrapping and remove Tấu Hài from crawl-derived categories | Owner: designer | Finished: 2026-04-21
- [x] Review UI and crawled data flow optimization | Owner: techlead | Finished: 2026-04-21
 - [ ] Optimize home load, watch readiness, and mobile category overflow | Owner: developer | Priority: high
