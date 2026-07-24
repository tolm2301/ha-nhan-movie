---
name: project-architecture
description: Project architecture guidance for hanhan-movie. Use when analyzing, designing, or implementing changes in this Next.js movie product.
---

# Project Architecture Skill — hanhan-movie

Use this skill when analyzing, designing, or implementing changes in `hanhan-movie`.

## Project stack
- Language: `JavaScript`
- Framework: `Next.js`
- Domain: `Movie Streaming Product`
- Build command: `npm run build`
- Test command: `npm run lint`

## Architecture principles
1. Follow the existing project structure before introducing new packages or patterns.
2. Keep business logic in the appropriate domain/application/service layer.
3. Keep transport/API concerns in controllers/routes/handlers.
4. Keep persistence and external integrations in infrastructure/adapters/repositories.
5. Keep mapping logic in mappers/serializers/converters when such structure exists.
6. Reuse existing validation, response, error handling, and utility conventions.
7. Avoid broad refactors unless required by the task.
8. Prefer small, reviewable changes.
9. Do not expose internal persistence models through API contracts unless this is already the project convention.
10. Do not add dependencies without explicit justification.

## Investigation checklist
- Find similar existing feature or endpoint.
- Identify naming conventions.
- Identify response/error patterns.
- Identify test style and fixture patterns.
- Identify configuration and environment assumptions.
- Identify build and test commands.

## Implementation checklist
- Scope matches handoff.
- Code follows existing architecture.
- No unrelated formatting/refactor.
- Shared logic is placed in the correct reusable layer.
- Build/test verification is performed or blocker documented.
- Handoff includes changed files and evidence.