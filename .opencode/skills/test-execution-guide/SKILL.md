---
name: test-execution-guide
description: Test execution and verification guide for hanhan-movie. Use when verifying changes or defining test cases.
---

# Test Execution Guide — hanhan-movie

Use this skill when verifying changes in `hanhan-movie`.

## Default commands
- Build: `npm run build`
- Test: `npm run lint`

## Testing principles
1. Test against acceptance criteria, not assumptions.
2. Capture evidence for every pass/fail claim.
3. Prefer repeatable command/API/test-case evidence.
4. Separate functional failures from environment blockers.
5. Use read-only database queries only when database validation is required.
6. Do not modify application source code as Tester.
7. Do not run destructive commands without explicit approval.

## Test planning checklist
- What changed?
- What user/business behavior is affected?
- What APIs, UI flows, jobs, or integrations are involved?
- What data setup is required?
- What negative cases or boundaries matter?
- What regression risk exists?

## Evidence checklist
Include applicable evidence:

- Command run and output summary.
- API endpoint, request payload, and response body/status.
- Screenshot path or artifact path.
- Logs proving behavior.
- Read-only DB query and result.
- Test case table with pass/fail status.

## Result format
```md
## Test Result — <Task ID>
- Environment:
- Scope Tested:
- Commands Run:
- Test Cases:
- Pass:
- Fail:
- Blocked:
- Evidence:
- Risks / Unverified:
- Final Status:
```