# Working Agreement — hanhan-movie

## Project context
- Project: `hanhan-movie`
- Language: `JavaScript`
- Framework: `Next.js`
- Domain: `Movie Streaming Product`
- Build command: `npm run build`
- Test command: `npm run lint`

## Official communication channels
All team coordination must use these files:

- `.opencode/workplace/BOARD.md` — task status and ownership
- `.opencode/workplace/HANDOFFS.md` — role-to-role handoffs
- `.opencode/workplace/PROGRESS.md` — progress log and evidence
- `.opencode/workplace/INBOX/*.md` — assignments per role

## Global rules
1. No commits, pushes, branch changes, or destructive commands unless explicitly requested by the user.
2. No destructive filesystem, database, git, or deployment operation without explicit approval.
3. PM orchestrates only and does not implement code.
4. Analyzer is read-only.
5. TechLead designs, delegates, and reviews; no coding by default.
6. Developer implements from handoff and keeps changes narrow.
7. Tester verifies with evidence and does not modify source code.
8. Every done claim must include evidence.
9. If verification cannot be run, state the blocker and what remains unverified.
10. Do not invent APIs, file names, test results, database rows, or business rules.
11. Prefer existing project architecture, naming, utilities, mappers, services, and test patterns.
12. Keep temporary artifacts out of project root unless explicitly required.

## Evidence requirements
Every handoff must include at least one applicable evidence type:

- Changed file paths.
- Build/test command and output summary.
- API request/response sample.
- Logs or stack trace excerpts.
- Read-only DB query result.
- Screenshot or generated artifact path.
- Manual inspection notes with file path references.

## Default verification commands
- Build: `npm run build`
- Tests: `npm run lint`

## Status values
Use these status values in board and progress updates:

- `todo`
- `in_progress`
- `blocked`
- `ready_for_review`
- `ready_for_test`
- `testing`
- `done`
- `wont_do`

## Handoff minimum fields
```md
- Task ID:
- From:
- To:
- Objective:
- Scope:
- Files / Areas:
- Acceptance Criteria:
- Verification Performed:
- Evidence:
- Risks / Blockers:
- Next Action:
```