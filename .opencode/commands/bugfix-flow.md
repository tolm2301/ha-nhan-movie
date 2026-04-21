---
description: Run triage, fix, and verification workflow for a bug
agent: techlead
---
Run this bugfix workflow for: `$ARGUMENTS`

1. Capture
- Record expected vs actual behavior and reproduction steps.
- Update task in `.opencode/workplace/BOARD.md`.

2. Triage (`techlead`)
- Identify likely root cause and smallest safe change.
- Write fix assignment in `.opencode/workplace/INBOX/developer.md`.

3. Fix (`developer`)
- Implement targeted fix and keep scope tight.
- Run self-verification and check regressions.

4. Quality checks (`designer` and `creator` when relevant)
- Designer checks UI impact for visual regressions.
- Creator checks production-readiness impact.

5. Close (`techlead`)
- Confirm evidence is present in `.opencode/workplace/PROGRESS.md`.
- Add closure note in `.opencode/workplace/HANDOFFS.md`.

Rule: there is no separate tester role; developer owns verification.
