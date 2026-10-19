# Architecture

How the NestJS application is wired: module layout, the request lifecycle, cross-cutting behavior, configuration, and deployment.

## Key files

| File                               | Purpose                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/main.ts`                      | Bootstrap: global `/api` prefix, `ValidationPipe`, `GlobalExceptionFilter`, CORS, Swagger    |
| `src/app.module.ts`                | Root module: registers all feature modules, global `JwtAuthGuard` and `TransformInterceptor` |
| `src/common/index.ts`              | Barrel for the shared layer, imported everywhere as `@common`                                |
| `src/config/`                      | `app.config.ts`, `database.config.ts`, `jwt.config.ts` — zod-validated `registerAs` configs  |
| `src/database/database.service.ts` | `DatabaseService extends PrismaClient` — the single DB access point                          |

## Module layout

Feature-modular NestJS. Each feature under `src/modules/` is a self-contained module with `*.controller.ts`, `*.service.ts`, `*.module.ts`, and `dto/`:

```
src/modules/
  auth/           Telegram login, JWT strategy, dev login
  users/          User CRUD and profile
  tutors/         Read-only tutor profile aggregation
  education/      subjects/ teachers/ teacher-subjects/ groups/ (sub-modules)
  marketplace/    services/ requests/ service-responses/ request-responses/ deals/
  reviews/        Reviews on completed deals
  notifications/  Telegram bot + notification senders (no controller)
  parser/         University-data sync in a worker thread
```

Shared code lives in `src/common/` (decorators, guards, pipes, filters, interceptors, exceptions, DTOs, `BaseService`) and is imported via the `@common` path alias (`tsconfig.json`).

## Request lifecycle

Every HTTP request passes through, in order:

0. **`requestIdMiddleware`** (applied to every route in `AppModule.configure`, so prod and e2e get it alike) — takes `X-Request-Id` from the request (letters, digits, `_`, `-`, up to 128 chars) or generates a UUID, stores it on `request.requestId` and echoes it in the `X-Request-Id` response header.
1. **`ThrottlerGuard`** (global `APP_GUARD`, registered before the JWT guard) — 100 requests per minute per IP (`ThrottlerModule.forRoot` in `src/app.module.ts`); `POST /auth/telegram` is tightened to 10 via `@Throttle`. `main.ts` sets `trust proxy` so the client IP comes from Caddy's `X-Forwarded-For`. Over the limit → 429.
2. **`JwtAuthGuard`** (global `APP_GUARD`) — requires a Bearer JWT unless the handler or controller is marked `@Public()`. On success, `request.user` is the full Prisma `User` (loaded by `src/modules/auth/strategies/jwt.strategy.ts`); read it with `@CurrentUser()`.
3. **`ValidationPipe`** (`createValidationPipe()` from `src/common/pipes/validation.pipe.ts`, used by `main.ts` and the e2e app) — `transform` + `whitelist` + `forbidNonWhitelisted`: unknown fields are rejected, DTOs are class instances. Its `exceptionFactory` throws `RequestValidationException` (400, `VALIDATION_ERROR`) with a Russian `message` about the first failing field (`«Срок: нужна дата — …»`), plus `field` and the full `errors: [{ field, message }]`. Russian messages written in decorators (`@Min(100, { message: '…' })`) are kept as is.
4. **Controller → Service** — controllers stay thin (routing, ownership checks, Swagger decorators); business logic and Prisma queries live in services.
5. **`TransformInterceptor`** (global `APP_INTERCEPTOR`) — wraps every successful response:

```json
{
  "data": {},
  "message": "Operation successful",
  "success": true,
  "timestamp": "..."
}
```

6. **`GlobalExceptionFilter`** — converts `BusinessException` subclasses and `HttpException`s into a standard error shape (`statusCode`, `error`, `message`, `path`, `method`, `timestamp`, `requestId`; validation errors add `field` and `errors`). Prisma's unique-key violation (`P2002`, e.g. two identical requests racing) becomes 409 `CONFLICT` and a vanished record (`P2025`) 404. Anything else — including `PrismaClientValidationError`, which means a DTO let bad input through — is a server bug: 500 with `«Внутренняя ошибка сервера. Попробуйте позже»`, logged with the stack, `requestId`, URL, method and user.

## Configuration

`ConfigModule.forRoot({ isGlobal: true })` loads three `registerAs` configs, each validated with zod at startup — invalid or missing values crash the boot:

- `app.config.ts` — `PORT`, `NODE_ENV`, `TELEGRAM_BOT_TOKEN` (**required in production**, boot fails without it), `FRONTEND_BASE_URL`
- `database.config.ts` — `DATABASE_URL` (falls back to assembling one from `DB_HOST`/`DB_USER`/... parts)
- `jwt.config.ts` — `JWT_SECRET` (min 32 chars, enforced), `JWT_EXPIRES_IN` (default `7d`)

Read values via `configService.get('app.port')` etc. Full variable list: [reference/environment-variables.md](reference/environment-variables.md).

## Database access

`DatabaseService` extends `PrismaClient` directly and connects/disconnects on module init/destroy. Services inject it and call `this.db.user.findUnique(...)` — there is no repository layer. Details: [database-and-migrations.md](database-and-migrations.md).

## Swagger

Non-production only, served at `/api/docs` with `persistAuthorization`. Controllers use `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` and the project's `@ApiSuccessResponse` decorator (`src/common/decorators/api-response.decorator.ts`). Every new endpoint must carry Swagger decorators — this is a hard rule (see `docs/workflow/hard-rules.md`).

## Deployment

`docker-compose.yml` runs three services:

| Service    | Role                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `postgres` | PostgreSQL 15 with a healthcheck                                                                                             |
| `app`      | Multi-stage Node 18 build (`DockerFile` — note the capital F); entrypoint runs `npx prisma migrate deploy && node dist/main` |
| `caddy`    | Reverse proxy on 80/443 (`Caddyfile`), proxies to `app:3000`, handles CORS/OPTIONS                                           |

Migrations are applied automatically on container start via `migrate deploy`.

## Common mistakes

- Adding an endpoint and forgetting `@Public()` on routes that must work without a token — the global guard rejects them
- Returning manually-wrapped `{ success, data }` objects from controllers — `TransformInterceptor` already wraps everything; return the payload itself
- Reading `process.env` directly in feature code — go through `ConfigService` and the zod-validated configs
