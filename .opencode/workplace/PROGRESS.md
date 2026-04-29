# Progress Timeline

## 2026-04-30 (developer snapshot-refresh on crawl writes)
- Scope: Refresh the static runtime snapshot automatically whenever crawl persistence writes updated DB data.
- Actions: Added a shared snapshot writer, kept the standalone snapshot script as a thin wrapper around the shared helper, and hooked `replacePersistedMovies()` to rewrite `src/lib/movies.json` after a successful crawl/cron DB commit so the runtime snapshot stays aligned with the latest persisted batch.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed and the `prebuild` snapshot step reported `source: "db"` with 202 movies; `npm.cmd run crawl:dry` was attempted but timed out before completion.
- Risks: Snapshot refresh now happens after DB commit, so a filesystem write failure can leave DB and snapshot briefly out of sync until the next successful crawl/migration run.

## 2026-04-30 (techlead snapshot-static closeout)
- Scope: Close the runtime snapshot-static delivery after developer removed live DB reads from the request path.
- Actions: Confirmed the catalog now loads from the static JSON snapshot only, with DB used only to regenerate that snapshot during prebuild/dev refresh flows.
- Verification: Developer reported `npm.cmd run lint` and `npm.cmd run build` passing; the snapshot regeneration step ran during build and rewrote `src/lib/movies.json` from DB with 202 movies.
- Risks: DB freshness now depends on snapshot regeneration cadence plus ISR, so updates are no longer instant at request time.

## 2026-04-30 (developer snapshot-static runtime)
- Scope: Remove live Postgres reads from the runtime critical path by serving the catalog from a static JSON snapshot, while keeping the database as the update source.
- Actions: Simplified `getMovieCatalog()` to build from `src/lib/movies.json` only, added `scripts/generate-movies-snapshot.mjs` to refresh that snapshot from Postgres when available and fall back to JSON locally, and wired `prebuild`/`dev:fresh` to keep the snapshot aligned without runtime DB calls.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; build output shows the snapshot refresh ran first and the app still pre-renders the same routes. The snapshot regeneration script reported `source: "db"` and rewrote `src/lib/movies.json` with 202 movies.
- Risks: Freshness is now bounded by snapshot regeneration plus the existing ISR window, so a DB update will not appear until the next snapshot sync/build.

## 2026-04-29 (techlead snapshot-static kickoff)
- Scope: Move runtime movie reads off the DB critical path by generating/serving a static snapshot with ISR freshness.
- Actions: Chosen direction is now DB-as-update-source only; runtime pages should read a precomputed snapshot or cache layer instead of waiting on live Postgres queries.
- Verification: Planning/assignment only so far; implementation pending.
- Risks: Freshness becomes bounded by the snapshot/ISR window, so the regeneration trigger must stay reliable.

## 2026-04-29 (techlead static/ISR closeout)
- Scope: Close the static-precompute delivery after developer implemented the prebuildable-route split.
- Actions: Reviewed the implementation summary, confirmed the intended routes now pre-render or use server-cached data, and accepted the smaller client-island approach as the correct fit for this app.
- Verification: Developer reported `npm.cmd run lint` and `npm.cmd run build` passing, with build output showing `/` as ISR, `/watch/[id]` and `/watch-popout/[id]` as static, and `/search` plus `/category/[type]` remaining server-rendered on demand.
- Risks: Category pagination is still query-driven and search remains dynamic, so those routes are improved but not fully static.

## 2026-04-29 (developer static/ISR split)
- Scope: Make the app load faster by pre-rendering what can be static/ISR, while keeping only the minimum client code for playback and interaction.
- Actions: Passed the shared category menu from the server layout into the client header so the nav no longer fetches `/api/movies` on mount; converted search to a server-rendered result page that filters the cached catalog on the server instead of hydrating a client fetch flow; added `generateStaticParams()` for watch, watch-popout, and category slugs so known content is prebuilt; kept the watch/player islands unchanged aside from the route split.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed. Build output now shows `/` as static/ISR, `/watch/[id]` and `/watch-popout/[id]` as SSG, while `/search` and `/category/[type]` remain server-rendered on demand because they depend on query-string state.
- Risks: `/category/[type]` still needs `?page=` query handling, so it is not fully static yet; `/search` is still query-driven and therefore dynamic, but its data load is now server-cached instead of client-fetched.

## 2026-04-29 (techlead static-precompute direction)
- Scope: Reframe the load issue from generic SSR toward static generation/ISR where routes can be precomputed, keeping client-side code only for interactive islands.
- Actions: Clarified that precompiled HTML/data is the better fit for mostly read-only pages like home/category/search where runtime freshness is not critical, while watch/player interactivity can remain client-side.
- Verification: Planning only; no implementation yet.
- Risks: Truly dynamic pieces (current playback state, user-specific history, live search behavior if any) still need client/server runtime work, so the static split must be selective.


## 2026-04-29 (techlead SSR reset)
- Scope: Follow the user's updated direction to restore the current performance changes first, then rebuild the slow paths using a server-side rendering/server-component approach.
- Actions: Superseded the earlier audit-only instruction and issued a new implementation slice that starts from a clean baseline before moving heavy route work server-side.
- Verification: Intake/planning only so far; no code changes yet.
- Risks: Some routes are already server-rendered in App Router, so the refactor must target the exact client-bound work and avoid undoing useful performance wins unnecessarily.


## 2026-04-29 (techlead SSR intake)
- Scope: Assess the user-reported slow load issue and determine whether the right fix is server-side rendering, streaming, or reducing client-side hydration/bundle work.
- Actions: Triaged the request as a performance task for the slow watch/category flows and prepared a developer investigation slice focused on the actual render path rather than assuming SSR is the only bottleneck.
- Verification: Review/intake only so far; no implementation yet.
- Risks: Next.js App Router already server-renders server components by default, so the real win may come from moving heavy client components/data work back to the server instead of a blanket SSR rewrite.


## 2026-04-28 (developer popup pin control)
- Scope: Add a visible Pin/Unpin control and state for the detached watch popup, and wire the popup title so the existing Windows topmost helper can target it.
- Actions: Added a popup header pin toggle with visible pinned/unpinned state, persisted the pin request per movie in localStorage, updated the detached popup title to stay compatible with `tools/window-pin/PinHanhanPopup.ps1`, and surfaced an explicit fallback message when the browser cannot guarantee always-on-top behavior.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: The web popup still cannot force true OS-level always-on-top pinning by itself, so Windows topmost behavior still depends on the external helper being run by the user.

## 2026-04-28 (developer popup pin control)
- Scope: Add a visible Pin/Unpin control and state for the detached watch popup, and wire the popup title so the existing Windows topmost helper can target it.
- Actions: Added a popup header pin toggle with visible pinned/unpinned state, persisted the pin request per movie in localStorage, updated the detached popup title to stay compatible with `tools/window-pin/PinHanhanPopup.ps1`, and surfaced an explicit fallback message when the browser cannot guarantee always-on-top behavior.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: The web popup still cannot force true OS-level always-on-top pinning by itself, so Windows topmost behavior still depends on the external helper being run by the user.

## 2026-04-28 (techlead pin control follow-up)
- Scope: Add an explicit Pin/Unpin control for the detached watch popup and connect it to the strongest available pin behavior.
- Actions: Reopened the popup task because a detached window alone is not enough; the user wants a visible pin state and an actual control path for pinning.
- Verification: Review findings only so far; implementation has not started yet.
- Risks: Pinning is browser/platform constrained, so the UX must clearly show when the feature is supported versus best-effort only.

## 2026-04-28 (techlead popup-window closeout)
- Scope: Close the popup-direction follow-up after the detached browser popup route was implemented.
- Actions: Confirmed the watch flow now uses a single detached popup route rather than an in-page pseudo-popup, and the earlier load-quality improvements remain in place.
- Verification: Developer reported `npm.cmd run lint` and `npm.cmd run build` passing.
- Risks: Popup blockers and browser support can still affect the detached window, but the product direction is now explicit.

## 2026-04-28 (developer detached popup window)

- Scope: Replace the watch-page in-page pseudo-popup with a true detached browser popup route and keep the watch player behavior narrow.
- Actions: Removed the CSS-pinned popup surface from the main watch view, added a dedicated `/watch-popout/[id]` route that opens in a separate window, and wired popup close/state handoff so the main player can pause/resume around the detached surface.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Browser popup blocking can prevent the detached window from opening, and closing the popup from the main page still falls back to the last known state if the popup did not post a final update.

