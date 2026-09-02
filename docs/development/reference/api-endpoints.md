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

| Method  | Path              | Description                                                       |
| ------- | ----------------- | ----------------------------------------------------------------- |
| 🔓 POST | `/auth/dev/login` | Web login without Telegram (existing `userId` or a test dev user) |
| 🔓 GET  | `/auth/dev/users` | Users to pick from for web login                                  |

## Users — `/users`

Admin-style endpoints (create/update/delete arbitrary users, verify/activate) were removed: there is no role system, so they let any user edit anyone. List/`:id` responses expose only public fields (no `telegramId`, `balance`, notification settings).

| Method | Path                   | Description                                                  |
| ------ | ---------------------- | ------------------------------------------------------------ |
| GET    | `/users`               | List users — public fields only (pagination + filter)        |
| GET    | `/users/me`            | Current user's full profile                                  |
| GET    | `/users/with-services` | Users who provide services                                   |
| GET    | `/users/with-requests` | Users who create requests                                    |
| GET    | `/users/:id`           | Public profile by ID                                         |
| GET    | `/users/:id/stats`     | Per-user stats; `balance` included only for own profile      |
| PATCH  | `/users/me`            | Update own profile (name, group, notification settings only) |
| PATCH  | `/users/group`         | Change own group                                             |

## Tutors — `/tutors`

| Method | Path            | Description                                     |
| ------ | --------------- | ----------------------------------------------- |
| GET    | `/tutors/stats` | Current user's stats as a tutor                 |
| GET    | `/tutors/:id`   | Public tutor profile: services, rating, reviews |

## Education (read-only reference data)

Write endpoints (POST/PATCH/DELETE) were removed from all education controllers: reference data is populated by the parser, and without a role system any user could rewrite the university catalog.

### `/education/subjects`

| Method | Path                            | Description                      |
| ------ | ------------------------------- | -------------------------------- |
| GET    | `/education/subjects`           | List (pagination + filter)       |
| GET    | `/education/subjects/active`    | Active subjects (form selectors) |
| GET    | `/education/subjects/:id`       | Subject by ID (teachers + stats) |
| GET    | `/education/subjects/:id/stats` | Usage statistics                 |

### `/education/teachers`

| Method | Path                                        | Description                      |
| ------ | ------------------------------------------- | -------------------------------- |
| GET    | `/education/teachers`                       | List (pagination + filter)       |
| GET    | `/education/teachers/active`                | Teachers with active subjects    |
| GET    | `/education/teachers/by-subject/:subjectId` | Teachers teaching a subject      |
| GET    | `/education/teachers/:id`                   | Teacher by ID (subjects + stats) |
| GET    | `/education/teachers/:id/stats`             | Activity statistics              |

### `/education/teacher-subjects`

| Method | Path                                                      | Description                  |
| ------ | --------------------------------------------------------- | ---------------------------- |
| GET    | `/education/teacher-subjects`                             | List (pagination + filter)   |
| GET    | `/education/teacher-subjects/teacher/:teacherId`          | Active subjects of a teacher |
| GET    | `/education/teacher-subjects/subject/:subjectId`          | Active teachers of a subject |
| GET    | `/education/teacher-subjects/stats/:teacherId/:subjectId` | Link stats                   |
| GET    | `/education/teacher-subjects/:id`                         | Link by ID                   |

### `/education/groups`

| Method | Path                    | Description     |
| ------ | ----------------------- | --------------- |
| GET    | `/education/groups`     | List all groups |
| GET    | `/education/groups/:id` | Group by ID     |

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
| PATCH  | `/marketplace/services/:id/suspend`                              | Suspend                               |
| DELETE | `/marketplace/services/:id`                                      | Delete (owner only)                   |

## Marketplace — `/marketplace/requests`

| Method | Path                                                             | Description                         |
| ------ | ---------------------------------------------------------------- | ----------------------------------- |
| POST   | `/marketplace/requests`                                          | Create request (must be for self)   |
| GET    | `/marketplace/requests`                                          | List (filter)                       |
| GET    | `/marketplace/requests/open`                                     | Open requests for tutors            |
| GET    | `/marketplace/requests/popular`                                  | Most-responded requests (`?limit`)  |
| GET    | `/marketplace/requests/my`                                       | Current student's requests          |
| GET    | `/marketplace/requests/by-student/:studentId`                    | Requests of a student               |
| GET    | `/marketplace/requests/by-subject-teacher/:subjectId/:teacherId` | Requests for a subject+teacher pair |
| GET    | `/marketplace/requests/:id`                                      | Request by ID (with responses)      |
| PATCH  | `/marketplace/requests/:id`                                      | Update (owner only)                 |
| DELETE | `/marketplace/requests/:id`                                      | Delete (owner only)                 |

## Marketplace — `/marketplace/service-responses` (student → service)

