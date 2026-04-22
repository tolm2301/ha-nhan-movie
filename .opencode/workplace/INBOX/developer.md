# INBOX: Developer

Use this queue for implementation and bugfix tasks.

## Entries
- (template) YYYY-MM-DD | From: techlead/designer | Scope: ... | Verify: ...
- 2026-04-21 | From: techlead | Scope: Run developer verification on the current UI + crawl-data flow after designer review. Verify: lint and build pass, crawl script still produces usable `movies.json`, and no hydration/runtime issues are introduced.
- 2026-04-21 | From: designer | Scope: Validate implementation for the reported regressions: wrong movie routing, tiny player, YouTube controls, and episode/full-movie display logic. Verify: each card routes correctly, player renders at usable size, controls follow spec, and no build/runtime regressions are introduced.
- 2026-04-21 | From: designer | Scope: Verify the new playback/crawl rules after designer sign-off: tag taxonomy, short-clip exclusion, hidden YouTube UI, and scrub/fullscreen controls. Verify: build/lint/runtime stay clean and the player + crawl flow behave as specified.
- 2026-04-21 | From: designer | Scope: Implement the category pass: keep header category text on one line and hide Tấu Hài from crawl-derived category menus. Verify: menu labels no longer wrap, visible categories still come from crawled tags, and no runtime/bundle issues are introduced.
- 2026-04-22 | From: designer | Scope: Implement watch-page fullscreen/popup UX update. Verify: fullscreen button attempts native browser fullscreen first with safe fallback; popup becomes option menu (mini player + system popout), closes on outside click/Escape, and build/lint remain green.
- 2026-04-22 | From: techlead | Scope: Adopt standardized team SOP from `WORKING_RULES.md`. Verify: implementation tasks include explicit lint/build/runtime evidence or clearly stated blockers.