## 2026-04-28 (techlead detached-popup follow-up)
- Scope: Correct the popup implementation so it matches the detached/pinned window intent rather than a CSS-pinned in-page surface.
- Actions: Re-opened the watch popup task after review confirmed the current implementation still lives inside the web page; asked for a true detached popup window or equivalent detached surface without reintroducing dual popup modes.
- Verification: Review findings only so far; implementation has not started yet.
- Risks: The fix must preserve the existing load improvements and avoid confusing the player with both in-page and detached popup paths.

## 2026-04-28 (developer popup-window restore)
- Scope: Restore the watch popup to the product-correct floating/pinned window direction and keep the existing watch-load improvements intact.
- Actions: Reworked the watch-page popup toggle from the in-page mini-player wording/behavior into a fixed floating window mode, added an explicit popup toolbar with a close action, and removed the old mini-player-specific styling paths so there is one clear popup direction.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: The popup is pinned via CSS rather than a separate browser window, so any future requirement for true detached-window behavior would need a larger follow-up.

## 2026-04-28 (techlead popup-window restore)
- Scope: Restore the product-correct watch popup direction and keep load quality acceptable across the main flows.
- Actions: Reopened the watch popup as a pinned/floating window style requirement, because the inline mini-player direction was not aligned with the intended product behavior.
- Verification: Review findings only so far; implementation has not started yet.
- Risks: Avoid reintroducing a confusing dual-popup model; there should be one clear floating-window direction, not competing popup modes.

## 2026-04-28 (developer product-quality follow-up)
- Scope: Implement the simplified product-quality follow-up for watch/player UX, search matching/states, and narrow home/category polish.
- Actions: Removed the browser-window popout path from the watch experience, kept a single in-page mini-player toggle alongside native fullscreen, expanded search to match accent-insensitive title/tag/category signals with clearer load/empty/error states, and tightened mobile hero/carousel/category responsiveness.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Search still depends on the data returned by `/api/movies`, and the mini-player remains an in-page layout mode rather than a separate detached window.

## 2026-04-28 (techlead product-quality follow-up)
- Scope: Turn the latest product-quality review into a developer implementation slice covering watch/player popup direction, search completeness, and home/category polish.
- Actions: Assigned the watch experience to a simpler product direction (native fullscreen + inline/miniplayer, no browser-window popout), asked for stronger search matching/states, and flagged obvious home/category polish issues for the same pass.
- Verification: Review findings only so far; implementation has not started yet.
- Risks: Avoid widening scope beyond the reported user-visible issues so the fix stays focused and shippable.

## 2026-04-28 (techlead product-quality handoff)
- Scope: Turn the latest product-quality review findings into an implementation task for the developer.
- Actions: Identified three concrete risks—spoofable cron crawl auth, potentially hanging YouTube API bootstrap on watch/popout pages, and invalid nested `<main>` landmarks across layout/category/search/watch-popout—and assigned them as one narrow bugfix slice.
- Verification: Findings came from the dedicated product-quality review; implementation has not started yet.
- Risks: Keep the fix scoped to the reported issues so watch playback, routing, and crawl behavior do not regress.

## 2026-04-28 (developer product-quality hardening)
- Scope: Fix the spoofable cron auth path, add YouTube bootstrap timeout/error handling for watch and popout playback, and remove the nested `<main>` landmark wrapper.
- Actions: Required `CRON_SECRET` for every cron crawl request before honoring `x-vercel-cron`, added a timeout/error-rejecting YouTube API loader plus graceful fallback messaging on the watch and popout pages, and changed the root layout wrapper from `<main>` to `<div>` so page-level `<main>` landmarks are no longer nested.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: The watch/player fallback only appears when the YouTube API never loads or times out, so normal playback behavior still depends on YouTube availability and browser/network conditions.

## 2026-04-28 (techlead product-quality agent)
- Scope: Add a dedicated product-quality review agent and wire it into the team workflow so product-fit and completeness checks are explicit instead of bundled into tester/creator work.
- Actions: Added `.opencode/agents/product-quality.md`, created `.opencode/workplace/INBOX/product-quality.md`, updated `WORKING_RULES.md` with a product-quality role boundary and gate, and inserted the new review step into `review-flow.md` and `teamwork.md`.
- Verification: File consistency checked against the edited agent, inbox, workflow, board, progress, and handoff docs; the new role is referenced in the review flow and team rules without replacing `tester`.
- Risks: The new role overlaps slightly with creator review on release readiness, so future tasks should keep product-quality focused on acceptance fit and user-visible completeness.

## 2026-04-26 (developer watch warm-up)
- Scope: Add a lightweight network warm-up for the watch player bootstrap without changing search behavior or adding heavy homepage preloads.
- Actions: Added conservative `preconnect`/`dns-prefetch` hints for `www.youtube.com`, `www.youtube-nocookie.com`, and `s.ytimg.com` in the root layout so the YouTube iframe API/player bootstrap can reuse warmed connections while keeping the hints global and low-cost.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; targeted browser pass reported desktop home `load=309ms`, category `load=1232ms`, search `load=128ms`, watch `load=1357ms`; mobile home `load=277ms`, category `load=1026ms`, search `load=98ms`, watch `load=1582ms`; home transitions `category=2627ms`, `search=1308ms`, `watch=2917ms`; watch readiness improved to `routeElapsedMs=2346ms` and `watch-player-ready=2324ms`; the page reached `data-watch-readiness="ready"`, but no `watch-playable` mark appeared in the timed window.
- Risks: The warm-up helped the watch bootstrap/readiness path, but desktop and mobile watch route loads are still above 1000ms and mobile category remains just over the line in this run.

## 2026-04-26 (tester combined browser verification)
- Scope: Run one fresh combined browser verification pass on the current code after the latest category and watch optimizations, checking desktop/mobile fresh loads, home route transitions, watch readiness markers, and mobile overflow.
- Actions: Measured fresh loads for `/`, `/category/ha-nhan`, `/search?q=hanhan`, and `/watch/EvzXuJn2aUM` on desktop and mobile, measured home→category/search/watch transitions from the home page, and captured watch readiness using the `watch-player-ready`/`watch-playable` markers plus the `data-watch-readiness` state.
- Verification: Desktop loads were home `143ms`, category `809ms`, search `138ms`, watch `1409ms`; mobile loads were home `136ms`, category `2202ms`, search `112ms`, watch `1473ms`; home transitions were category `3121ms`, search `1285ms`, watch `3347ms`; watch readiness marks were `watch-player-ready=3287.9ms` and `watch-playable=15782.3ms` with the page ending in `data-watch-readiness="playable"`; mobile `/category/ha-nhan` stayed overflow-free (`scrollWidth=390` on `390px`).
- Risks: Search and watch mobile loads still exceed the 1000ms warning line in this run, and home→category/home→watch transitions are also above the line; category desktop remained under, but mobile category was over.

## 2026-04-26 (developer category paint deferral)
- Scope: Apply one more narrow optimization to the category page by reducing upfront card layout/paint work, while keeping search and watch behavior untouched.
- Actions: Added `content-visibility: auto` plus intrinsic sizing to `MovieCard` cards and the category grid so offscreen cards can skip early layout/paint work while preserving the same markup and UX.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; targeted browser pass on the category route reported desktop `/category/ha-nhan` `load=980ms` and mobile `/category/ha-nhan` `load=875ms`, both under the 1000ms warning line, with home->category transition at `3408ms` in that run but the initial category route itself now consistently landed below the warning line in the focused check.
- Risks: The broader home/server timings still vary run-to-run, so the category improvement is strongest on the route’s own initial load rather than every navigation-related metric.

## 2026-04-26 (developer performance fix)
- Scope: Implement the smallest practical fixes for the confirmed home-load, mobile overflow, and watch-readiness issues without touching search behavior.
- Actions: Reduced the watch route payload to ship only the current movie on first render, kept the rest of the catalog fetch deferred for series episodes only, merged the later catalog response without replacing the active movie object, and preserved the earlier mobile/header/home containment changes.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; browser verification after the watch-payload trim reported desktop home `load=468ms`, category `load=1115ms`, search `load=292ms`, watch `load=948ms`; mobile home `load=345ms`, category `load=1109ms`, search `load=211ms`, watch `load=1006ms`; home transitions measured `category=857ms`, `search=71ms`, `watch=879ms`; watch route entry settled in `4928ms` but the player reached `ready` at `1993.6ms` and `playable` after manual play at `5440.6ms`; mobile `/category/ha-nhan` remained overflow-free (`scrollWidth=390` on `390px`).
- Risks: Watch playback readiness still depends on YouTube/browser behavior, and category load remains slightly above the stricter warning line even after the watch-payload trim.

