# Delivery Workflow

This workflow defines the standard process for delivering new features or change requests for our Next.js application.

## Process Flow

1. **Design & Planning Phase (Designer & Tech Lead)**
    - Designer drafts visual concepts, UX flows, and UI mockups.
    - Tech Lead reviews the design for technical feasibility.
    - Tech Lead creates `implementation_plan.md` to define Server Components, Client Components, API routes, and database schemas.

2. **Creation & Productivity Polish (Creator)**
    - Creator identifies workflows that can be automated or optimized for better production value.
    - Plans asset structures, mock data structures, or content pipelines needed for the feature.

3. **Implementation Phase (Developer)**
    - Implement features according to `implementation_plan.md` and Designer's specs.
    - Write clean, modern JavaScript.
    - Ensure styling follows the agreed-upon Vanilla CSS / Design system.

4. **Testing Phase (Tester)**
    - Verify UI functionality across target environments.
    - Audit performance (Lighthouse) and accessibility.
    - Report bugs via `task.md`.

5. **Review & Handoff (Tech Lead + User)**
    - Tech Lead conducts final code review.
    - Finalize the task in `walkthrough.md`.
    - Request user approval.
