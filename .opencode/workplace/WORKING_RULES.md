# Team Working Rules (Hanhan Movie)

Effective date: 2026-04-22

## 1) Role boundaries
- `techlead`: intake, scope, acceptance criteria, owner assignment, final closeout only.
- `designer`: UX/UI decisions and visual quality gate.
- `developer`: implementation + explicit self-verification (lint/build/runtime or stated limit).
- `creator`: production-readiness checks (docs/metadata/workflow/release notes).

Rule: `techlead` does not directly implement product features unless explicitly approved by user due to emergency.

## 2) Task lifecycle (mandatory)
1. Intake (`techlead`)
2. Assign (`techlead` -> execution role)
3. Execute (assigned role)
4. Verify (`developer`, then `creator` when relevant)
5. Close (`techlead` only)

## 3) Ownership policy
- Exactly one active in-progress owner per task.
- Owner changes must be logged in `HANDOFFS.md`.
- `BOARD.md` owner must match current executing role.

## 4) Acceptance criteria format
Every new task must include:
- Scope (what is included / excluded)
- User-visible outcome
- Verification checklist
- Risks / fallback notes

## 5) Handoff contract (required fields)
Each handoff entry must include:
- Scope summary
- Changed files
- Verification state
- Risks
- Next owner

## 6) Quality gates
- Designer gate: clarity, responsive behavior, hierarchy, interaction polish.
- Developer gate: correctness, server/client boundary safety, lint/build/runtime evidence.
- Creator gate: docs/metadata/release readiness and operational clarity.
- Techlead gate: architecture fit, consistency, residual risk acceptance.

## 7) Verification minimum
- Required for implementation tasks: `npm.cmd run lint` and `npm.cmd run build`.
- If command cannot run: state exact blocker and impact.
- Runtime/manual checks must list what was checked and what was not checked.

## 8) Definition of Done
A task is Done only when:
- Acceptance criteria are met.
- Required quality gates are acknowledged.
- Risks and follow-ups are documented.
- `techlead` confirms closeout and updates `BOARD.md`.

## 9) Priority and SLA guidance
- High: start same day.
- Medium: start within next working block.
- Low: queue in backlog with rationale.

## 10) Canonical workplace files
- `BOARD.md`: task status + current owner.
- `HANDOFFS.md`: transitions and responsibility trace.
- `PROGRESS.md`: timeline and evidence.
- `INBOX/*.md`: role queue.
