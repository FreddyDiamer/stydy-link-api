# Study Link API — Functionality Overview

A NestJS + Prisma (PostgreSQL) backend for a **tutor marketplace** built around a Telegram Mini App. Students post requests, tutors post services, both sides respond, accepted responses become deals, and completed deals can be reviewed. An education reference layer (subjects / teachers / groups) is populated by a university (KAI) parser.

- **Framework:** NestJS 11
- **ORM:** Prisma 6 (PostgreSQL)
- **Auth:** JWT (Bearer), login via Telegram WebApp `initData`
- **Docs:** Swagger at `/api/docs` (non-production only)
- **Global prefix:** all routes are under `/api`
- **Default port:** `3000`

---

## Cross-cutting behavior

- **Global JWT guard** — every endpoint requires a Bearer token **except** those marked `@Public()` (Telegram login, health check, parser endpoints).
- **Global validation** — `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` + `transform`. Unknown body fields are rejected.
- **Response envelope** — `TransformInterceptor` wraps successful responses in a standard success shape; `GlobalExceptionFilter` standardizes errors.
- **CORS** — open in development, disabled origin in production.
- **Pagination** — list endpoints accept `PaginationDto` query params.
- **IDs** — UUID path params validated via `ParseUUIDPipe`.

### Configuration / environment
| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | required |
| `JWT_SECRET` | JWT signing secret | min 32 chars |
| `JWT_EXPIRES_IN` | Token lifetime | default `7d` |
| `PORT` | HTTP port | default `3000` |
| `NODE_ENV` | environment | `development` / `production` / `test` |
| `TELEGRAM_BOT_TOKEN` | validates Telegram `initData` | **required in production**; if unset in dev, init-data signature check is skipped |

---

## Domain model

**Core:** `User`

**Education (reference data):** `Subject`, `Teacher`, `Group`, `TeacherSubject`, `GroupSubject`, `GroupSubjectTeacher`

**Marketplace:** `Service` (tutor offer), `Request` (student ask), `ServiceResponse` (student → service), `RequestResponse` (tutor → request), `Deal`

**Feedback:** `Review`

### Enums
- `UserRole`: `TUTOR`, `STUDENT`
- `ServiceStatus`: `ACTIVE`, `INACTIVE`, `SUSPENDED`
- `Urgency`: `LOW`, `MEDIUM`, `HIGH`
- `DealStatus`: `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `ResponseStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`

> Money is stored in **kopecks** (integer): `User.balance`, `Service.price`, `Request.budget`, `Deal.price`, response `price`.

### Core relationships
- A `User` acts as both **tutor** (owns `services`, `requestResponses`, `tutorDeals`) and **student** (owns `requests`, `serviceResponses`, `studentDeals`), and belongs to an optional `Group`.
- A **Deal is created only from an accepted response** — either a `ServiceResponse` or a `RequestResponse` (one-to-one with each).
- A **Review is one-to-one with a Deal**, written by an author about a target, tagged with `targetRole`.

---

## Marketplace flow (the core loop)

```
Tutor posts Service ──┐
                      ├─► Student sends ServiceResponse ─► Tutor accepts ─► Deal ─► Review
