# Hanhan Movie

## Mission
Build and maintain a modern Next.js movie product with deliberate UI quality, clean architecture, and predictable delivery.

## Tech and Coding Rules
- Use Next.js App Router with modern JavaScript.
- Prefer Vanilla CSS, CSS Modules, and CSS variables over new styling frameworks.
- Keep React components small and split server/client boundaries intentionally.
- Favor clean, functional code and async/await.
- Prefer explicit, readable code over clever abstractions.

## Team Model
- `techlead`: fixed primary orchestrator, plans work, delegates execution, and owns final delivery quality.
- `designer`: owns UI direction, UX flow, and visual consistency.
- `creator`: owns production readiness, automation, and delivery ergonomics.
- `developer`: owns implementation, bug fixes, and self-verification.

There is no separate tester role. Verification is owned by `developer` and reviewed by `techlead`.

## Primary Orchestration Policy
- `techlead` is the fixed primary role for this repository.
- All multi-step feature and bug requests must be triaged by `techlead` before role assignment.
- `designer`, `developer`, and `creator` operate as execution roles through workplace handoffs.
- Only `techlead` can mark a task Done on the board after verification evidence is explicit.

## Working Agreements
- Start substantial work with a short plan and explicit acceptance criteria.
- For feature and bug workflows, track progress in workplace files under `.opencode/workplace/`.
- Every handoff must include scope, changed files, verification status, risks, and next owner.
- Before final handoff, confirm: behavior works, no obvious regressions, and output matches request.
- Enforce standardized execution rules in `.opencode/workplace/WORKING_RULES.md`.
- `techlead` owns orchestration/closeout; execution is delegated to `designer`/`developer`/`creator`.

## Quality Gates
- `designer` gate: UX clarity, responsive behavior, visual hierarchy, interaction polish.
- `developer` gate: correctness, boundary handling, self-check, no hydration/runtime issues.
- `creator` gate: metadata, asset handling, docs/readme updates, workflow efficiency.
- `techlead` gate: architecture fit, consistency with repo conventions, release readiness.

## OpenCode Layout
- `.opencode/agents/` contains specialized agent prompts.
- `.opencode/commands/` contains reusable slash-command workflows.
- `.opencode/skills/` contains skill definitions loaded via the skill tool.
- `.opencode/workplace/` contains team-operating artifacts for task tracking and handoffs.

## Workplace Files
- `.opencode/workplace/BOARD.md`: source of truth for task status and owner.
- `.opencode/workplace/HANDOFFS.md`: inter-role handoff log.
- `.opencode/workplace/PROGRESS.md`: timeline of implementation and verification evidence.
- `.opencode/workplace/INBOX/*.md`: role-based queue for incoming tasks.

Lifecycle: intake -> assign -> execute -> verify -> close.

## Preferred Commands
- `/delivery-flow <task>`: run full feature delivery workflow.
- `/bugfix-flow <bug>`: run triage -> fix -> verify workflow.
- `/review-flow <scope>`: run structured quality review.
- `/teamwork <task>`: orchestrate multi-role execution and workplace updates.
- `/daily-meeting`: produce concise daily status report from workplace files.
