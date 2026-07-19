# Auth and Users

Telegram-based authentication, JWT issuance, dev login, user profiles, and tutor profile aggregation.

## Key files

| File                                          | Purpose                                                               |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `src/modules/auth/auth.service.ts`            | `initData` validation, login-or-register, dev login, token generation |
| `src/modules/auth/auth.controller.ts`         | `/auth/telegram`, `/auth/profile`, `/auth/refresh`                    |
| `src/modules/auth/dev-auth.controller.ts`     | `/auth/dev/*` — web login for local development, 403 in production    |
| `src/modules/auth/strategies/jwt.strategy.ts` | Validates the JWT and loads the full `User` onto `request.user`       |
| `src/common/guards/jwt-auth.guard.ts`         | Global guard; `@Public()` opts a route out                            |
| `src/modules/users/users.service.ts`          | User CRUD, profile updates, group change, stats                       |
| `src/modules/tutors/tutors.service.ts`        | Read-only tutor profile: services + rating + reviews                  |

## Telegram login flow

`POST /auth/telegram` receives the Telegram WebApp `initData` string:

1. Signature is verified with HMAC-SHA256 using `TELEGRAM_BOT_TOKEN`. Two dev escapes: if the token is unset, validation is skipped; mock `initData` is accepted when `NODE_ENV=development`.
2. The user payload is parsed; the user is found by `telegramId` or created. `telegramUsername` and `name` are re-synced on every login.
3. Response: `{ accessToken, user }`. JWT payload is `{ sub: userId, telegramId }`, lifetime `JWT_EXPIRES_IN` (default 7d).

`GET /auth/profile` and `GET /auth/refresh` both return the current user with a fresh token.

## Dev login

`POST /auth/dev/login` (with optional `userId`) and `GET /auth/dev/users` allow web-based login without Telegram. `AuthService.ensureDevEnvironment()` hard-disables both in production (403).

## Users

One `User` model plays both marketplace roles — there is no role column; a user is "a tutor" when they own services and "a student" when they own requests. Notable fields: `balance` (kopecks), `groupId` (optional university group), `telegramNotificationsEnabled` + `notificationPreferences` (see [notifications.md](notifications.md)).

Profile self-service: `GET /users/me`, `PATCH /users/me`, `PATCH /users/group`. Admin-style CRUD lives on `/users/:id`.

⚠️ `PATCH /users/:id/verify|unverify|activate|deactivate` write to `isVerified`/`isActive`, which no longer exist in `prisma/schema.prisma` — legacy endpoints, expected to fail at runtime. Do not build on them.

## Tutors module

`GET /tutors/:id` aggregates a public tutor profile (services, rating, reviews); `GET /tutors/stats` does the same for the current user. Read-only — it owns no tables.

## Common mistakes

- Testing a `@Public()` route with a stale token attached — the guard skips validation entirely on public routes, so behavior differs from authenticated calls
- Reading `request.user` manually — use `@CurrentUser()` (optionally `@CurrentUser('id')`)