## 2026-04-26 (tester stricter performance sweep)
- Scope: Re-run the browser performance pass with stricter thresholds, treating any route load over 1000ms as a warning and separating watch route navigation from video readiness.
- Actions: Ran a fresh Playwright browser sweep on the local production server for desktop and mobile viewports, measured initial loads for `/`, `/category/ha-nhan`, `/search?q=hanhan`, and `/watch/EvzXuJn2aUM`, measured home->category/search/watch transitions, and probed watch readiness by checking the iframe/control state plus a user-click playback proxy.
- Verification: Desktop loads were `home load=2676ms/fcp=2504ms`, `category load=896ms/fcp=1040ms`, `search load=149ms/fcp=108ms`, and `watch load=986ms/fcp=944ms`; route transitions were `home->category=1145ms`, `home->search=99ms`, `home->watch=1011ms`; watch readiness was not directly observable as a stable autoplay-first-frame event, but the player iframe was present and the controls became usable immediately after route settle, with a click-to-first-playback-progress proxy of `403ms`; mobile `/category/ha-nhan` still overflowed horizontally (`scrollWidth=424` on `390px`) and mobile category load hit `1009ms`.
- Risks: Home load, home->category, and home->watch are all over the stricter 1000ms warning line; watch first-frame remains a proxy because autoplay did not expose a stable playing-state marker in the browser run.

## 2026-04-26 (tester performance sweep)
- Scope: Measure initial load speed and route transition speed first, then check desktop/mobile responsiveness on home, category, search, and watch flows.
- Actions: Built the app, ran a headless Playwright browser pass against the local production server, measured fresh-load timings for `/`, `/category/ha-nhan`, `/search?q=hanhan`, and `/watch/EvzXuJn2aUM`, then measured home->category, home->search, and home->watch route transitions plus mobile viewport overflow checks.
- Verification: Desktop load timings came back as home `load=2204ms`/`fcp=1984ms`, category `load=1197ms`/`fcp=1132ms`, search `load=118ms`/`fcp=160ms`, and watch `load=978ms`/`fcp=968ms`; route transitions measured home->category `933ms`, home->search `91ms`, and home->watch `914ms`; mobile checks showed no overflow on home/search/watch, but `/category/ha-nhan` exceeded the viewport (`scrollWidth=424` on `390px`) due to the page info badge at the top right.
- Risks: The category page needs a mobile overflow fix before the responsive pass is clean; otherwise the main flows remained usable and no blocking jank or render failure was observed.

## 2026-04-25 (tester performance sweep)
- Scope: Test the current UI with performance prioritized first, focusing on page load speed, route transition speed, and obvious responsiveness regressions across the main flows.
- Actions: Assigned the new tester pass to measure home/category/search/watch behavior and report any slow or janky paths with evidence.
- Verification: Pending tester execution.
- Risks: Current repo does not expose a dedicated UI performance test script, so results will depend on browser/runtime measurements gathered by the tester.

## 2026-04-25 (agent skill upgrade)
- Scope: Upgrade the `creator`, `designer`, and new `tester` subagent instructions so the team can operate at a higher-quality project level.
- Actions: Strengthened `creator.md` around release readiness, metadata, docs, copy, and operational risk handling; sharpened `designer.md` toward premium UI direction, responsive/state coverage, and clearer handoff deliverables; added a new `tester.md` focused on desktop/mobile UI checks, regression coverage, reproducible bug reporting, and evidence-driven verification.
- Verification: File-level update only; no app code changed and no runtime commands were required.
- Risks: The new tester workflow assumes future tasks will hand off explicit scope and acceptance criteria so verification can stay concrete instead of generic.

## 2026-04-25 (developer taxonomy reclassification pass)
- Scope: Reclassify the current catalog to the expanded seven-bucket taxonomy while preserving the Ha Nhân-first rule and keeping unrelated UI/SEO/ads work untouched.
- Actions: Broadened the shared category matcher in `src/lib/movieCategories.js` so `Trọng Sinh`, `Xuyên Không`, `Hệ Thống`, and `Tu Tiên` now recognize the latest expanded anchors/synonyms, and moved the category priority to `Hà Nhân` → `Liễu Như Yên` → `Trọng Sinh` → `Xuyên Không` → `Hệ Thống` → `Tu Tiên` → `Khác`.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; catalog smoke check via `getMovieCatalog()` reported `ha-nhan:49`, `tu-tien:43`, `xuyen-khong:22`, `trong-sinh:15`, `lieu-nhu-yen:20`, `he-thong:14`, `khac:34`.
- Risks: The broadened `Tu Tiên` bucket now absorbs many cultivation/anime series by design, so borderline fantasy titles can still land there; `Khác` remains a catch-all for general review/variety content.

## 2026-04-25 (developer controlled taxonomy expansion)
- Scope: Update the crawler taxonomy using the creator-approved tiered keyword structure for the current category set without letting broad fallback terms dominate primary classification.
- Actions: Split the shared category taxonomy into `core`, `expanded`, `fallback-only`, and `risky caps` tiers for `Hà Nhân`, `Tu Tiên`, `Xuyên Không`, `Trọng Sinh`, `Liễu Như Yên`, `Hệ Thống`, and `Khác`; wired the crawler to query the tiers in order with caps on the broader tiers; kept runtime category resolution on explicit/strong matches before broader fallbacks; moved the broad `system` query into the crawl-only risky tier so it no longer drives runtime classification; and documented the tiered crawl behavior in the README/workplace notes.
- Verification: `npm.cmd run lint` passed (`EXIT:0`); `npm.cmd run build` passed (`EXIT:0`); `npm.cmd run crawl:dry` passed (`EXIT:0`) and still completed a 7-category dry crawl with 35 kept videos total.
- Risks: The broader `risky caps` tier still exists for crawl discovery, so it must stay capped or it can widen noisy search results faster than the named tiers; `Hệ Thống` remains the noisiest bucket because it still accepts several broad system/AI-style anchors.

## 2026-04-25 (creator crawl taxonomy proposal)
- Scope: Propose a broader but controlled keyword taxonomy for crawl discovery across the current category system so the techlead can expand queries without making classification too loose.
- Actions: Drafted a priority-based recommendation for `Hà Nhân`, `Tu Tiên`, `Xuyên Không`, `Trọng Sinh`, `Liễu Như Yên`, `Hệ Thống`, and `Khác`, separating must-have anchors, expanded synonyms/phrases, fallback-only broad terms, and risky terms to cap or avoid.
- Verification: Review-only; no code or data changes made.
- Risks: Any broad term promoted into the primary tier will increase crawl noise and category overlap, especially for `Hệ Thống`, `Tu Tiên`, and `Khác`.

# 2026-04-25 (developer 4-slot AdSense enforcement)
- Scope: Enforce the agreed four-slot AdSense setup with no top-of-page home ad and no extra placements beyond home-after-rails, category-after-first-block, watch-after-related, and search-after-results.
- Actions: Removed the home hero/footer AdSense placements, kept the shared AdSense script/framework intact, trimmed the active placement config to the four approved slots, and updated the README/board to match the new layout.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: The watch slot now appears only after the related/episode block, and any placement with a missing slot env remains inert by design.

## 2026-04-25 (developer homepage AdSense placement)
- Scope: Reduce the intrusiveness of the homepage AdSense placement by removing the ad directly under the hero and moving the first visible home ad lower on the page, while preserving the site-wide AdSense framework.
- Actions: Removed the `homeAfterHero` placement from `src/app/page.js` and moved the remaining home rail ad to render after the third category rail (`index === 2`); updated the README note so the homepage placement decision matches the new behavior.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: If the home page ever has fewer than three rendered category rails, the lower home rail ad may not appear.

## 2026-04-25 (developer AdSense snippet wiring)
- Scope: Wire the exact Google AdSense client ID and the first ad-unit slot from the provided snippet into the existing AdSense integration, while leaving the rest of the placement behavior unchanged.
- Actions: Added hardcoded fallback values in `src/lib/adsense.js` so the shared client ID resolves to `ca-pub-5517015894265969` and `homeAfterHero` resolves to `6443422368` when env vars are absent; updated `README.md` to note the first home ad unit is now wired by default; the existing site-wide script loader and other placement gates still run through the shared helper.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Other placements remain env-driven and hidden unless their slot IDs are still configured.

## 2026-04-25 (developer AdSense metadata hardcode)
- Scope: Hardcode the Google AdSense account verification meta tag into the Next.js metadata export using the exact provided value, while keeping the rest of the SEO metadata intact.
- Actions: Replaced the env-gated `google-adsense-account` metadata branch in `src/app/layout.js` with a direct `metadata.other['google-adsense-account'] = 'ca-pub-5517015894265969'` entry and removed the now-unused client-id helper import from the layout.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: None beyond the existing AdSense script gating, which was intentionally left unchanged.

