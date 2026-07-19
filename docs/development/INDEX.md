# Development Zone

Everything needed to read and change the code: architecture, conventions, database, per-domain docs, and reference tables.

## When to read this zone

- Implementing a feature, fixing a bug, touching any code
- Looking up an endpoint, an env variable, or how a domain works

## Files

| File                                                     | What it covers                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [architecture.md](architecture.md)                       | Module layout, request lifecycle, global guard/pipe/interceptor/filter, config, deployment |
| [conventions.md](conventions.md)                         | Code style and project rules: errors, DTOs, money, language, ownership checks              |
| [database-and-migrations.md](database-and-migrations.md) | Prisma schema, migration workflow, seed                                                    |

### Domain docs (`domains/`)

| File                                           | Domain                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| [auth-and-users.md](domains/auth-and-users.md) | Telegram auth, JWT, dev login, users, tutor profiles              |
| [education.md](domains/education.md)           | Subjects, teachers, groups and their join tables (reference data) |
| [marketplace.md](domains/marketplace.md)       | Services, requests, responses, deals, reviews — the core loop     |
| [notifications.md](domains/notifications.md)   | Telegram bot notifications on marketplace events                  |
| [parser.md](domains/parser.md)                 | University-data parser running in a worker thread                 |

### Reference (`reference/`)

| File                                                           | What it covers                                         |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| [api-endpoints.md](reference/api-endpoints.md)                 | Full endpoint table, verified against controllers      |
| [environment-variables.md](reference/environment-variables.md) | Every env variable and how config validation treats it |

## Pattern → doc shortcuts

| You see in code                                                      | Read                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `@Public()`, `JwtAuthGuard`, `@CurrentUser()`                        | [auth-and-users.md](domains/auth-and-users.md)           |
| `TransformInterceptor`, `GlobalExceptionFilter`, `BusinessException` | [architecture.md](architecture.md)                       |
| `BaseService`, `PaginationDto`, `@common` imports                    | [conventions.md](conventions.md)                         |
| `DatabaseService`, `prisma/schema.prisma`                            | [database-and-migrations.md](database-and-migrations.md) |
| `notifyDealCreated`, `TelegramBotService`                            | [notifications.md](domains/notifications.md)             |
| `worker_threads`, `main-parser.worker`                               | [parser.md](domains/parser.md)                           |
