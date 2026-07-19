# Environment Variables

Every variable the app reads, and how the zod-validated configs (`src/config/`) treat it. Template: `.env.example`; local values: `.env` (never commit).

## App variables

| Variable             | Purpose                                                | Validation / default                                                                                                                 |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`       | PostgreSQL connection string                           | Must be a valid URL; if unset, assembled from `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` fallbacks (`database.config.ts`) |
| `JWT_SECRET`         | JWT signing secret                                     | **Min 32 chars** — shorter crashes the boot (`jwt.config.ts`)                                                                        |
| `JWT_EXPIRES_IN`     | Token lifetime                                         | Default `7d`                                                                                                                         |
| `TELEGRAM_BOT_TOKEN` | Validates Telegram `initData`; sends bot notifications | Optional in dev (validation/sends skipped); **required in production** — boot fails without it (`app.config.ts`)                     |
| `FRONTEND_BASE_URL`  | Base URL for Mini App deep links in notifications      | Optional; must be a valid URL if set                                                                                                 |
| `PORT`               | HTTP port                                              | Default `3000`                                                                                                                       |
| `NODE_ENV`           | `development` / `production` / `test`                  | Default `development`; gates Swagger, CORS, dev auth, mock `initData`                                                                |

## Docker-only variables (`docker-compose.yml`)

| Variable                                              | Purpose                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Provision the `postgres` container; compose builds the app's `DATABASE_URL` from them |

## Adding a variable

1. Add it to the matching config in `src/config/` with a zod rule (or create a new `registerAs` config and register it in `app.module.ts`)
2. Add it to `.env.example` with a placeholder value
3. If the app container needs it, pass it through in `docker-compose.yml`
4. Add a row to this table
