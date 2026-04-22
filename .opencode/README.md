# OpenCode Project Config

This directory follows OpenCode project conventions.

## Structure
- `agents/`: Custom agent definitions used by the project.
- `commands/`: Reusable slash commands.
- `skills/`: Reusable skills discoverable via the `skill` tool.
- `workplace/`: Team operating artifacts (board, handoffs, progress, inbox, daily reports).

## Team Model
- `techlead`
- `designer`
- `creator`
- `developer`

Note: There is no separate tester role. Verification is part of developer workflows.

## Orchestration
- `techlead` is the fixed primary role for all multi-step execution.
- All feature, bugfix, and review requests follow: intake -> assign -> execute -> verify -> close.
- Worker roles (`designer`, `developer`, `creator`) execute scoped handoffs and return explicit evidence.
- Only `techlead` can close tasks as Done in `.opencode/workplace/BOARD.md`.
- Standard operating rules are defined in `.opencode/workplace/WORKING_RULES.md`.

## Core Commands
- `/delivery-flow <task>`
- `/bugfix-flow <bug>`
- `/review-flow <scope>`
- `/teamwork <task>`
- `/daily-meeting`
