# INBOX: Developer

Use this queue for implementation and bugfix tasks.

## Next.js workflow reminder
- This repo uses **Next.js App Router**. Prefer small client components, keep server/client boundaries explicit, and avoid changing unrelated app logic while fixing environment issues.
- If `next` / `eslint` are not recognized, restore dependencies first (`npm.cmd install`) before touching source files.
- Verification baseline for implementation work: `npm.cmd run lint` and `npm.cmd run build`.
- For watch-page changes, keep fixes narrow: CSS-only mask tweaks should not alter playback, routing, or fullscreen logic.

## Entries
- (template) YYYY-MM-DD | From: techlead/designer | Scope: ... | Verify: ...
- 2026-04-25 | From: techlead | Scope: Migrate crawl data from `src/lib/movies.json` into Postgres/Supabase, switch the crawler to write to the DB, and make runtime reads come from the DB. Verify: existing JSON backfill path exists, crawl writes target Postgres, app reads are DB-backed, and lint/build plus a crawl/migration test are explicit.
- 2026-04-24 | From: techlead | Scope: Apply the approved Ha Nhân taxonomy to crawler discovery order and weighting. Verify: exact Ha Nhân anchors come first, character/theme combinations come next, and broad terms like `phim`, `tu tiên`, `xuyên không`, `trọng sinh` stay low-weight fallback only.
- 2026-04-24 | From: techlead | Scope: Investigate crawl failure reasons with detailed logging and keep the crawler Ha Nhân-first/small-drip. Priority: show why items are rejected, verify Ha Nhân targets are queried first, and only fall back to broader discovery if the batch stays thin. Verify: crawl logs explain real reject reasons (not vague `undefined`), the run still completes cleanly, and the batch remains small-but-usable.
- 2026-04-21 | From: techlead | Scope: Run developer verification on the current UI + crawl-data flow after designer review. Verify: lint and build pass, crawl script still produces usable `movies.json`, and no hydration/runtime issues are introduced.
- 2026-04-21 | From: designer | Scope: Validate implementation for the reported regressions: wrong movie routing, tiny player, YouTube controls, and episode/full-movie display logic. Verify: each card routes correctly, player renders at usable size, controls follow spec, and no build/runtime regressions are introduced.
- 2026-04-21 | From: designer | Scope: Verify the new playback/crawl rules after designer sign-off: tag taxonomy, short-clip exclusion, hidden YouTube UI, and scrub/fullscreen controls. Verify: build/lint/runtime stay clean and the player + crawl flow behave as specified.
- 2026-04-21 | From: designer | Scope: Implement the category pass: keep header category text on one line and hide Tấu Hài from crawl-derived category menus. Verify: menu labels no longer wrap, visible categories still come from crawled tags, and no runtime/bundle issues are introduced.
- 2026-04-22 | From: designer | Scope: Implement watch-page fullscreen/popup UX update. Verify: fullscreen button attempts native browser fullscreen first with safe fallback; popup becomes option menu (mini player + system popout), closes on outside click/Escape, and build/lint remain green.
- 2026-04-22 | From: techlead | Scope: Adopt standardized team SOP from `WORKING_RULES.md`. Verify: implementation tasks include explicit lint/build/runtime evidence or clearly stated blockers.
- 2026-04-23 | From: techlead | Scope: Tighten the watch-player title-cover mask so fullscreen no longer washes out the top of the video. Verify: cover remains effective for title/logo but the frame top stays crisp; note any runtime limitations.
- 2026-04-23 | From: techlead | Scope: Replace the soft top gradient/title mask on the watch player with a tighter overlay that hides YouTube branding without dimming the first rows of the video, especially in fullscreen. Verify: top-edge video clarity improves, branding is still covered, and no new layout/runtime regressions are introduced.
- 2026-04-23 | From: techlead | Scope: Self-setup the local dev environment so project verification commands work again (`npm.cmd run lint` / `npm.cmd run build`). Verify: install or restore missing dependencies and confirm the commands run successfully before returning the task.
- 2026-04-23 | From: techlead | Scope: Implement watch-player double-click seek interaction. Verify: single click still toggles play/pause, double-click left seeks backward ~10-15s, double-click right seeks forward ~10-15s, and fullscreen/mobile remain stable.
- 2026-04-23 | From: techlead | Scope: Add keyboard arrow controls to the watch player. Verify: left/right arrows seek backward/forward ~15 seconds, up/down arrows decrease/increase volume by a small step, and shortcuts do not interfere with inputs or fullscreen playback.
- 2026-04-24 | From: techlead | Scope: Rebuild crawler logging and keep the crawl small-drip with Ha Nhân sources first, then fallback to broader discovery only when the batch is thin. Verify: crawl logs show real failure reasons (not `undefined`), Ha Nhân targets are queried first, and a crawl run can still produce a healthy small batch without writing stale output.