## 2026-04-25 (developer AdSense metadata follow-up)
- Scope: Move the Google AdSense account verification meta tag into the Next.js metadata export while preserving the existing SEO metadata.
- Actions: Added `google-adsense-account` under `export const metadata.other` in `src/app/layout.js`, reusing the existing AdSense client ID helper so the tag is emitted from the metadata API instead of raw head markup.
- Verification: Pending `npm.cmd run lint` and `npm.cmd run build`.
- Risks: The tag only emits when `NEXT_PUBLIC_ADSENSE_CLIENT_ID` is set; no literal `ca-pub-...` value was present in the repo to hardcode.

## 2026-04-25 (developer AdSense framework)
- Scope: Add a lightweight AdSense framework with safe placeholders for home, category, watch, and search placements, while keeping ads disabled when env config is missing.
- Actions: Added a shared AdSense config helper, a reusable client-side ad slot component, and page-level placements for home/category/watch/search; wired the root layout to load the AdSense script only when a client ID is configured; documented the required env vars for production activation.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Real rendering still depends on valid AdSense client and slot IDs being supplied later; the framework intentionally hides empty slots instead of showing mock ads.

## 2026-04-25 (developer Tu Tiên taxonomy pass)
- Scope: Add `Tu Tiên` as a first-class category in the shared taxonomy, surface it on the home page immediately after `Hà Nhân`, and keep related crawl/category grouping consistent.
- Actions: Added `Tu Tiên` to the shared category definitions, taught the classifier to bucket titles/tags containing `Tu Tiên` or `Tiên Hiệp`, inserted a `tu-tien` crawl batch right after `ha-nhan`, and updated the README category list plus workplace tracking.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; smoke tests confirmed category order `ha-nhan -> tu-tien -> xuyen-khong -> trong-sinh -> lieu-nhu-yen -> he-thong -> khac`, `tuTienCount:30`, `featuredTag:"Hà Nhân"`, `homeFirstTag:"Hà Nhân"`, and a sample `Tiên Hiệp` item resolved to `tu-tien`.
- Verification: Passed locally.
- Risks: `Tu Tiên` intentionally captures both explicit `Tu Tiên` tags and broader `Tiên Hiệp` titles/tags, so some borderline fantasy items may now land there by design.

## 2026-04-25 (developer SEO technical pass)
- Scope: Add core technical SEO coverage for the Next.js app: metadata, canonical URLs, robots/sitemap routes, and structured data for the homepage, category pages, and watch pages.
- Actions: Added shared SEO helpers, page-specific metadata generation, `WebSite`/`BreadcrumbList`/`ItemList`/`VideoObject` JSON-LD where appropriate, `robots.txt` and `sitemap.xml` route handlers, and a search-page noindex directive; also moved the watch page into a server wrapper so the watch metadata can be generated safely while preserving the existing client player.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; SEO smoke check reported generated robots rules, sitemap URLs, homepage WebSite search action, and metadata helpers with canonical output.
- Verification: Passed locally.
- Risks: Absolute SEO URLs currently resolve from `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL`, otherwise they fall back to localhost in development; set the production site URL env so canonical/JSON-LD values stay correct.

## 2026-04-25 (developer sitemap production-url follow-up)
- Scope: Make the sitemap and absolute SEO URLs resolve to the Vercel production domain more reliably, and keep the sitemap refreshable for Google.
- Actions: Expanded the site URL helper to prefer `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`, with safe `https://` normalization; added a one-hour sitemap revalidate window so Google sees refreshed URLs without requiring a deploy.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; build output still exposes `/sitemap.xml` as a route and now shows `Revalidate 1h` for the sitemap.
- Verification: Passed locally.
- Risks: The exact production hostname still depends on the Vercel environment variable or configured custom domain, so the deployed site must have one of those set for absolute URLs to match production.

## 2026-04-25 (developer watch skip controls)
- Scope: Add visible skip backward/forward controls to the watch-player toolbar and keep the jump interval consistent with the existing seek shortcuts.
- Actions: Added 15-second skip buttons beside the playback controls, reused the shared seek helper for button, keyboard, and double-click seeking, and kept the buttons inside the same fullscreen/auto-hide control surface so both normal and fullscreen modes use the same wiring.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; focused source smoke confirmed the watch player now contains the skip-step constant and both skip button handlers.
- Verification: Passed locally.
- Risks: The buttons rely on the same control-bar visibility rules as the rest of the toolbar, so if future UX changes alter auto-hide timing, the new controls will follow that behavior too.

## 2026-04-25 (developer watch toolbar auto-hide)
- Scope: Make the watch-page toolbar auto-hide in normal mode while preserving the existing fullscreen hide/show behavior.
- Actions: Added a shared player-activity handler plus a startup timer so the controls auto-hide in both normal and fullscreen modes; wired pointer movement, pointer down, and keyboard activity to restore visibility without changing playback/fullscreen logic.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; source smoke confirmed the new handler and control-visibility wiring are present in `src/app/watch/[id]/page.js`.
- Verification: Passed locally.
- Risks: Touch-only interactions still depend on the same overlay/tap behavior as fullscreen, so gesture tuning may be needed later if the normal-mode experience needs to differ.

## 2026-04-25 (developer thumbnail card fallback)
- Scope: Handle broken or missing thumbnails in the shared movie card UI used by home/category rails while keeping the existing source-level filters intact.
- Actions: Turned `MovieCard` into a client component, hid cards that fail `hasRenderableThumbnail()`, added a neutral placeholder for runtime image-load failures, and filtered carousel slides before rendering so invalid items do not leave empty slots.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; thumbnail helper smoke confirmed missing, broken, and foreign-host thumbnails return `false`.
- Verification: Passed locally.
- Risks: Runtime image failures now show the placeholder instead of a hard hide; if stricter removal is desired later, the carousel/card coordination would need a callback.

## 2026-04-25 (developer thumbnail placeholder cleanup)
- Scope: Tighten thumbnail filtering so blank/dark placeholder cards do not appear in home/category rails, then clean any already-stored bad items from the catalog and DB.
- Actions: Extracted thumbnail checks into `src/lib/thumbnailFilters.js`, added deterministic ytimg host/filename validation plus `frameN.jpg` placeholder rejection, wired the crawler to reject bad thumbnails before persistence, removed the `f9Ei2z8Fn1c` placeholder record from `src/lib/movies.json`, and deleted that row from Postgres.
- Evidence: Catalog smoke via `getMovieCatalog()` returned `totalMovies:197`, `homeCategories` still populated for all six rails, `visibleBad:[]`, and the placeholder item was absent from runtime results.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; catalog smoke inspection passed.
- Risks: The filter is intentionally conservative and only allows known ytimg filename shapes, so future thumbnail variants may need to be added if crawler output changes.

## 2026-04-25 (developer home catalog hygiene)
- Scope: Restore the `Khác` rail on the home page and keep broken/missing-thumbnail movies out of home/category listings.
- Actions: Removed the home-page exclusion that hid `Khác`, added a renderability filter in `src/lib/data.js` that drops known-bad or missing thumbnails before category bucketing, and cleaned the source catalog by removing the four broken thumbnail records from `src/lib/movies.json`.
- Evidence: Runtime smoke via `getMovieCatalog()` reported `khacCount:76`, `homeCategories` including `khac`, `totalMovies:168`, and `visibleBad:[]` for the four inspected broken movie IDs.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; catalog smoke inspection passed.
- Risks: The thumbnail filter currently blocks the catalog's known broken items explicitly; if new thumbnail failures appear later, they will need to be added to the filter or removed at the source.

## 2026-04-25 (developer Hà Nhân classification tighten)
- Scope: Tighten the Hà Nhân bucket so only explicit Hà Nhân-branded/source items stay there, and push unrelated character-series content into the themed buckets or Khác.
- Actions: Removed the legacy character-series fallback tags from the Hà Nhân category rule, made Hà Nhân require title-based brand/source markers before any fallback tagging, and kept non-Hà Nhân exact tags eligible for their own buckets.
- Evidence: Runtime smoke with env loaded reported `featuredTitle:"Xuyên Không Giả Vờ Ăn Chơi, Hà Nhân Âm Thầm Lên Đỉnh Quyền Lực | Hà Nhân Sub"`, `homeTrendingFirstTitle` matching the featured item, `haNhanCount:59`, and `badCount:0` for Diệp Phàm/Tiêu Viêm/Thạch Hạo/Vương Lâm title checks.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; runtime category smoke test passed.
- Risks: A few borderline Hà Nhân items that do not carry an explicit Hà Nhân marker in the title/source will now fall out of the Hà Nhân bucket by design.