Student posts Request ─► Tutor sends RequestResponse ─► (accept) ─────────► Deal ─► Review
```

1. A **tutor** publishes a `Service` (subject + teacher + price). A **student** publishes a `Request` (subject + teacher + optional budget).
2. The other side **responds** with an optional message, proposed price, and proposed deadline.
3. The owner **accepts** a response → a `Deal` is created with the agreed price/deadline, and the response is marked `ACCEPTED`.
4. The deal moves through `PENDING → ACCEPTED → IN_PROGRESS → COMPLETED` (or `CANCELLED`).
5. On a completed deal, a participant can leave a `Review` (rating 1–5 + comment).

---

## API surface

All paths are prefixed with `/api`. 🔓 = public (no auth), all others require a Bearer token.

### Health — `/`
| Method | Path | Description |
|---|---|---|
| 🔓 GET | `/` | Health check |

### Authentication — `/auth`
| Method | Path | Description |
|---|---|---|
| 🔓 POST | `/auth/telegram` | Login or register via Telegram WebApp `initData`; returns JWT + user |
| GET | `/auth/profile` | Current user profile + a fresh access token |
| GET | `/auth/refresh` | Issue a new JWT for the current user |

**Telegram auth:** `initData` signature is verified with `TELEGRAM_BOT_TOKEN` (HMAC-SHA256), the user payload is parsed, and the user is upserted by `telegramId` (username/name kept in sync). JWT payload = `{ sub: userId, telegramId }`.

### Users — `/users`
| Method | Path | Description |
|---|---|---|
| POST | `/users` | Create a user |
| GET | `/users` | List users (pagination + filter) |
| GET | `/users/me` | Current user's full profile |
| GET | `/users/with-services` | Users who provide services |
| GET | `/users/with-requests` | Users who create requests |
| GET | `/users/:id` | User by ID |
| GET | `/users/:id/stats` | Per-user stats (services & requests) |
| PATCH | `/users/me` | Update own profile (cannot change verification/active flags) |
| PATCH | `/users/group` | Change own group |
| PATCH | `/users/:id` | Update a user |
| PATCH | `/users/:id/verify` · `/unverify` | Set / clear verification |
| PATCH | `/users/:id/activate` · `/deactivate` | Activate / deactivate account |
| DELETE | `/users/:id` | Delete a user |

### Education — Subjects `/education/subjects`
| Method | Path | Description |
|---|---|---|
| POST | `/education/subjects` | Create subject |
| GET | `/education/subjects` | List (pagination + filter) |
| GET | `/education/subjects/active` | Active subjects (for form selectors) |
| GET | `/education/subjects/:id` | Subject by ID (with teachers & stats) |
| GET | `/education/subjects/:id/stats` | Usage statistics |
| PATCH | `/education/subjects/:id` | Update |
| PATCH | `/education/subjects/:id/activate` · `/deactivate` | Toggle availability |
| DELETE | `/education/subjects/:id` | Delete (only if unused) |

### Education — Teachers `/education/teachers`
| Method | Path | Description |
|---|---|---|
| POST | `/education/teachers` | Create teacher |
| GET | `/education/teachers` | List (pagination + filter) |
| GET | `/education/teachers/active` | Teachers with active subjects |
| GET | `/education/teachers/by-subject/:subjectId` | Teachers teaching a subject |
| GET | `/education/teachers/:id` | Teacher by ID (subjects + stats) |
| GET | `/education/teachers/:id/stats` | Activity statistics |
| PATCH | `/education/teachers/:id` | Update |
| DELETE | `/education/teachers/:id` | Delete (only if unused) |

### Education — Teacher–Subject links `/education/teacher-subjects`
| Method | Path | Description |
|---|---|---|
| POST | `/education/teacher-subjects` | Create link |
| POST | `/education/teacher-subjects/bulk` | Bulk-create links |
| GET | `/education/teacher-subjects` | List (pagination + filter) |
| GET | `/education/teacher-subjects/teacher/:teacherId` | Active subjects of a teacher |
| GET | `/education/teacher-subjects/subject/:subjectId` | Active teachers of a subject |
| GET | `/education/teacher-subjects/stats/:teacherId/:subjectId` | Link stats |
| GET | `/education/teacher-subjects/:id` | Link by ID |
| PATCH | `/education/teacher-subjects/:id` | Update |
| PATCH | `/education/teacher-subjects/:id/activate` · `/deactivate` | Toggle link |
| DELETE | `/education/teacher-subjects/:id` | Delete (only if unused) |

### Education — Groups `/education/groups`
| Method | Path | Description |
|---|---|---|
| POST | `/education/groups` | Create group |
| GET | `/education/groups` | List all groups |
| GET | `/education/groups/:id` | Group by ID |
| DELETE | `/education/groups/:id` | Delete group |

### Marketplace — Services `/marketplace/services`
| Method | Path | Description |
|---|---|---|
| POST | `/marketplace/services` | Create service (owner = current user) |
| GET | `/marketplace/services` | List (query/filter) |
| GET | `/marketplace/services/active` | Active services |
| GET | `/marketplace/services/popular` | Most-responded services (`?limit`) |
| GET | `/marketplace/services/my` | Current tutor's services |
| GET | `/marketplace/services/by-tutor/:tutorId` | Services of a tutor |
| GET | `/marketplace/services/by-subject-teacher/:subjectId/:teacherId` | Services for a subject+teacher pair |
| GET | `/marketplace/services/:id` | Service by ID (with responses) |
| GET | `/marketplace/services/:id/stats` | Service stats (responses, deals) |
| PATCH | `/marketplace/services/:id` | Update (owner only) |
| PATCH | `/marketplace/services/:id/activate` · `/deactivate` | Toggle (owner only) |
| PATCH | `/marketplace/services/:id/suspend` | Suspend (admin) |
| DELETE | `/marketplace/services/:id` | Delete (owner only) |

### Marketplace — Requests `/marketplace/requests`
| Method | Path | Description |
|---|---|---|
| POST | `/marketplace/requests` | Create request (must be for self) |
| GET | `/marketplace/requests` | List (filter) |
| GET | `/marketplace/requests/open` | Open requests for tutors |
| GET | `/marketplace/requests/popular` | Most-responded requests (`?limit`) |
| GET | `/marketplace/requests/my` | Current student's requests |
| GET | `/marketplace/requests/by-student/:studentId` | Requests of a student |
| GET | `/marketplace/requests/by-subject-teacher/:subjectId/:teacherId` | Requests for a subject+teacher pair |
| GET | `/marketplace/requests/:id` | Request by ID (with responses) |
| PATCH | `/marketplace/requests/:id` | Update (owner only) |
| DELETE | `/marketplace/requests/:id` | Delete (owner only) |

### Marketplace — Service Responses `/marketplace/service-responses`
*(student responds to a tutor's service)*
| Method | Path | Description |
|---|---|---|
| POST | `/marketplace/service-responses` | Create response (must be for self) |
| GET | `/marketplace/service-responses` | List (pagination + filter) |
| GET | `/marketplace/service-responses/my` | Current student's responses |
| GET | `/marketplace/service-responses/by-service/:serviceId` | All responses to a service |
| GET | `/marketplace/service-responses/by-service/:serviceId/pending` | Pending responses to a service |
| GET | `/marketplace/service-responses/:id` | Response by ID |
| GET | `/marketplace/service-responses/:id/stats` | Response stats |
| PATCH | `/marketplace/service-responses/:id` | Update (author only) |
| PATCH | `/marketplace/service-responses/:id/accept` | Tutor accepts → **creates a Deal** |
| PATCH | `/marketplace/service-responses/:id/reject` | Tutor rejects |
| DELETE | `/marketplace/service-responses/:id` | Delete (author only, if no deal) |

### Marketplace — Request Responses `/marketplace/request-responses`
*(tutor responds to a student's request)*
| Method | Path | Description |
|---|---|---|
| POST | `/marketplace/request-responses` | Create response (tutor = current user) |
| GET | `/marketplace/request-responses` | List (filter) |
| GET | `/marketplace/request-responses/:id` | Response by ID |
| PATCH | `/marketplace/request-responses/:id` | Update |
| DELETE | `/marketplace/request-responses/:id` | Delete |

### Marketplace — Deals `/marketplace/deals`
| Method | Path | Description |
|---|---|---|
| POST | `/marketplace/deals` | Create deal |
| GET | `/marketplace/deals` | List (pagination + filter) |
| GET | `/marketplace/deals/:id` | Deal by ID |
| PATCH | `/marketplace/deals/:id` | Update (e.g. status transitions) |
| DELETE | `/marketplace/deals/:id` | Delete |

### Reviews — `/reviews`
| Method | Path | Description |
|---|---|---|
| POST | `/reviews` | Create review for a completed deal (author = self) |
| GET | `/reviews` | List (pagination + filter) |
| GET | `/reviews/my` | Reviews written by current user |
| GET | `/reviews/about-me` | Reviews about current user |
| GET | `/reviews/stats/:targetId` | Rating statistics for a user |
| GET | `/reviews/top-rated/:role` | Top-rated `TUTOR`/`STUDENT` (`?limit`) |
| GET | `/reviews/by-target/:targetId` | Reviews about a user |
| GET | `/reviews/:id` | Review by ID |
| PATCH | `/reviews/:id` | Update (author only) |
| DELETE | `/reviews/:id` | Delete (author only) |

### Parser — `/parser`
| Method | Path | Description |
|---|---|---|
| 🔓 POST | `/parser/sync` | Parse university (KAI) data and sync; **awaits** completion, returns result |
| 🔓 POST | `/parser/async` | Fire-and-forget parse; returns immediately (`"Parsing started"`) |

**Parser internals:** runs in a separate **worker thread** (`worker_threads`) via `ParserService`, with a **30-minute timeout**. The worker (`main-parser.worker`) uses a KAI API client + parser pool to fetch groups/subjects/teachers and a sync service to upsert them into `Group`, `Subject`, `Teacher`, `GroupSubject`, `GroupSubjectTeacher`. In dev it loads TS via `ts-node`; in production it runs the compiled `.js`.

---

## Notable implementation details

- **Ownership checks** are enforced in controllers for services, requests, service-responses, and reviews (only the author can edit/delete; create-for-self is validated).
- **Accepting a response creates the deal** — deals are not created arbitrarily from scratch in the normal flow; they originate from an accepted `ServiceResponse`/`RequestResponse` (each linked one-to-one).
- **Uniqueness constraints** prevent duplicates: one response per `(student, service)` and per `(tutor, request)`; one review per deal; unique `Subject.name`, `Teacher.foreignId`, `Group.foreignId`.
- **Teacher–subject validation** in `RequestsService`/`ServicesService` is currently **commented out** (see recent commit) — pending reimplementation.

---

## Running the project

```powershell
# install deps
npm install

# generate Prisma client (required after schema changes)
npx prisma generate

# apply migrations (dev)
npx prisma migrate dev

# start in watch mode
npm run start:dev
```

App: `http://localhost:3000` · Swagger UI: `http://localhost:3000/api/docs`

| Script | Purpose |
|---|---|
| `npm run start:dev` | Dev server, hot reload |
| `npm run start` | Run once |
| `npm run start:debug` | Watch + debugger |
| `npm run build` → `npm run start:prod` | Production build & run |
| `npm test` / `test:e2e` / `test:cov` | Jest unit / e2e / coverage |
| `npm run lint` | ESLint (autofix) |
