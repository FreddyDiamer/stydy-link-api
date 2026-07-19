# CLAUDE.md

Study Link backend. This file is the entry point for AI agents working in this repository. Read this fully, then go to `docs/workflow/INDEX.md` before starting any task.

> `AGENTS.md` is a literal copy of this file (kept for tool compatibility).

## What this is

NestJS + Prisma (PostgreSQL) backend for **Study Link** — a tutor-marketplace Telegram Mini App. Students post requests, tutors post services, both sides respond, an accepted response becomes a deal, and a completed deal can be reviewed. An education reference layer (subjects / teachers / groups) is populated by a university-API parser. The product currently serves KAI university and is designed to onboard other universities on the same codebase.

## Tech stack

| Layer      | Tech                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| Runtime    | Node.js, TypeScript                                                       |
| Framework  | NestJS 11 (Express platform)                                              |
| ORM / DB   | Prisma 6 + PostgreSQL                                                     |
| Validation | class-validator + class-transformer (DTOs), zod (config)                  |
| Auth       | JWT (Bearer) via Telegram WebApp `initData`; dev web-login for local work |
| Bot        | Telegraf (notifications)                                                  |
| API docs   | Swagger at `/api/docs` (non-production)                                   |
| Tooling    | pnpm, ESLint 9 + Prettier, Husky + lint-staged, Jest (no tests yet)       |
| Deploy     | docker-compose: postgres + app + caddy; migrations auto-apply on start    |

## Architecture (detail in `docs/development/`)

- **Feature modules** under `src/modules/` (auth, users, tutors, education, marketplace, reviews, notifications, parser); shared layer in `src/common/`, imported as `@common`
- **Global request pipeline** — `JwtAuthGuard` (opt-out via `@Public()`), `ValidationPipe` (whitelist + forbidNonWhitelisted), `TransformInterceptor` (success envelope), `GlobalExceptionFilter`; global `/api` prefix
- **Errors** — throw `BusinessException` subclasses from `@common`, never raw `throw`
- **Services** extend `BaseService` (logging, retry); all DB access via injected `DatabaseService` (PrismaClient)
- **Money** — integers in kopecks everywhere
- **Language** — code and docs in English; user-facing strings (notifications, business errors, Swagger summaries) in Russian
- **Notifications** — fire-and-forget (`void notify...()`) Telegram messages on marketplace events
- **Parser** — university-data sync runs in a `worker_threads` worker with a 30-minute timeout

## Quick commands

```bash
pnpm run start:dev        # dev server, watch mode (port 3000)
pnpm run build            # compile to dist/
pnpm run lint:check       # ESLint without autofix
npx prisma migrate dev    # apply/create migrations (local db)
npx prisma generate       # regenerate Prisma client
pnpm run prisma:seed      # seed the database
```

## Knowledge zones

**Always start with `workflow`.** It owns the hard rules, per-task playbooks, and the post-change checklist.

| Zone             | When to read                                                 | Entry point                                                      |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| **workflow**     | **Always, first.** Hard rules, playbooks, definition of done | [docs/workflow/INDEX.md](docs/workflow/INDEX.md)                 |
| development      | Implementing a feature, fixing a bug, touching code          | [docs/development/INDEX.md](docs/development/INDEX.md)           |
| testing          | Writing or running tests                                     | [docs/testing/INDEX.md](docs/testing/INDEX.md)                   |
| ai-documentation | Writing docs for other AI agents                             | [docs/ai-documentation/INDEX.md](docs/ai-documentation/INDEX.md) |

Hard rules and the post-change checklist live in `docs/workflow/`. Code conventions live in `docs/development/`. Don't ask CLAUDE.md for them — go to the zone.
