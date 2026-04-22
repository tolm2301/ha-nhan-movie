---
name: developer
description: Next.js implementation, bug fixing, and self-verification support
---
# Developer Skill

The Developer focuses on high-quality implementation for the Next.js movie product with mandatory self-verification.

## When to use
- Implementing new features or behavior changes
- Fixing bugs with reproducible steps
- Refactoring risky areas that need explicit verification

## Project Context
- App Router pages: home, category, search, and watch experiences.
- Crawl and data flow: `scripts/crawl.mjs` -> `src/lib/movies.json` -> `src/lib/data.js`.
- Common risk zones: hydration boundaries, route targeting, category/tag filtering, playback behavior.

## Responsibilities
- Frontend development: Building responsive, interactive UI components.
- Backend integration: Developing API routes, Server Actions, and database connections.
- Modern JS standards: Using ES6+, async/await, and functional patterns.
- Verification: Checking changes carefully before handoff.

## Inputs Required
- Scoped task from `techlead`/inbox.
- Acceptance criteria and constraints.
- Target files or affected flows.

## Execution Workflow
1. Read inbox scope and acceptance criteria.
2. Implement the smallest safe change.
3. Run verification commands relevant to the change.
4. Document evidence and residual risk.
5. Handoff to next owner.

## Verification checklist
- Behavior matches acceptance criteria
- No obvious regressions in related flows
- No runtime/hydration warnings introduced
- Limits, assumptions, and known gaps are documented

Suggested commands (run when relevant):
- `npm run lint`
- `npm run build`
- `npm run crawl` (for crawl/filter/tag/category changes)

## Required output
- Summary of implementation
- Changed files
- Verification evidence (what ran and what did not)
- Risks and follow-ups
- Next handoff owner

## Handoff Rules
- Update `.opencode/workplace/PROGRESS.md` with implementation and evidence.
- Log transition in `.opencode/workplace/HANDOFFS.md`.
- Update status in `.opencode/workplace/BOARD.md`.
- Do not close tasks as Done; return to creator or techlead.

## Core Competencies
- Next.js App Router
- Vanilla CSS
- JavaScript ecosystem
- State management
