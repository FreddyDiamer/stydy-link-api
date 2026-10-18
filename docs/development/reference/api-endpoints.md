# API Endpoints

Every route, verified against the controllers. All paths are prefixed with `/api`. 🔓 = `@Public()` (no token); everything else requires a Bearer JWT.

When you add, change, or remove an endpoint, update this table in the same change (hard rule).

## Health

| Method | Path | Description  |
| ------ | ---- | ------------ |
| 🔓 GET | `/`  | Health check |

## Auth — `/auth` (`src/modules/auth/auth.controller.ts`)

| Method  | Path             | Description                                                          |
| ------- | ---------------- | -------------------------------------------------------------------- |
| 🔓 POST | `/auth/telegram` | Login or register via Telegram WebApp `initData`; returns JWT + user |
| GET     | `/auth/profile`  | Current user profile + fresh access token                            |
| GET     | `/auth/refresh`  | Issue a new JWT for the current user                                 |

## Dev auth — `/auth/dev` (`dev-auth.controller.ts`, disabled in production)

| Method  | Path              | Description                                                                              |
| ------- | ----------------- | ---------------------------------------------------------------------------------------- |
| 🔓 POST | `/auth/dev/login` | Web login without Telegram (existing `userId` or `telegramUsername`, or a test dev user) |
| 🔓 GET  | `/auth/dev/users` | Users to pick from for web login                                                         |

## Users — `/users`

Admin-style endpoints (create/update/delete arbitrary users, verify/activate) were removed: there is no role system, so they let any user edit anyone. List/`:id` responses expose only public fields (no `telegramId`, `balance`, notification settings).

| Method | Path               | Description                                                  |
| ------ | ------------------ | ------------------------------------------------------------ |
| GET    | `/users`           | List users — public fields only (pagination + filter)        |
| GET    | `/users/me`        | Current user's full profile                                  |
| GET    | `/users/:id`       | Public profile by ID                                         |
| GET    | `/users/:id/stats` | Per-user stats; `balance` included only for own profile      |
| PATCH  | `/users/me`        | Update own profile (name, group, notification settings only) |
| PATCH  | `/users/group`     | Change own group                                             |

## Tutors — `/tutors`

| Method | Path            | Description                                     |
| ------ | --------------- | ----------------------------------------------- |
| GET    | `/tutors/stats` | Current user's stats as a tutor                 |
| GET    | `/tutors/:id`   | Public tutor profile: services, rating, reviews |

## Education (read-only reference data)

Write endpoints (POST/PATCH/DELETE) were removed from all education controllers: reference data is populated by the parser, and without a role system any user could rewrite the university catalog.

List endpoints return light items — subjects `{ id, name, isActive }`, teachers `{ id, fullName }`; nested teachers/subjects and counters come only from `/:id`. Names are sorted the Russian way in the app. `search` is case-insensitive and trimmed; prefix matches come before substring matches, alphabetical within each part.

### `/education/subjects`

| Method | Path                            | Description                                                      |
| ------ | ------------------------------- | ---------------------------------------------------------------- |
| GET    | `/education/subjects`           | List (pagination, `search`; active only unless `isActive=false`) |
| GET    | `/education/subjects/active`    | All active subjects, `{ items, total }`                          |
| GET    | `/education/subjects/:id`       | Subject by ID (teachers + stats)                                 |
| GET    | `/education/subjects/:id/stats` | Usage statistics                                                 |

### `/education/teachers`

| Method | Path                                        | Description                                                   |
| ------ | ------------------------------------------- | ------------------------------------------------------------- |
| GET    | `/education/teachers`                       | List (pagination, `search`)                                   |
| GET    | `/education/teachers/active`                | Teachers with active subjects, `{ items, total }`             |
| GET    | `/education/teachers/by-subject/:subjectId` | All teachers of a subject (no pagination), `{ items, total }` |
| GET    | `/education/teachers/:id`                   | Teacher by ID (subjects + stats)                              |
| GET    | `/education/teachers/:id/stats`             | Activity statistics                                           |

### `/education/teacher-subjects`

| Method | Path                                                      | Description                                                                           |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/education/teacher-subjects`                             | List (pagination + filter)                                                            |
| GET    | `/education/teacher-subjects/teacher/:teacherId`          | All active subjects of a teacher: `{ items: { id, subject: { id, name } }[], total }` |
| GET    | `/education/teacher-subjects/subject/:subjectId`          | Active teachers of a subject                                                          |
| GET    | `/education/teacher-subjects/stats/:teacherId/:subjectId` | Link stats                                                                            |
| GET    | `/education/teacher-subjects/:id`                         | Link by ID                                                                            |

### `/education/groups`

| Method | Path                                  | Description                                                                                                                                                  |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/education/groups`                   | List all groups                                                                                                                                              |
| GET    | `/education/groups/:groupId/subjects` | The group's scheduled subjects with that group's teachers: `{ id, name, teachers: { id, fullName }[] }[]`; `[]` without a schedule, 404 for an unknown group |
| GET    | `/education/groups/:id`               | Group by ID                                                                                                                                                  |

