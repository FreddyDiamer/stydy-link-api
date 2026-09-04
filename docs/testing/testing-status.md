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

## E2E (13 tests, real Postgres)

`pnpm run test:e2e` boots the whole app through `AppModule` with the same pipeline as
`main.ts` (global `/api` prefix, `ValidationPipe` with whitelist + forbidNonWhitelisted,
`GlobalExceptionFilter`) and drives it over HTTP with supertest against a real database.

- `test/marketplace.e2e-spec.ts` — the loop end to end: request → response → accept →
  deal → both sides confirm → one review from each. Also that a closed request drops out
  of the feed but stays with its author, and that a second review from the same author is
  refused by the schema's composite unique key.
- `test/pipeline.e2e-spec.ts` — the parts unit tests cannot see: the global guard (401
  without a token, 401 for a token whose user was deleted), the success envelope the
  frontend's `apiClient` unwraps, `forbidNonWhitelisted` rejecting extra fields (this is
  what keeps the frontend from sending `authorId` to `/reviews` again), `ParseUUIDPipe`,
  and error mapping to 403/404 with a body.

**Setup.** E2E needs its own database — the suite truncates every table before each test,
so never point it at a working database.

```bash
createdb studylink_test                 # or use the postgres service from docker-compose
export DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/studylink_test"
pnpm run test:e2e:setup                 # applies migrations to the test database
pnpm run test:e2e
```

`test/env.ts` defaults `DATABASE_URL_TEST` to `postgresql://postgres:postgres@localhost:5432/studylink_test`
and forces `NODE_ENV=test`; it also clears `TELEGRAM_BOT_TOKEN`, so notifications go nowhere.

## Not covered yet

- Parser, notifications delivery and the education module have no tests.
- Deal cancellation, reopen and the auto-confirm sweep are covered by unit tests only —
  no e2e walks those over HTTP yet.
- Response shapes are inconsistent and e2e records that as fact rather than fixing it:
  `GET /marketplace/requests` returns an array, `GET /marketplace/requests/my` returns
  `{ items, total }`. The frontend normalizes both.
- The frontend has its own suite (vitest) — see the `study-link` repository.

## Conventions for future tests

When adding the first tests, follow these so the suite stays coherent:

- **Unit tests** live next to the code: `src/modules/reviews/reviews.service.spec.ts`. Test services, not controllers; mock `DatabaseService` and `NotificationService` via Nest's `Test.createTestingModule` with provider overrides.
- **E2E tests** go under `test/` (the `test:e2e` script expects `test/jest-e2e.json`) and use supertest against a compiled app instance.
- Never run tests against a real/shared database — use a dedicated local test database or mock the Prisma layer.
- Do not assert on user-facing Russian message strings — assert on status codes, error codes (`NOT_FOUND`, `FORBIDDEN`), and data shapes, so texts can change freely.
- Start with the highest-value target: the marketplace invariants (response acceptance creates a deal, ownership checks, status transitions) in `src/modules/marketplace/`.