| Method | Path                                                           | Description                        |
| ------ | -------------------------------------------------------------- | ---------------------------------- |
| POST   | `/marketplace/service-responses`                               | Create response (must be for self) |
| GET    | `/marketplace/service-responses`                               | List (pagination + filter)         |
| GET    | `/marketplace/service-responses/my`                            | Current student's responses        |
| GET    | `/marketplace/service-responses/by-service/:serviceId`         | All responses to a service         |
| GET    | `/marketplace/service-responses/by-service/:serviceId/pending` | Pending responses to a service     |
| GET    | `/marketplace/service-responses/:id`                           | Response by ID                     |
| GET    | `/marketplace/service-responses/:id/stats`                     | Response stats                     |
| PATCH  | `/marketplace/service-responses/:id`                           | Update (author only)               |
| PATCH  | `/marketplace/service-responses/:id/accept`                    | Tutor accepts → **creates a Deal** |
| PATCH  | `/marketplace/service-responses/:id/reject`                    | Tutor rejects                      |
| DELETE | `/marketplace/service-responses/:id`                           | Delete (author only, if no deal)   |

## Marketplace — `/marketplace/request-responses` (tutor → request)

| Method | Path                                        | Description                            |
| ------ | ------------------------------------------- | -------------------------------------- |
| POST   | `/marketplace/request-responses`            | Create response (tutor = current user) |
| GET    | `/marketplace/request-responses`            | List (filter)                          |
| GET    | `/marketplace/request-responses/my`         | Current tutor's responses              |
| GET    | `/marketplace/request-responses/:id`        | Response by ID                         |
| PATCH  | `/marketplace/request-responses/:id`        | Update content (author only, PENDING)  |
| PATCH  | `/marketplace/request-responses/:id/accept` | Student accepts → **creates a Deal**   |
| PATCH  | `/marketplace/request-responses/:id/reject` | Student rejects                        |
| PATCH  | `/marketplace/request-responses/:id/cancel` | Tutor cancels own response             |
| DELETE | `/marketplace/request-responses/:id`        | Delete                                 |

## Marketplace — `/marketplace/deals`

Generic `PATCH`/`DELETE /deals/:id` were removed (they let anyone rewrite any deal); the lifecycle is fully covered by accept/reject/complete/cancel. Every endpoint is participant-scoped: creation requires being the student or the tutor (and a linked response must match that pair), listing and `:id` return only the caller's deals.

| Method | Path                              | Description                                   |
| ------ | --------------------------------- | --------------------------------------------- |
| POST   | `/marketplace/deals`              | Create deal (initiator must be a participant) |
| GET    | `/marketplace/deals`              | Current user's deals (pagination + filter)    |
| GET    | `/marketplace/deals/my-tutor`     | Current user's deals as tutor                 |
| GET    | `/marketplace/deals/:id`          | Deal by ID (participants only)                |
| PATCH  | `/marketplace/deals/:id/accept`   | Participant accepts (→ `ACCEPTED`)            |
| PATCH  | `/marketplace/deals/:id/reject`   | Participant rejects                           |
| PATCH  | `/marketplace/deals/:id/complete` | Mark completed                                |
| PATCH  | `/marketplace/deals/:id/cancel`   | Cancel                                        |

## Reviews — `/reviews`

| Method | Path                           | Description                                        |
| ------ | ------------------------------ | -------------------------------------------------- |
| POST   | `/reviews`                     | Create review for a completed deal (author = self) |
| GET    | `/reviews`                     | List (pagination + filter)                         |
| GET    | `/reviews/my`                  | Reviews written by current user                    |
| GET    | `/reviews/about-me`            | Reviews about current user                         |
| GET    | `/reviews/stats/:targetId`     | Rating statistics for a user                       |
| GET    | `/reviews/top-rated/:role`     | Top-rated `TUTOR`/`STUDENT` (`?limit`)             |
| GET    | `/reviews/by-target/:targetId` | Reviews about a user                               |
| GET    | `/reviews/deal/:dealId`        | Review of a specific deal                          |
| GET    | `/reviews/:id`                 | Review by ID                                       |
| PATCH  | `/reviews/:id`                 | Update (author only)                               |
| PATCH  | `/reviews/:id/reply`           | Tutor replies to a review                          |
| DELETE | `/reviews/:id`                 | Delete (author only)                               |

## Parser — `/parser`

No longer `@Public()`: both endpoints require a Bearer JWT. Only one sync runs at a time — a second call while one is in progress returns `409 PARSER_BUSY`.

| Method | Path            | Description                                                 |
| ------ | --------------- | ----------------------------------------------------------- |
| POST   | `/parser/sync`  | Parse university data and sync; awaits completion (minutes) |
| POST   | `/parser/async` | Background parse; returns `Parsing started` immediately     |