## 2026-04-25 (developer home category rails)
- Scope: Make each home section represent its real category, add a `Tất cả` action for each rail, and paginate category pages.
- Actions: Switched the home page rails to read directly from `categoryBuckets`, passed category-specific `viewAllHref` links into `MovieCarousel`, replaced the rail action with a `Tất cả` navigation link, and added 24-per-page pagination plus page controls on the category route.
- Evidence: Local smoke test reported `featuredTag:"Hà Nhân"`, `homeTrendingFirstTag:"Hà Nhân"`, home category links like `/category/ha-nhan` and `/category/xuyen-khong`, and `haNhanPages:2` with `haNhanFirstPageCount:24`.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; smoke test passed.
- Risks: Pagination is query-string based (`?page=`), so copied links should preserve the current category page state in the browser.

## 2026-04-25 (developer home ranking)
- Scope: Keep the home hero and first updated rail slot Ha Nhân-first while preserving the rest of the home ordering.
- Actions: Added a small home-ranking helper in `src/lib/data.js` that picks the first direct `Hà Nhân` bucket item deterministically, promotes that movie to the front of the home update rail, and keeps the remaining order unchanged; switched `src/app/page.js` to render the home-specific rail ordering.
- Evidence: Local smoke test returned `{"featuredTag":"Hà Nhân","homeTrendingFirstTag":"Hà Nhân","featuredId":"EvzXuJn2aUM","homeTrendingFirstId":"EvzXuJn2aUM","haNhanCount":40}`.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed; smoke test passed.
- Risks: If the home catalog ever contains no direct `Hà Nhân` bucket, the code still falls back to the first available movie.

## 2026-04-25 (developer crawl anchor refinement)
- Scope: Move `@keodeovietsub` into a shared crawl source-anchor list so AI/short-form story discovery can reuse it outside `Hệ Thống`.
- Actions: Extracted the anchor into a shared source list in `src/lib/crawl.server.js`, reused it for both `Hệ Thống` and `Khác` before their keyword batches, and updated the crawl README note to describe the shared taxonomy.
- Evidence: Source change is limited to `src/lib/crawl.server.js`, `README.md`, and workplace tracking notes; verification commands are listed below.
- Verification: Passed locally (`node --check src/lib/crawl.server.js`; `npm.cmd run lint`; `npm.cmd run build`; `npm.cmd run crawl:dry`).
- Risks: `Khác` now also seeds from the shared trusted source, so day-to-day mix there may lean a little more toward the anchored AI/short-form content.

## 2026-04-25 (developer category crawl split)
- Scope: Reorganize the catalog into the requested six buckets and split the daily crawl into per-category batches.
- Actions: Added a shared category taxonomy helper, normalized runtime grouping to `Hà Nhân` / `Xuyên Không` / `Trọng Sinh` / `Liễu Như Yên` / `Hệ Thống` / `Khác`, and rewired the crawler to process each category separately with ~5 new items per category, dedupe per run, and emit category batch summaries in logs and crawl-run metadata.
- Evidence: `node --check src/lib/movieCategories.js`; `node --check src/lib/data.js`; `node --check src/lib/crawl.server.js`; `npm.cmd run lint`; `npm.cmd run build`; `npm.cmd run crawl:dry` completed with category batch logs and `categorySummaries`; runtime category smoke test printed `Hệ Thống` in the category menu.
- Verification: Passed locally.
- Risks: The `Khác` bucket still depends on broad fallback discovery, so its contents may vary more than the named buckets from day to day.

## 2026-04-25 (developer crawl execution)
- Scope: Run the current DB-first crawl flow and persist newly found movies to Postgres/Supabase.
- Actions: Executed `npm.cmd run crawl` with the current Ha Nhân-first filtering/retry logic; the crawl kept 30 items from the primary tier, found 16 new videos, reused 74 existing kept videos, and persisted the final 90-movie set to Postgres without using JSON fallback.
- Evidence: Crawl output reported `existingVideos:172`, `newVideos:16`, `totalFetched:30`, `existingKept:74`, and `persistedTo:"postgres"`; follow-up DB readback with env loaded reported `dbMovieCount:90`.
- Verification: Passed locally.
- Risks: The final DB count is lower than the pre-run JSON snapshot because the current persist path writes the filtered kept set; if a larger retention set is desired, that is a separate policy decision.

## 2026-04-25 (developer crawl execution rerun)
- Scope: Run the current category-aware crawl again and verify the DB-backed catalog accepted the new batch.
- Actions: Ran `npm.cmd run crawl` with the existing taxonomy/filtering rules; the run added 30 new items total across all six categories (5 each), skipped 5 duplicates, and logged category-rule rejects for untrusted authors, low-quality titles, short clips, and category reclassification.
- Evidence: Crawl output ended with `{"newVideos":30,"totalFetched":30,"existingKept":168,...}` and `persistedTo:"postgres"`; DB readback with env loaded returned `dbMovieCount:198`.
- Verification: `npm.cmd run crawl` passed; `node --input-type=module -e "...loadPersistedMovies({ allowJsonFallback: false })..."` returned `dbMovieCount:198`.
- Risks: No broken-thumbnail exclusions were surfaced in this run; category-rule filtering remained strict, so some long videos were excluded or reassigned rather than kept.

## 2026-04-25 (developer JSON backfill execution)
- Scope: Execute the existing JSON-to-Postgres migration for `src/lib/movies.json` and verify the full dataset was written.
- Actions: Ran `npm.cmd run migrate:movies` against the configured Supabase/Postgres target; the script reported `mode:"migrated"`, `crawlRunId:"3"`, `totalMovies:172`, and `keptCount:172`; then reloaded persisted movies through the DB-backed loader and confirmed the database returned 172 movies.
- Evidence: Migration output: `{"mode":"migrated","crawlRunId":"3","totalMovies":172,"keptCount":172}`; DB readback: `dbMovieCount:172`.
- Verification: Passed locally against the configured Postgres target.
- Risks: The migration is replace-on-write for `movies` but appends a new `crawl_runs` row each time, so repeated runs are content-idempotent but not history-idempotent.

## 2026-04-25 (developer DB-primary SSR restore)
- Scope: Restore DB-backed runtime as the primary path for Vercel/Supabase while keeping JSON as fallback only when the DB path fails.
- Actions: Switched the shared catalog loader back to Postgres-first reads, added a structured DB-failure log before JSON fallback, and updated the Postgres pool setup to prefer the direct Supabase URL on Vercel while handling the Supabase SSL chain safely.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; direct URL smoke test reported `{"envKey":"POSTGRES_URL_NON_POOLING","host":"db.project.supabase.co","port":"5432","sslmode":"require","isSupabase":true,"isPooled":false,"isDirect":true}`; pooled URL smoke test reported `{"envKey":"DATABASE_URL","host":"aws-0-us-east-1.pooler.supabase.com","port":"6543","sslmode":"require","isSupabase":true,"isPooled":true,"isDirect":false}`; DB-less catalog smoke test logged `movie_catalog_db_failed` and fell back to 172 JSON movies.
- Verification: Passed locally; no live Supabase connection was available in this environment.
- Risks: JSON fallback remains available when DB access is missing or broken; production should use the direct non-pooled Supabase URL on Vercel.

## 2026-04-25 (developer JSON-first runtime fallback)
- Scope: Temporarily stop production 500s from the DB certificate error by making the JSON file the primary runtime source again while keeping DB/cron failures visible.
- Actions: Switched the shared catalog loader to read `src/lib/movies.json` directly; made the crawl runner use the JSON file as its existing-data source; wrapped Postgres persistence so a DB failure is logged and the crawl returns a JSON-fallback result instead of crashing.
- Evidence: `node --check src/lib/data.js`; `node --check src/lib/movieStore.server.js`; `node --check src/lib/crawl.server.js`; `npm.cmd run lint`; `npm.cmd run build`; smoke test `node --input-type=module -e \"import('./src/lib/data.js')...\"` returned `{\"movies\":172,\"featured\":true,\"categories\":9}`.
- Verification: Passed locally.
- Risks: New crawl writes will not reach Postgres until the certificate/DB issue is fixed; the app now intentionally prioritizes the JSON snapshot over live DB data.

## 2026-04-25 (developer DB-backed crawl/runtime verification)
- Scope: Re-run local verification with the populated `.env.local`, reproduce the DB-backed deploy failure locally if possible, and fix env/DB wiring for local + Vercel use.
- Actions: Kept the local env loader in the crawl/migration scripts, taught the Postgres pool to relax SSL certificate checks only in non-production SSL-backed runs, stripped SSL query params before handing the connection string to `pg`, and hardened integer normalization so blank values no longer become `NaN` during inserts.
- Evidence: `npm.cmd run crawl:dry` completed against Postgres and reported `source:"postgres"`; `npm.cmd run crawl` completed successfully and persisted to Postgres; `npm.cmd run migrate:movies -- --dry-run` completed successfully; `npm.cmd run build` completed successfully with `.env.local` loaded.
- Verification: Passed locally.
- Risks: SSL relaxation is limited to non-production SSL-backed connections; production/Vercel still relies on a valid Postgres certificate chain.

