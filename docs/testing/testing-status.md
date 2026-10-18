# Testing Status

What the suite covers today, and the conventions it follows.

## Unit tests (185, no database needed)

`pnpm test` — every suite mocks the Prisma layer, so it runs anywhere.

| Suite                                            | What it pins down                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/guards/dev-only.guard.spec.ts`           | Dev-only endpoints pass only in `development`; `production`, `test` and unset get 403                                                                                                                                                                                |
| `auth/dev-auth.controller.spec.ts`               | `DevOnlyGuard` is applied to the whole dev-auth controller, not per method                                                                                                                                                                                           |
| `common/guards/admin.guard.spec.ts`              | Only `ADMIN_TELEGRAM_IDS` pass; an empty list locks everyone out (403)                                                                                                                                                                                               |
| `common/filters/global-exception.filter.spec.ts` | Prisma `P2002` → 409, `P2025` → 404, other Prisma errors stay 500, business errors keep code and status                                                                                                                                                              |
| `parser/parser.controller.spec.ts`               | `AdminGuard` is applied to the whole parser controller                                                                                                                                                                                                               |
| `parser/workers/utils/subject-name.spec.ts`      | Subject names from kai.ru are trimmed and inner whitespace collapsed                                                                                                                                                                                                 |
| `notifications/telegram-bot.service.spec.ts`     | Buttons go out as `web_app`; `/start` greets by (HTML-escaped) name with an open-app button; other messages get a hint; webhook secret check; webhook registered on the app domain only when the secret is set                                                       |
| `parser/workers/utils/kai-api-client.spec.ts`    | Teacher lookup hits the staff schedule page; a 404 from kai.ru is an error, not an empty list; schedule days are flattened                                                                                                                                           |
| `auth/auth.service.spec.ts`                      | `initData` signature, 24h `auth_date` window, fail-closed without a bot token, dev-login only in `development`, dev-login by username                                                                                                                                |
| `marketplace/deals/deals.service.spec.ts`        | Participant-only access, `role` filter, two-sided confirmation, auto-confirm sweep (never before the deal's deadline, notifies both sides), reopen, cancellation record                                                                                              |
| `marketplace/requests/requests.service.spec.ts`  | Creation validation, feed shows only OPEN by default, close rejects pending responses, reopen is a new publication, ownership on edit, `by-student` shows others only OPEN requests without responses                                                                |
| `marketplace/request-responses/…spec.ts`         | Visibility (own responses + responses to own requests, `role`, paginated shape, 403 on a foreign `:id`), ownership and duplicate guards, accepting matches the request, closes the others and creates the deal at the right price                                    |
| `marketplace/service-responses/…spec.ts`         | Visibility (own responses + responses to own services, `role`, 403 on a foreign `:id`), own-service and duplicate guards, accept/reject restricted to the service owner, accept creates the deal (response price, else service price), status is not client-writable |
| `marketplace/services/services.service.spec.ts`  | ACTIVE-only showcase, price filters, own/responded flags, tutor reputation from reviews, delete blocked by responses or deals                                                                                                                                        |
| `reviews/reviews.service.spec.ts`                | Completed-deal-only, target and role derived server-side, one review per author per deal, reply permissions, reputation split by role                                                                                                                                |
| `users/users.service.spec.ts`                    | Public projections hide `telegramId`/`balance`/notification settings; balance only in your own stats                                                                                                                                                                 |

Shared mocks live in **`src/test-support/mocks.ts`** — that directory is excluded from the production build (`tsconfig.build.json`), which is why the helpers do not sit under `src/common`:

- `createDatabaseMock()` — every Prisma model plus a transparent `$transaction` (both the callback and the array form).
- `createNotificationMock()` — an explicit object, not a Proxy: a Proxy answers `then` with a function and Nest then treats the provider as a promise and hangs on `compile()`.
- `firstCallArg<T>()` with the `ReadArg`/`WriteArg` shapes — typed access to call arguments.
- `expectBusinessError(fn, { code, status })` — asserts the error code and HTTP status instead of the Russian message.

Jest maps the `@common` / `@config` / `@database` / `@modules` aliases via `moduleNameMapper` in `package.json`.

## E2E (19 tests, real Postgres)

`pnpm run test:e2e` boots the whole app through `AppModule` with the same pipeline as `main.ts` (global `/api` prefix, `ValidationPipe` with whitelist + forbidNonWhitelisted, `GlobalExceptionFilter`) and drives it over HTTP with supertest against a real database.

- `test/marketplace.e2e-spec.ts` — both loops end to end: request → response → accept → deal → both sides confirm → one review from each; and service → booking (no price) → tutor accepts → deal at the service price → both confirm → reviews, with the deal visible to both sides in `GET /marketplace/deals`. Also that a closed request drops out of the feed but stays with its author, that a second review from the same author is refused by the schema's composite unique key, and that ownership checks (accept a booking, suspend or edit a service) answer 403, not 500.
- `test/marketplace.e2e-spec.ts` also pins response visibility: an outsider gets empty lists and 403 on a foreign response (`:id`, `:id/stats`), each side sees its responses through `role`, and an unknown `role` is a 400.
- `test/pipeline.e2e-spec.ts` — the parts unit tests cannot see: the global guard (401 without a token, 401 for a token whose user was deleted), the success envelope the frontend's `apiClient` unwraps, `forbidNonWhitelisted` rejecting extra fields (this is what keeps the frontend from sending `authorId` to `/reviews` again), `ParseUUIDPipe`, and error mapping to 403/404 with a body.
- `test/pipeline.e2e-spec.ts` also covers the Telegram webhook: public but 401 without or with a wrong secret, and a raw Telegram update passes the strict `ValidationPipe` with the right one.

**Setup.** E2E needs its own database — the suite truncates every table before each test, so never point it at a working database.

```bash
createdb studylink_test                 # or use the postgres service from docker-compose
export DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/studylink_test"
pnpm run test:e2e:setup                 # applies migrations to the test database
pnpm run test:e2e
```

`test/env.ts` defaults `DATABASE_URL_TEST` to `postgresql://postgres:postgres@localhost:5432/studylink_test` and forces `NODE_ENV=test`; it also clears `TELEGRAM_BOT_TOKEN`, so notifications go nowhere.

## Not covered yet

- Parser sync, notifications delivery and the education module have no tests; the parser has only the kai.ru client spec.
- Deal cancellation, reopen and the auto-confirm sweep are covered by unit tests only — no e2e walks those over HTTP yet.
- Response shapes are inconsistent and e2e records that as fact rather than fixing it: `GET /marketplace/requests` returns an array, `GET /marketplace/requests/my` returns `{ items, total }`. The frontend normalizes both.
- The frontend has its own suite (vitest) — see the `study-link` repository.

## Conventions

- **Unit tests** live next to the code: `src/modules/reviews/reviews.service.spec.ts`. Test services, not controllers; mock `DatabaseService` and `NotificationService` via Nest's `Test.createTestingModule` with provider overrides.
- **E2E tests** go under `test/` (the `test:e2e` script expects `test/jest-e2e.json`) and use supertest against a compiled app instance.
- Never run tests against a real/shared database — use a dedicated local test database or mock the Prisma layer.
- Do not assert on user-facing Russian message strings — assert on status codes, error codes (`NOT_FOUND`, `FORBIDDEN`), and data shapes, so texts can change freely. `expectBusinessError` does exactly this.
- Jest's matchers are typed as `any`, so `eslint.config.mjs` turns the `no-unsafe-*` rules off for `**/*.spec.ts` — no `eslint-disable` comments needed in tests.
