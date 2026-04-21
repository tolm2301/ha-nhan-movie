---
description: Orchestrate multi-role execution and update workplace artifacts
agent: techlead
---
Execute coordinated teamwork for: `$ARGUMENTS`

Flow:
1. Analyze task scope and define acceptance criteria.
2. Assign role sequence (designer -> developer -> creator -> techlead review).
3. For each handoff:
- update `.opencode/workplace/INBOX/<role>.md`
- add entry to `.opencode/workplace/HANDOFFS.md`
- update status in `.opencode/workplace/BOARD.md`
4. Maintain timeline evidence in `.opencode/workplace/PROGRESS.md`.
5. Close with final summary, verification state, and open risks.

Rules:
- Keep one active in-progress owner at a time.
- No separate tester role; developer owns verification.
- Do not close task without verification evidence.