## 2026-04-25 (developer local env setup)
- Scope: Create a local-only environment file for DB-backed crawl/runtime testing and keep local env files out of git.
- Actions: Added `.env.local` with placeholder Postgres/cron values, tightened `.gitignore` to exclude local env variants explicitly, documented how to use the file for local DB-backed testing, and taught the crawl/migration scripts to load the same env file locally.
- Evidence: `npm.cmd run dev` started successfully and reported `Environments: .env.local`; `npm.cmd run crawl:dry` completed successfully; `npm.cmd run migrate:movies -- --dry-run` completed successfully; `npm.cmd run build` completed successfully; `npm.cmd run crawl` now loads `.env.local` and fails with `connect ECONNREFUSED 127.0.0.1:65432`, showing the DB-backed path is isolated to the connection string.
- Verification: Passed for startup/dry-run/build; full crawl now reaches the DB connection step and fails only because the placeholder Postgres endpoint is not running.
- Risks: The placeholder `DATABASE_URL` still needs a real local or Supabase Postgres connection string to exercise an actual write.

## 2026-04-25 (developer Vercel Cron migration)
- Scope: Move the daily crawl trigger from GitHub Actions to a Vercel Cron-compatible route so scheduling no longer depends on GitHub.
- Actions: Extracted the crawler into a reusable server module, added `/api/cron/crawl` with Vercel Cron header validation plus optional `CRON_SECRET` manual access, wired `vercel.json` cron scheduling, and retired the GitHub Actions schedule in favor of a manual fallback workflow note.
- Evidence: `node --check scripts/crawl.mjs` passed; `node --check src/lib/crawl.server.js` passed; `node --check src/app/api/cron/crawl/route.js` passed; `npm.cmd run lint` passed; `npm.cmd run build` passed; `npm.cmd run crawl:dry` passed; manual route invocation with `x-cron-secret` and `?dryRun=1` returned `status 200` and `trigger":"manual"` without writing to Postgres.
- Verification: Passed locally.
- Risks: Real Postgres writes still depend on a configured `DATABASE_URL` in the Vercel runtime, and the manual access path should remain secret-protected.

## 2026-04-25 (developer Postgres migration)
- Scope: Move crawl persistence and runtime reads from `src/lib/movies.json` to Postgres/Supabase-compatible storage.
- Actions: Added a small Postgres storage layer with schema creation, JSON backfill, and full replace-on-crawl persistence; switched crawler writes to the database; updated home/category/watch/search/header read paths to load through the server API/database; kept `movies.json` only as a migration source and dry-run fallback.
- Evidence: `npm.cmd run lint` passed; `npm.cmd run build` passed; `npm.cmd run migrate:movies -- --dry-run` passed and reported 169 source movies; `npm.cmd run crawl:dry` passed and completed a full crawl pass without writing to Postgres.
- Verification: Passed locally, with real Postgres writes still pending a configured `DATABASE_URL`.
- Risks: Actual DB write verification could not be exercised here because no Supabase connection string was available in the environment.

## 2026-04-25 (developer 30-video crawl floor)
- Scope: Keep the crawl going until at least 30 kept videos are collected or all safe tiers are exhausted.
- Actions: Split crawl discovery into ordered tiers (primary exact Ha Nhân anchors, secondary Ha Nhân theme/format groups, then curated fallback channels and broad keywords); added tier-entry logs with remaining-needed counts plus explicit fallback-expansion messages; preserved the existing retry and strict rejection logic.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm.cmd run lint` passed; `npm.cmd run build` passed; `npm.cmd run crawl` completed cleanly, reached 30 kept items in the primary tier, and `src/lib/movies.json` was reverted after verification.
- Verification: Passed locally.
- Risks: Fallback tiers were not entered in this run because the primary tier already met the 30-item floor, so fallback activation is verified by code path/logging but not exercised at runtime.

## 2026-04-24 (developer transient crawl retry)
- Scope: Make crawl resilient to transient target failures without aborting the full run.
- Actions: Added small backoff retries for transient network/DNS/5xx-style search failures in `scripts/crawl.mjs`; when retries are exhausted, the crawler now logs and skips only the affected target/query instead of throwing the whole crawl.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm.cmd run lint` passed; `npm.cmd run build` passed; `npm.cmd run crawl` completed cleanly and kept running through the remaining targets.
- Verification: Passed locally.
- Risks: Upstream YouTube/search instability can still cause individual targets to be skipped, but the run now records the failure reason and continues.

## 2026-04-24 (developer theme-filter refinement)
- Scope: Keep the crawl Ha Nhân-first while making theme rejection logs more specific and preventing broad fallback words from driving acceptance.
- Actions: Reworked the theme decision path in `scripts/crawl.mjs` so exact Ha Nhân anchors and strong character signals are the primary keep buckets, secondary theme words only support those buckets, and broad words stay fallback-only; updated rejection reasons to name the missing bucket instead of a generic theme warning.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm.cmd run crawl` completed successfully, and the logs now show concrete rejects such as `missing primary Ha Nhan anchor or strong character signal` and `broad fallback terms are not enough on their own`.
- Verification: Passed locally.
- Risks: The filter remains intentionally strict, so some long videos will still be rejected unless they clearly match the curated Ha Nhân taxonomy.

## 2026-04-24 (developer crawl logging hardening)
- Scope: Make crawl failures obvious, preserve actionable evidence, and keep the Ha Nhân-first small-batch crawl behavior.
- Actions: Added timestamped structured crawl logs for run start, query order, keep/reject decisions, target summaries, and error objects/stack traces; upgraded target failure handling so all-target failures now surface as real run failures; added GitHub Actions crawl-log artifact upload so workflow output is reviewable after the job finishes.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm.cmd run crawl` completed twice during verification and printed timestamped structured logs with explicit keep/reject reasons and no `undefined` errors; the generated `src/lib/movies.json` refresh was reverted after verification.
- Verification: Passed locally.
- Risks: The crawl still depends on upstream YouTube search results, so source availability can still change day to day; workflow artifacts are only available after CI runs.

## 2026-04-24 (developer taxonomy implementation)
- Scope: Apply the approved Ha Nhân taxonomy to crawler discovery order and weighting.
- Actions: Reordered crawl discovery so exact Ha Nhân text anchors are queried first, then character/theme combinations, then format helpers; kept broad standalone terms as fallback-only queries.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm run crawl` completed and queried `Hà Nhân` first, keeping the crawl small-drip while still producing 5 new videos.
- Verification: Passed locally.
- Risks: Broad fallback terms are still available if the primary batch is thin, so occasional noisy hits remain possible; the strict author/theme filter can still reject some long videos.

## 2026-04-24 (taxonomy handoff to developer)
- Scope: Hand the approved Ha Nhân taxonomy to developer for crawler weighting/order changes.
- Acceptance criteria: exact Ha Nhân anchors are prioritized, character/theme combinations come next, and broad standalone terms remain low-weight fallback queries.
- Actions: Recorded the new developer task and handoff entry.
- Verification: Pending developer implementation.
- Risks: Broad terms like `phim`, `tu tiên`, `xuyên không`, and `trọng sinh` must stay capped so crawl noise does not spike.

## 2026-04-24 (creator taxonomy proposal)
- Scope: Curate a controlled Ha Nhân-related search/tag taxonomy for crawl discovery.
- Acceptance criteria: provide grouped discovery terms beyond direct channel crawling, keep the list practical for crawler queries, and flag broad/risky terms.
- Actions: Prepared a compact taxonomy recommendation centered on core Ha Nhân, character-specific, theme-specific, and format-specific phrases.
- Verification: Pending techlead review; no implementation changes made.
- Risks: Over-broad fantasy/romance terms can pull unrelated content if not kept as secondary or disabled queries.

## 2026-04-24 (creator taxonomy request)
- Scope: Ask creator to expand the Ha Nhân search/tag taxonomy.
- Acceptance criteria: include more Ha Nhân-related discovery terms (phim, Liễu Như Yên, tu tiên, xuyên không, trọng sinh variants) so the crawl can reach related content beyond direct YouTube channel crawling.
- Actions: Added a creator task and recorded the handoff.
- Verification: Pending creator review.
- Risks: Keep the taxonomy broad enough to discover related content, but not so broad that unrelated videos flood the crawl.

## 2026-04-24 (developer implementation)
- Scope: Rebuild crawl logging and keep the crawl Ha Nhân-first with a narrow fallback.
- Actions: Split crawl targets into primary Ha Nhân sources and fallback broad discovery; added per-video rejection logs for missing ID/duration, short clips, low-quality titles, missing theme keywords, and untrusted keyword-search authors; formatted thrown crawl errors so target failures no longer print `undefined`.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm run crawl` completed and printed explicit keep/reject reasons per video, plus phase gating that skipped fallback because the primary Ha Nhân batch was already large enough.
- Verification: Passed locally.
- Risks: The allowed-theme filter is still intentionally strict, so some long videos will continue to be rejected when their titles do not clearly match the curated theme list.

