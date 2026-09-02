# Auth and Users

Telegram-based authentication, JWT issuance, dev login, user profiles, and tutor profile aggregation.

## Key files

| File                                          | Purpose                                                               |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `src/modules/auth/auth.service.ts`            | `initData` validation, login-or-register, dev login, token generation |
| `src/modules/auth/auth.controller.ts`         | `/auth/telegram`, `/auth/profile`, `/auth/refresh`                    |
| `src/modules/auth/dev-auth.controller.ts`     | `/auth/dev/*` — web login, 403 outside `NODE_ENV=development`         |
| `src/modules/auth/strategies/jwt.strategy.ts` | Validates the JWT and loads the full `User` onto `request.user`       |
| `src/common/guards/jwt-auth.guard.ts`         | Global guard; `@Public()` opts a route out                            |
| `src/modules/users/users.service.ts`          | User CRUD, profile updates, group change, stats                       |
| `src/modules/tutors/tutors.service.ts`        | Read-only tutor profile: services + rating + reviews                  |

## Telegram login flow

`POST /auth/telegram` receives the Telegram WebApp `initData` string:

1. Signature is verified with HMAC-SHA256 using `TELEGRAM_BOT_TOKEN` (constant-time compare), and `auth_date` must be no older than 24h (replay protection). Validation is fail-closed: with no bot token configured, login is rejected. The only escape is mock `initData` when `NODE_ENV=development`.
2. The user payload is parsed; the user is found by `telegramId` or created. `telegramUsername` and `name` are re-synced on every login.
3. Response: `{ accessToken, user }`. JWT payload is `{ sub: userId, telegramId }`, lifetime `JWT_EXPIRES_IN` (default 7d).

`GET /auth/profile` and `GET /auth/refresh` both return the current user with a fresh token.

## Dev login

`POST /auth/dev/login` (with optional `userId`) and `GET /auth/dev/users` allow web-based login without Telegram. `AuthService.ensureDevEnvironment()` allows them only when `NODE_ENV=development` — any other environment (production, test, unset) gets 403.

## Users

One `User` model plays both marketplace roles — there is no role column; a user is "a tutor" when they own services and "a student" when they own requests. Notable fields: `balance` (kopecks), `groupId` (optional university group), `telegramNotificationsEnabled` + `notificationPreferences` (see [notifications.md](notifications.md)).

Profile self-service: `GET /users/me`, `PATCH /users/me` (name, group, notification settings only — `telegramId`, `balance` and other system fields are not writable through the API), `PATCH /users/group`. Admin-style CRUD on `/users/:id` (create/update/delete/verify/activate) was removed: with no role system it let any user edit or delete anyone. Reads of other users (`GET /users`, `GET /users/:id`, `/tutors/:id`) return only public fields — no `telegramId`, `balance`, or notification settings.

## Tutors module

`GET /tutors/:id` aggregates a public tutor profile (services, rating, reviews); `GET /tutors/stats` does the same for the current user. Read-only — it owns no tables.

## Common mistakes

- Testing a `@Public()` route with a stale token attached — the guard skips validation entirely on public routes, so behavior differs from authenticated calls
- Reading `request.user` manually — use `@CurrentUser()` (optionally `@CurrentUser('id')`)
