# Environment Variables

Every variable the app reads, and how the zod-validated configs (`src/config/`) treat it. Template: `.env.example`; local values: `.env` (never commit).

## App variables

| Variable             | Purpose                                                                                    | Validation / default                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                                                               | Must be a valid URL; if unset, assembled from `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` fallbacks (`database.config.ts`)                             |
| `JWT_SECRET`         | JWT signing secret                                                                         | **Min 32 chars** — shorter crashes the boot (`jwt.config.ts`)                                                                                                    |
| `JWT_EXPIRES_IN`     | Token lifetime                                                                             | Default `7d`                                                                                                                                                     |
| `TELEGRAM_BOT_TOKEN` | Validates Telegram `initData`; sends bot notifications                                     | **Required for Telegram login in every env** (login is rejected without it; only dev mock `initData` bypasses); required in production at boot (`app.config.ts`) |
| `FRONTEND_BASE_URL`  | Base URL for Mini App deep links in notifications                                          | Optional; must be a valid URL if set                                                                                                                             |
| `ADMIN_TELEGRAM_IDS` | Telegram IDs (comma-separated) allowed to run admin operations — the parser (`AdminGuard`) | Default empty — **nobody** is admin, `/parser/*` answers 403                                                                                                     |
| `PORT`               | HTTP port                                                                                  | Default `3000`                                                                                                                                                   |
| `NODE_ENV`           | `development` / `production` / `test`                                                      | Default `development`; gates Swagger, CORS, dev auth, mock `initData`                                                                                            |

Compose has no insecure fallbacks: `POSTGRES_PASSWORD`, `JWT_SECRET`, and `TELEGRAM_BOT_TOKEN` must be set or `docker compose up` fails. Postgres (5432) and the app port bind to `127.0.0.1` only — external traffic goes through Caddy.

## Adding a variable

1. Add it to the matching config in `src/config/` with a zod rule (or create a new `registerAs` config and register it in `app.module.ts`)
2. Add it to `.env.example` with a placeholder value
3. If the app container needs it, pass it through in `docker-compose.yml`
4. Add a row to this table