## 2026-04-24 (developer assignment)
- Scope: Re-open the crawl task as a developer implementation item.
- Acceptance criteria: detailed rejection logs, Ha Nhân-first crawl ordering, and fallback to broader discovery only when the batch is thin.
- Actions: Updated board + handoff log and confirmed the developer inbox entry for the crawl work.
- Verification: Pending developer implementation.
- Risks: Keep the change narrow and avoid re-expanding the crawler aggressively.

## 2026-04-24 (rollback + reassignment)
- Scope: Roll back the techlead-side crawler experiment and hand the crawl work to developer.
- Actions: Reverted `scripts/crawl.mjs` to the last stable state; prepared a fresh developer assignment focused on visible crawl failures and Ha Nhân-first small-batch behavior.
- Verification: Rollback complete; implementation now pending developer.
- Risks: The crawler still needs better diagnostics and content prioritization, but that work should be done by the developer role.

## 2026-04-24 (crawl reprioritization)
- Scope: Make crawler small-batch and Ha Nhân-first.
- Acceptance criteria: prioritize Ha Nhân-related sources first, stop early when the batch is already healthy, and only fall back to broader discovery when the Ha Nhân batch is thin.
- Actions: Split targets into priority and secondary groups, capped per-target output, and added early-stop logic once the batch reaches the desired size.
- Evidence: `node --check scripts/crawl.mjs` passed; `npm run crawl` completed without `undefined` errors and produced 7 new items on the current dataset.
- Verification: Passed locally.
- Risks: If Ha Nhân sources are sparse on a given day, the batch may still stay small; that is expected under the small-drip policy.

## 2026-04-24
- Scope: Investigate reported crawl failures and production cronjob behavior.
- Actions: Reviewed `scripts/crawl.mjs`, `src/lib/data.js`, `package.json`, `README.md`, `.github/workflows/daily-crawl.yml`, and `vercel.json`; ran `npm run crawl` locally.
- Evidence: Local crawl completed successfully and refreshed `src/lib/movies.json` with 25 new videos.
- Verification: Pending final report.
- Risks: The crawler swallows per-target search errors and still exits 0, so a broken upstream search can look like a “successful” crawl; production has no Vercel cron route/config, only a GitHub Actions daily workflow.

## 2026-04-24 (crawler hardening)
- Scope: Increase crawl yield and make failures visible.
- Acceptance criteria: each crawl run should reliably discover a much larger set of candidates (targeting 20–30+ new items when available), avoid silent all-target failure, and keep previously curated data intact.
- Actions: Expanded discovery targets with broader thematic queries, replaced binary keep/reject logic with scored candidate ranking, added per-target hit logging, and made the job fail if every target errors.
- Actions: Added structured crawl error formatting so target failures print the real thrown value instead of `undefined`.
- Evidence: Verified with `npm run crawl`; first full verification pass produced 78 new videos, and a subsequent pass after the dataset refreshed still completed successfully.
- Verification: `npm run crawl` passed after the crawler changes.
- Risks: Crawl runtime is longer because more search targets are queried sequentially; the production cron gap is still separate from crawler logic.

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

## 2026-04-22
- Scope: Fix watch-page fullscreen behavior and redesign popup interaction for better playback UX.
- Acceptance criteria: fullscreen button enters real browser/window fullscreen when available (not just in-page pseudo fullscreen); popup action is no longer abrupt and follows common streaming UX with clear display options.
- Actions: Techlead triaged request and delegated flow designer -> developer -> creator -> techlead. Designer chose a compact view-options menu pattern; developer implemented fullscreen API-first behavior and menu-based popup/miniplayer controls.
- Evidence: Updated `src/app/watch/[id]/page.js` to request native fullscreen on the player section (with pseudo-fullscreen fallback), added menu open/close behavior via outside click + Escape, and separated mini-player/system-popout actions. Updated `src/app/watch/[id]/Watch.module.css` for the new menu UI.
- Verification: Developer check complete: `npm.cmd run lint` passed; `npm.cmd run build` passed; no new compile/runtime errors observed in build output.
- Verification: Creator check complete: release-ready with graceful fallback for browsers lacking Document Picture-in-Picture support.
- Risks: Native fullscreen remains browser/gesture-policy dependent; on unsupported/blocked environments the player uses pseudo fullscreen fallback.
- Scope: Standardize team working rules so techlead remains planner/orchestrator and execution stays with designer/developer/creator.
- Acceptance criteria: publish clear SOP with role boundaries, lifecycle, handoff contract, quality gates, verification minimum, and Definition of Done; wire these rules into workplace references.
- Actions: Techlead opened governance task; creator prepared SOP pack and synced references across workplace docs/inboxes.
- Evidence: Added `.opencode/workplace/WORKING_RULES.md`; updated `.opencode/workplace/README.md` and `AGENTS.md` to enforce SOP usage; appended rollout notes in all role inbox files.
- Verification: Creator governance check complete: policy artifacts are in place and linked from canonical docs.
- Verification: Techlead review complete: role boundary is explicit (`techlead` orchestrates, execution delegated to worker roles).
- Risks: Process quality depends on continuous enforcement during future task intake/handoffs.
- Scope: Fix popup playback failure (Error 153) observed in floating window mode.
- Acceptance criteria: popup playback opens without YouTube configuration error; returning from popup restores in-page timeline/state; no regressions in lint/build.
- Actions: Switched popup implementation from Document Picture-in-Picture iframe relocation to dedicated `/watch-popout` route window with state sync.
- Evidence: Updated `src/app/watch/[id]/page.js` to open popup via `window.open`, pass `id/time/playing/quality`, and restore with `postMessage` + localStorage sync key.
- Verification: Developer check complete: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Verification: Creator check complete: popout flow is release-ready with clear fallback if popup is blocked by browser policy.
- Risks: Users with strict popup blockers may need to allow popups for full popout behavior.
- Scope: Refine popup to match Netflix/FPTPlay behavior: in-page floating popup only, draggable, and remembers last position.
- Acceptance criteria: popup no longer opens browser window; user can drag popup via toolbar; popup position is restored on next open/page reload; lint/build remain green.
- Actions: Replaced route-based browser popout behavior with in-page popup state; added drag handlers and viewport clamping; persisted coordinates to localStorage.
- Evidence: Updated `src/app/watch/[id]/page.js` with pointer drag flow (`pointermove`/`pointerup`), persisted key `hanhan:watch-popup-position`, and inline style positioning. Updated `src/app/watch/[id]/Watch.module.css` with drag cursor states.
- Verification: Developer check complete: `npm.cmd run lint` passed and `npm.cmd run build` passed after draggable popup changes.
- Risks: On browsers/users that disable localStorage, popup still works but always starts at default bottom-right position.
- Scope: Align popup with multitasking expectation: pinned always-on-top window popup and fullscreen with auto-hidden control bar.
- Acceptance criteria: popup opens in Document Picture-in-Picture pinned window (not regular browser window); returning from popup restores playback state in-page; fullscreen controls fade out after short inactivity and reappear on movement/keyboard.
- Actions: Replaced in-page popup mode with Document PiP player instantiation in the PiP window, added state sync/restore logic, and implemented idle-based control-bar auto-hide behavior for fullscreen modes.
- Evidence: Updated `src/app/watch/[id]/page.js` to spin up a second YouTube player inside `documentPictureInPicture.requestWindow`, sync time/play state, and handback to the main player. Updated `src/app/watch/[id]/Watch.module.css` with `inVideoControlsHidden` + `videoContainerUiHidden` styles for fullscreen idle UI hiding.
- Verification: Developer check complete: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Document Picture-in-Picture support is browser-dependent; fallback currently switches to mini mode when unsupported or blocked.
- Scope: Hotfix player regression where video flickers/turns black after the popup/fullscreen update.
- Acceptance criteria: main watch player initializes once per movie change (no rapid re-create loop), video renders stably, and lint/build remain green.
- Actions: Adjusted watch-player initialization effect to depend on `movie` only, removing `isReady` from dependency to stop repeated destroy/re-init cycles.
- Evidence: Updated `src/app/watch/[id]/page.js` effect dependency from `[movie, isReady]` to `[movie]`.
- Verification: Developer check complete: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Runtime validation still needed on user's browser/GPU combination to fully confirm no black-frame behavior.
- Scope: Resolve remaining user-reported playback UX defects: incorrect fullscreen scope, popup Error 153, and return-to-web time reset.
- Acceptance criteria: fullscreen is scoped to player and fills viewport (not the full page layout); pinned popup plays successfully; returning from popup resumes near prior timestamp instead of 00:00.
- Actions: Switched native fullscreen target from `document.documentElement` back to player section with dedicated native-fullscreen styling; updated Document PiP player host/vars; hardened popout restore logic to reuse last valid time when popout time is invalid.
- Evidence: Updated `src/app/watch/[id]/page.js` and `src/app/watch/[id]/Watch.module.css` (`playerSectionNativeFullscreen` + restored playback fallback logic + popout player config changes).
- Verification: Developer check complete: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Browser-provided fullscreen helper strip ("To exit full screen, press Esc") cannot be removed by app code; OS taskbar visibility is controlled by browser + OS fullscreen implementation.

