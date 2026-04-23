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
