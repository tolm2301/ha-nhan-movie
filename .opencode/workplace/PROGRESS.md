# Progress Timeline

## YYYY-MM-DD
- Scope: Review UI and crawled data flow optimization.
- Actions: Created task board entry; sent designer review context; started evidence trail.
- Evidence: Current flow uses `src/lib/movies.json` for hero + category buckets in `src/lib/data.js`; UI renders hero + five carousel sections from static filters.
- Verification: Designer check complete: UI is readable and mobile-aware, but the data flow is not fully optimized because the hero client component pulls the whole JSON bundle.
- Verification: Developer check complete: production build passes; lint fails on pre-existing unescaped quotes in `src/app/search/SearchContent.jsx` and warns on `<img>` usage in hero/card components.
- Notes: Crawl script completed and refreshed `src/lib/movies.json`, but reported undefined errors for some targets. Final review complete; task closed with known risks.

## 2026-04-21
- Scope: Coordinate follow-up on category crawl quality, wrong playback routing, tiny player sizing, YouTube control visibility, and full-vs-series episode rules.
- Acceptance criteria: category crawls exclude low-quality/incorrect videos; each card opens its own detail/playback target; movie player is readable and usable; YouTube controls are hidden/configured per spec; full movies do not show episode lists; series still do.
- Actions: Opened a new high-priority in-progress task and assigned the sequence designer -> developer -> creator -> techlead review.
- Evidence: User report lists the exact regressions; existing board/handoff records now reflect the new task chain.
- Verification: Pending developer build/lint/runtime validation and final techlead review.
- Risks: Content metadata may be insufficient to classify quality/type cleanly; routing and player behavior may share the same component path.
- Scope: Production-hardening pass for crawl taxonomy and playback UX.
- Acceptance criteria: genres derive from YouTube tags; clips under 10 minutes are excluded from movie rails; low-value novelty clips are filtered out; 2D-film characters and famous figures remain discoverable; playback exposes skip-forward, fullscreen, scrub-to-next, and hover-preview behavior; YouTube-branded overlays/title affordances are minimized or removed where the embed allows.
- Actions: Re-pointed the active task to the designer stage and queued follow-up owner context for developer -> creator -> techlead.
- Evidence: Task board updated; new handoff row added; inboxes seeded with the next-owner expectations.
- Verification: Pending designer review, then developer runtime/build validation.
- Risks: Tag metadata may be noisy, some YouTube UI elements may be constrained by the embed API, and aggressive filtering could remove legitimate short-form content.
- Scope: Fix category bar wrapping and remove Tấu Hài from crawl-derived categories.
- Acceptance criteria: header category labels stay on a single line; visible categories continue to come from crawled tags; Tấu Hài does not appear in the header menu, home category rails, or category route lookup.
- Actions: Queued designer -> developer -> creator -> techlead review for the category-only cleanup pass.
- Evidence: `src/lib/data.js` already derives categories from `src/lib/movies.json`; wrapping is controlled by `src/components/Header/Header.module.css`.
- Verification: Developer check complete: lint passes, production build passes, crawl still completes with the existing undefined warnings but regenerates `movies.json`.
- Verification: Creator review complete: no extra docs or workflow gaps remain for the category cleanup.
- Verification: Techlead review complete: category labels stay on one line and Tấu Hài is excluded from all derived category menus.
- Risks: Narrow mobile drawers may still need spacing tweaks if more long labels are added later.