## 2026-04-23
- Scope: Tighten the YouTube title-cover mask on the watch player so fullscreen no longer feels washed out at the top edge.
- Acceptance criteria: the title/logo cover still hides YouTube branding, but it no longer uses a soft gradient that darkens a larger portion of the frame; fullscreen playback should feel crisp.
- Actions: Adjusted `src/app/watch/[id]/Watch.module.css` to make the title and logo covers more compact and opaque.
- Evidence: `playerMaskTop` now uses a shorter solid overlay, and `playerMaskLogo` is smaller with a fully opaque background.
- Verification: Pending manual/runtime check and final techlead review.
- Risks: If YouTube surfaces longer branding text in some states, the smaller mask may reveal a small edge.

## 2026-04-23 (handoff)
- Scope: Send the watch title-mask refinement to developer for implementation.
- Acceptance criteria: developer updates only the mask/overlay treatment; fullscreen top edge stays crisp while branding remains covered.
- Actions: Added a precise implementation brief to `INBOX/developer.md` and recorded the handoff in `HANDOFFS.md`.
- Verification: Pending developer implementation.
- Risks: Keep the change narrow so player behavior, controls, and fullscreen logic remain untouched.

## 2026-04-23 (implementation)
- Scope: Apply the title-mask refinement after user confirmation.
- Acceptance criteria: remove the soft gradient washout, keep branding covered, and avoid touching player behavior.
- Actions: Updated `src/app/watch/[id]/Watch.module.css` so the top mask is a shorter solid overlay and the logo cover is smaller/fully opaque.
- Evidence: `playerMaskTop` now uses a 40px solid black bar; `playerMaskLogo` is a tighter opaque pill.
- Verification: `npm.cmd run build` could not complete because `next` is not installed in the current environment; prior `npm.cmd run lint` also failed for the same reason.
- Risks: The tighter cover may expose a small edge of branding if YouTube changes the overlay layout.

## 2026-04-23 (environment)
- Scope: Restore local verification capability for the watch-mask task.
- Acceptance criteria: dev environment can run `npm.cmd run lint` and `npm.cmd run build` without missing-command errors.
- Actions: Sent developer a self-setup instruction to restore missing dependencies.
- Verification: Pending developer environment repair.
- Risks: If package lock or node modules are missing/corrupted, setup may need a clean reinstall.

## 2026-04-23 (ownership)
- Scope: Hand watch-mask work back to developer for execution after environment repair.
- Acceptance criteria: developer owns the fix, verifies locally, and returns with evidence.
- Actions: Updated handoff log to mark active developer ownership.
- Verification: Pending developer action.
- Risks: None beyond the existing dependency/setup blocker.

## 2026-04-23 (docs)
- Scope: Make the developer workflow clearer for Next.js work.
- Acceptance criteria: developer guidance explicitly says to restore dependencies first, respect App Router boundaries, and verify with lint/build.
- Actions: Added a Next.js workflow reminder to `INBOX/developer.md`.
- Verification: Documentation updated; no app code changed in this pass.
- Risks: None.

## 2026-04-23 (feature intake)
- Scope: Add double-click seek controls to the watch player overlay.
- Acceptance criteria: single click/tap still toggles play/pause; left-half double click seeks backward ~10-15 seconds; right-half double click seeks forward ~10-15 seconds; mobile/fullscreen remain stable.
- Actions: Logged a new developer handoff for the interaction change.
- Verification: Pending developer implementation and runtime check.
- Risks: Need to avoid accidental single-click pause when the user intends to double-click seek.

## 2026-04-23 (verification restore)
- Scope: Restore local dev/verification setup for the watch-mask task.
- Acceptance criteria: `npm.cmd run lint` and `npm.cmd run build` execute successfully in the repo environment.
- Actions: Ran `npm.cmd install` to restore missing local dependencies and recreate `node_modules`.
- Evidence: `next` and `eslint` were unavailable before install because local dependencies were missing; install completed successfully.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: `npm install` reported 4 high severity vulnerabilities in transitive deps; not addressed because the request was to restore verification only.

## 2026-04-23 (watch mask implementation)
- Scope: Tighten the watch-page title mask so fullscreen video stays crisp while YouTube branding remains covered.
- Acceptance criteria: remove the soft gradient washout, preserve branding cover, and avoid layout/routing/playback changes.
- Actions: Kept the fix CSS-only in `src/app/watch/[id]/Watch.module.css` by shortening the top overlay and making the logo cover smaller and opaque.
- Evidence: `playerMaskTop` now uses a 40px solid overlay; `playerMaskLogo` is a compact opaque pill.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: If YouTube changes its overlay layout, the tighter mask could expose a small branding edge.

## 2026-04-23 (feature intake 2)
- Scope: Add keyboard arrow controls to the watch player.
- Acceptance criteria: left/right arrows seek backward/forward ~15 seconds; up/down arrows decrease/increase volume by a small step; shortcuts should not interfere with text inputs or fullscreen playback.
- Actions: Logged a new developer handoff for the keyboard shortcut change.
- Verification: Pending developer implementation and runtime check.
- Risks: Browser key handling may vary if focus is inside interactive controls.

## 2026-04-23 (double-click seek implementation)
- Scope: Add left/right double-click seek zones on the watch overlay while preserving single-click/tap play-pause behavior.
- Acceptance criteria: single click/tap still toggles play/pause; double-click on the left half rewinds ~12s; double-click on the right half fast-forwards ~12s; mobile/fullscreen controls stay stable.
- Actions: Updated the watch overlay button in `src/app/watch/[id]/page.js` to delay mouse single-click toggles briefly, cancel them on double-click, and seek based on click position; added a tiny `touch-action` CSS tweak in `Watch.module.css`.
- Evidence: Mouse double-clicks now resolve through `onDoubleClick` with left/right half detection; touch/pen taps toggle immediately via pointer-up handling.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: The single-click action is delayed briefly on mouse to disambiguate double-clicks; browser touch/click synthesis can vary slightly by device.

## 2026-04-23 (keyboard controls implementation)
- Scope: Add arrow-key shortcuts to the watch player without disrupting existing click, double-click, fullscreen, mobile, or overlay controls.
- Acceptance criteria: left/right arrows seek ~15 seconds; up/down arrows adjust volume in small steps; shortcuts are ignored inside inputs/selects/textareas/other interactive controls; lint/build remain green.
- Actions: Added a guarded window `keydown` handler in `src/app/watch/[id]/page.js` with 15s seek and 5-point volume steps, plus shared clamping helpers for seek/volume updates.
- Evidence: Arrow shortcuts now call the active YouTube player directly and keep fullscreen control auto-hide behavior intact; interactive descendants are excluded via a target-guard helper.
- Verification: `npm.cmd run lint` passed; `npm.cmd run build` passed.
- Risks: Browser-level focus handling can still vary slightly around embedded controls, but the target guard prevents hijacking standard form/interactive elements.
## 2026-04-26 (strict performance rerun)
- Scope: Re-test the UI under a stricter threshold where >1000ms is considered a warning, and separate watch route navigation from actual video readiness.
- Actions: Re-ran the browser performance sweep on desktop and mobile, measured fresh-load timings for home/category/search/watch, rechecked home route transitions, and attempted to measure watch video readiness with a stable autoplay-first-frame signal.
- Verification: Desktop loads came back as home `2676ms` (warn), category `896ms`, search `149ms`, watch `986ms`; mobile loads were home `1357ms` (warn), category `1009ms` (warn), search `157ms`, watch `971ms`; home transitions were category `1145ms` (warn), search `99ms`, watch `1011ms` (warn); a direct autoplay-first-frame metric could not be measured reliably, so the closest proxy was watch route settle `6215ms` with controls usable `+26ms` later and click-to-first-playback-progress proxy `403ms`.
- Risks: Home load is the biggest regression under the stricter rule; `/category/ha-nhan` still overflows horizontally on mobile (`scrollWidth=424` at `390px`); watch readiness still needs a better instrumented signal than the current proxy.