## Marketplace — `/marketplace/services`

| Method | Path                                                             | Description                           |
| ------ | ---------------------------------------------------------------- | ------------------------------------- |
| POST   | `/marketplace/services`                                          | Create service (owner = current user) |
| GET    | `/marketplace/services`                                          | List (query/filter)                   |
| GET    | `/marketplace/services/active`                                   | Active services                       |
| GET    | `/marketplace/services/popular`                                  | Most-responded services (`?limit`)    |
| GET    | `/marketplace/services/my`                                       | Current tutor's services              |
| GET    | `/marketplace/services/by-tutor/:tutorId`                        | Services of a tutor                   |
| GET    | `/marketplace/services/by-subject-teacher/:subjectId/:teacherId` | Services for a subject+teacher pair   |
| GET    | `/marketplace/services/:id`                                      | Service by ID (with responses)        |
| GET    | `/marketplace/services/:id/stats`                                | Service stats (responses, deals)      |
| PATCH  | `/marketplace/services/:id`                                      | Update (owner only)                   |
| PATCH  | `/marketplace/services/:id/activate` · `/deactivate`             | Toggle (owner only)                   |
| PATCH  | `/marketplace/services/:id/suspend`                              | Suspend (owner only)                  |
| DELETE | `/marketplace/services/:id`                                      | Delete (owner only)                   |

## Marketplace — `/marketplace/requests`

| Method | Path                                                             | Description                                                                                                |
| ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| POST   | `/marketplace/requests`                                          | Create request (must be for self)                                                                          |
| GET    | `/marketplace/requests`                                          | List (filter)                                                                                              |
| GET    | `/marketplace/requests/open`                                     | Open requests for tutors                                                                                   |
| GET    | `/marketplace/requests/popular`                                  | Most-responded requests (`?limit`)                                                                         |
| GET    | `/marketplace/requests/my`                                       | Current student's requests                                                                                 |
| GET    | `/marketplace/requests/by-student/:studentId`                    | A student's `OPEN` requests without responses; the student themself gets all their requests with responses |
| GET    | `/marketplace/requests/by-subject-teacher/:subjectId/:teacherId` | Requests for a subject+teacher pair                                                                        |
| GET    | `/marketplace/requests/:id`                                      | Request by ID (with responses)                                                                             |
| PATCH  | `/marketplace/requests/:id`                                      | Update (owner only)                                                                                        |
| PATCH  | `/marketplace/requests/:id/close`                                | Close (owner only); pending responses → `REJECTED`                                                         |
| POST   | `/marketplace/requests/:id/reopen`                               | Reopen as a **new** request (owner only)                                                                   |
| DELETE | `/marketplace/requests/:id`                                      | Delete (owner only)                                                                                        |

## Marketplace — `/marketplace/service-responses` (student → service)

| Method | Path                                        | Description                                                                                                                                                                                      |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/marketplace/service-responses`            | Create response (must be for self)                                                                                                                                                               |
| GET    | `/marketplace/service-responses`            | Caller's own responses and responses to the caller's services (pagination + filter). `role=student` — own only, `role=tutor` — to own services; `serviceId`, `status`, price, `search` narrow it |
| GET    | `/marketplace/service-responses/:id`        | Response by ID (author or service owner, else 403)                                                                                                                                               |
| GET    | `/marketplace/service-responses/:id/stats`  | Response stats (author or service owner, else 403)                                                                                                                                               |
| PATCH  | `/marketplace/service-responses/:id`        | Update (author only)                                                                                                                                                                             |
| PATCH  | `/marketplace/service-responses/:id/accept` | Tutor accepts → **creates a Deal** (price: response's, else service's); other bookings stay pending                                                                                              |
| PATCH  | `/marketplace/service-responses/:id/reject` | Tutor rejects                                                                                                                                                                                    |
| DELETE | `/marketplace/service-responses/:id`        | Delete (author only, if no deal)                                                                                                                                                                 |

## Marketplace — `/marketplace/request-responses` (tutor → request)

| Method | Path                                        | Description                                                                                                                                                                                      |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/marketplace/request-responses`            | Create response (tutor = current user)                                                                                                                                                           |
| GET    | `/marketplace/request-responses`            | Caller's own responses and responses to the caller's requests (pagination + filter). `role=tutor` — own only, `role=student` — to own requests; `requestId`, `status`, price, `search` narrow it |
| GET    | `/marketplace/request-responses/:id`        | Response by ID (author or request author, else 403)                                                                                                                                              |
| PATCH  | `/marketplace/request-responses/:id`        | Update content (author only, PENDING)                                                                                                                                                            |
| PATCH  | `/marketplace/request-responses/:id/accept` | Student accepts → **creates a Deal**                                                                                                                                                             |
| PATCH  | `/marketplace/request-responses/:id/reject` | Student rejects                                                                                                                                                                                  |
| PATCH  | `/marketplace/request-responses/:id/cancel` | Tutor cancels own response                                                                                                                                                                       |
| DELETE | `/marketplace/request-responses/:id`        | Delete                                                                                                                                                                                           |

