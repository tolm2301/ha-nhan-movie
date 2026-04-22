# Workplace

This folder is the operating layer for team collaboration.

Core files:
- `BOARD.md`: source of truth for task status and owner.
- `HANDOFFS.md`: role-to-role handoff records.
- `PROGRESS.md`: implementation timeline and verification evidence.
- `INBOX/*.md`: per-role input queue.
- `DAILY_REPORTS/`: generated daily snapshots.
- `WORKING_RULES.md`: standardized SOP, role boundaries, DoD, and quality gates.

Rules:
- Keep task status current.
- Record every handoff.
- Verification evidence is required before completion.
- Keep one active in-progress owner at a time.
- Only `techlead` can move tasks to Done after reviewing verification evidence.
- Follow `WORKING_RULES.md` for handoff contract, verification minimum, and DoD.

Lifecycle:
- intake -> assign -> execute -> verify -> close
