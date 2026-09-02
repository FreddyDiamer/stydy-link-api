# Testing Status

What exists today, and the conventions the suite follows.

## Current state

- **6 unit suites, 87 tests**, all passing (`pnpm test`). They cover the security-critical and marketplace-invariant paths:

  | Suite                                                 | What it pins down                                                                                      |
  | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
  | `src/modules/auth/auth.service.spec.ts`               | `initData` signature, 24h `auth_date` window, fail-closed without a bot token, dev-login gated to dev  |
  | `src/modules/marketplace/deals/deals.service.spec.ts` | Participant-only creation/read/transitions, response-pair matching, two-sided confirmation, auto-close |
  | `src/modules/reviews/reviews.service.spec.ts`         | Completed-deal-only reviews, server-derived target/role, one review per author, reply permissions      |
  | `src/modules/marketplace/request-responses/…spec.ts`  | Ownership on create/update/delete, accept creates the deal, price fallback to the request budget       |
  | `src/modules/marketplace/service-responses/…spec.ts`  | Own-service and duplicate guards, accept/reject restricted to the service owner, status not client-set |
  | `src/modules/users/users.service.spec.ts`             | Public projections hide `telegramId`/`balance`/notification settings; balance only in your own stats   |

- Tooling: Jest + ts-jest (config in `package.json`: `rootDir: src`, `testRegex: .*\.spec\.ts$`, `moduleNameMapper` for the `@common`/`@database`/`@modules` aliases). Scripts: `test`, `test:watch`, `test:cov`, `test:e2e`.
- **No database is required** — every suite mocks the Prisma layer, so `pnpm test` runs anywhere.
- Not covered yet: `services`/`requests` listing services, education, parser, notifications, and any HTTP-level (e2e) tests. Verify changes there by lint, build, and exercising the endpoints.

## Conventions

- **Unit tests** live next to the code: `src/modules/reviews/reviews.service.spec.ts`. Test services, not controllers; mock `DatabaseService` and `NotificationService` via Nest's `Test.createTestingModule` with provider overrides.
- **Shared mocks** live in `src/test-support/mocks.ts`: `createPrismaMock()` (a jest-mocked model per Prisma table plus a pass-through `$transaction`), `createNotificationMock()`, and `expectBusinessError()`. That folder is excluded from the production build (`tsconfig.build.json`).
- **E2E tests** go under `test/` (the `test:e2e` script expects `test/jest-e2e.json`) and use supertest against a compiled app instance.
- Never run tests against a real/shared database — use a dedicated local test database or mock the Prisma layer.
- Do not assert on user-facing Russian message strings — assert on status codes, error codes (`NOT_FOUND`, `FORBIDDEN`), and data shapes, so texts can change freely. `expectBusinessError(fn, { code, status })` does exactly this.
- Jest's matchers are typed as `any`, so `eslint.config.mjs` turns the `no-unsafe-*` rules off for `**/*.spec.ts` — no `eslint-disable` comments needed in tests.