## Marketplace — `/marketplace/deals`

Generic `PATCH`/`DELETE /deals/:id` were removed (they let anyone rewrite any deal); the lifecycle is fully covered by accept/reject/complete/cancel. There is no `POST /marketplace/deals`: a deal is created only by accepting a response, so both sides have agreed to it. Every endpoint is participant-scoped (listing and `:id` return only the caller's deals), and participants come back as public profiles (`id`, `name`, `telegramUsername`, `avatarUrl`, …) — never `telegramId`, `balance` or notification settings.

| Method | Path                              | Description                                                                                                           |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/marketplace/deals`              | Current user's deals (pagination + filter); `role=tutor` / `role=student` — only deals where the caller has that role |
| GET    | `/marketplace/deals/:id`          | Deal by ID (participants only)                                                                                        |
| PATCH  | `/marketplace/deals/:id/accept`   | Participant accepts (→ `ACCEPTED`)                                                                                    |
| PATCH  | `/marketplace/deals/:id/reject`   | Participant rejects                                                                                                   |
| PATCH  | `/marketplace/deals/:id/complete` | Confirm completion from your side (deal closes when both confirm, or after 7-day auto-confirm)                        |
| PATCH  | `/marketplace/deals/:id/reopen`   | "Work not ready": clears the other side's confirmation and stops the auto-confirm timer                               |
| PATCH  | `/marketplace/deals/:id/cancel`   | Cancel; optional body `{ reason }` visible to both sides                                                              |

## Reviews — `/reviews`

| Method | Path                            | Description                                                                                                                  |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/reviews`                      | Create review for a completed deal — body is `{ dealId, rating, comment? }`; author, target and role are derived server-side |
| GET    | `/reviews`                      | List (pagination + filter)                                                                                                   |
| GET    | `/reviews/my`                   | Reviews written by current user                                                                                              |
| GET    | `/reviews/about-me`             | Reviews about current user                                                                                                   |
| GET    | `/reviews/stats/:targetId`      | Rating statistics for a user                                                                                                 |
| GET    | `/reviews/top-rated/:role`      | Top-rated `TUTOR`/`STUDENT` (`?limit`)                                                                                       |
| GET    | `/reviews/by-target/:targetId`  | Reviews about a user                                                                                                         |
| GET    | `/reviews/deal/:dealId`         | Reviews of a deal (one per side)                                                                                             |
| GET    | `/reviews/reputation/:targetId` | Reputation split by role (as tutor / as student)                                                                             |
| GET    | `/reviews/:id`                  | Review by ID                                                                                                                 |
| PATCH  | `/reviews/:id`                  | Update (author only)                                                                                                         |
| PATCH  | `/reviews/:id/reply`            | Tutor replies to a review                                                                                                    |
| DELETE | `/reviews/:id`                  | Delete (author only)                                                                                                         |

## Telegram — `/telegram` (`src/modules/notifications/telegram-webhook.controller.ts`)

Public (no JWT) and not rate-limited, but every request must carry the webhook secret in `X-Telegram-Bot-Api-Secret-Token`, otherwise 401.

| Method  | Path                | Description                                                        |
| ------- | ------------------- | ------------------------------------------------------------------ |
| 🔓 POST | `/telegram/webhook` | Telegram bot updates: `/start` greeting, hint on any other message |

## Parser — `/parser`

Admins only: the caller's `telegramId` must be listed in `ADMIN_TELEGRAM_IDS` (`AdminGuard`), everyone else gets 403 — with the variable empty nobody can run the parser. Only one sync runs at a time — a second call while one is in progress returns `409 PARSER_BUSY`.

| Method | Path            | Description                                                 |
| ------ | --------------- | ----------------------------------------------------------- |
| POST   | `/parser/sync`  | Parse university data and sync; awaits completion (minutes) |
| POST   | `/parser/async` | Background parse; returns `Parsing started` immediately     |
