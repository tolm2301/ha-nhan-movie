# Bugfix Workflow

This workflow dictates how the team identifies, tracks, and resolves bugs in the Next.js application.

## Process Flow

1. **Bug Identification (Tester / User)**
    - Identify the bug from testing or user reports.
    - Create a detailed issue in `task.md` including:
        - Expected Behavior vs Actual Behavior.
        - Steps to reproduce.
        - Browser/Environment details (Client vs Server component).

2. **Analysis & Triage (Tech Lead)**
    - Analyze the bug to determine root cause.
    - If it's a UI/Styling bug, assign to Designer/Developer.
    - If it's a data logic or API bug, assign to Developer.

3. **Fix Implementation (Developer)**
    - Trace the issue through server actions, API routes, or React state.
    - Implement the fix while maintaining design principles.
    - Add console logging temporarily if needed for debugging.

4. **Verification (Tester)**
    - Verify the fix in the local environment (`npm run dev`).
    - Ensure no regressions were introduced.

5. **Review & Merge (Tech Lead)**
    - Close the bug in `task.md` and document in `walkthrough.md`.
