# Testing Status

What exists today, and the conventions to follow once tests are introduced.

## Current state

- **34 unit tests over the marketplace invariants**, all green (`pnpm test`):
  - `marketplace/deals/deals.service.spec.ts` — two-sided confirmation, auto-confirm
    window (including "never before the deal's own deadline"), reopen, cancellation record.
  - `marketplace/requests/requests.service.spec.ts` — feed shows only OPEN by default,
    close rejects pending responses, reopen is a new publication.
  - `marketplace/request-responses/request-responses.service.spec.ts` — accepting a
    response matches the request, closes the others and creates the deal at the right price.
  - `reviews/reviews.service.spec.ts` — target and role derived server-side, one review
    per author per deal, reputation split by role.
- Shared mocks live in `common/testing/mocks.ts`: `createDatabaseMock()` (every Prisma
  model plus a transparent `$transaction`) and `createNotificationMock()`. The notification
  mock is an explicit object, not a Proxy — a Proxy answers `then` with a function and Nest
  then treats the provider as a promise and hangs on `compile()`.
- Jest maps the `@common` alias via `moduleNameMapper` in `package.json`.
- Tooling: Jest + ts-jest (`rootDir: src`, `testRegex: .*\.spec\.ts$`), supertest available
  for HTTP-level tests, scripts `test`, `test:watch`, `test:cov`, `test:e2e`.
- Verification of a change still also means `pnpm run lint:check` and `pnpm run build`, plus
  exercising affected endpoints against a local dev server (`/auth/dev/login` gives a token
  without Telegram).

## Not covered yet

- No e2e tests: nothing runs against a real HTTP layer or database.
- Parser, notifications delivery and the education module have no tests.
- The frontend has its own suite (vitest) — see the `study-link` repository.

## Conventions for future tests

When adding the first tests, follow these so the suite stays coherent:

- **Unit tests** live next to the code: `src/modules/reviews/reviews.service.spec.ts`. Test services, not controllers; mock `DatabaseService` and `NotificationService` via Nest's `Test.createTestingModule` with provider overrides.
- **E2E tests** go under `test/` (the `test:e2e` script expects `test/jest-e2e.json`) and use supertest against a compiled app instance.
- Never run tests against a real/shared database — use a dedicated local test database or mock the Prisma layer.
- Do not assert on user-facing Russian message strings — assert on status codes, error codes (`NOT_FOUND`, `FORBIDDEN`), and data shapes, so texts can change freely.
- Start with the highest-value target: the marketplace invariants (response acceptance creates a deal, ownership checks, status transitions) in `src/modules/marketplace/`.
