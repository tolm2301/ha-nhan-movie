---
description: Run structured quality review across team gates
agent: techlead
---
Run this review workflow for: `$ARGUMENTS`

1. Developer self-review
- Correctness, boundary cases, runtime warnings, hydration safety.
- Explicit verification notes with what was checked.

2. Designer review
- UI hierarchy, responsiveness, interaction polish, and visual consistency.

3. Tech Lead review
- Architecture fit, maintainability, and scope alignment.

4. Creator review
- Production readiness, metadata/assets handling, workflow quality.

Summarize findings and required fixes in:
- `.opencode/workplace/PROGRESS.md`
- `.opencode/workplace/HANDOFFS.md`

Output format:
- Passed checks
- Issues by severity (high/medium/low)
- Required fixes and owners
- Release readiness: ready / needs fixes
