---
description: Run end-to-end feature delivery with workplace tracking
agent: techlead
---
Run this delivery workflow for: `$ARGUMENTS`

1. Planning
- Clarify scope, constraints, and acceptance criteria.
- Update `.opencode/workplace/BOARD.md` with owner and status.

2. Design gate (`designer`)
- Define UI structure, responsive behavior, and interaction expectations.
- Record decisions in `.opencode/workplace/PROGRESS.md`.

3. Build gate (`developer`)
- Implement the feature with clean App Router boundaries.
- Perform self-verification and record evidence.

4. Readiness gate (`creator`)
- Validate metadata/assets/docs/process quality.
- Add any automation or delivery notes.

5. Final review (`techlead`)
- Validate scope completion, quality gates, and residual risks.
- Add final handoff entry in `.opencode/workplace/HANDOFFS.md`.

Output format:
- Scope
- Acceptance criteria
- Files changed
- Verification status
- Risks and next actions
