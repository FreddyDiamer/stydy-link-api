# Testing Status

What exists today, and the conventions to follow once tests are introduced.

## Current state

- **Zero test files.** No `*.spec.ts` under `src/`, no `test/` directory contents in use.
- Tooling is configured and working: Jest + ts-jest (config in `package.json`: `rootDir: src`, `testRegex: .*\.spec\.ts$`), supertest for HTTP-level tests, scripts `test`, `test:watch`, `test:cov`, `test:e2e`.
- Until tests exist, verification of a change means: `pnpm run lint:check`, `pnpm run build`, and manually exercising the affected endpoints against a local dev server (use `/auth/dev/login` to get a token without Telegram).

## Conventions for future tests

When adding the first tests, follow these so the suite stays coherent:

- **Unit tests** live next to the code: `src/modules/reviews/reviews.service.spec.ts`. Test services, not controllers; mock `DatabaseService` and `NotificationService` via Nest's `Test.createTestingModule` with provider overrides.
- **E2E tests** go under `test/` (the `test:e2e` script expects `test/jest-e2e.json`) and use supertest against a compiled app instance.
- Never run tests against a real/shared database — use a dedicated local test database or mock the Prisma layer.
- Do not assert on user-facing Russian message strings — assert on status codes, error codes (`NOT_FOUND`, `FORBIDDEN`), and data shapes, so texts can change freely.
- Start with the highest-value target: the marketplace invariants (response acceptance creates a deal, ownership checks, status transitions) in `src/modules/marketplace/`.
