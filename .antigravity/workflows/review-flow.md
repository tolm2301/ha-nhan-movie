# Code & Design Review Workflow

This workflow ensures all code and designs meet the project's high standards for aesthetics, performance, and maintainability.

## Process Flow

1. **Self-Review (Developer/Designer)**
    - Designer ensures UI matches the required "Premium Aesthetics".
    - Developer ensures the Next.js API routes are secure and client components are minimal.
    - Check for console errors or hydration mismatches.

2. **Aesthetic & UX Review (Designer)**
    - Designer reviews the implemented UI versus the mockups.
    - Focus on micro-animations, responsive design, and layout shifts.
    - Any discrepancies are logged as bugs for the Developer.

3. **Technical Code Review (Tech Lead)**
    - Verify modern JS practices (ES6+, hooks, async/await).
    - Ensure styling follows Vanilla CSS standards without messy inline styles.
    - Review component chunking (Client vs Server components) to optimize load time.

4. **Productivity/Production Review (Creator)**
    - Verifies meta tags, open graph elements, and SEO metadata.
    - Ensures assets (images, fonts) are optimized for production.

5. **Final Approval**
    - Code is merged and recorded in `walkthrough.md`.
