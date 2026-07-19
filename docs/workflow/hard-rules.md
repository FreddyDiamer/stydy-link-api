# Hard Rules

Non-negotiable. A change that violates one of these is not acceptable, regardless of what else it achieves.

## 1. Git

Day-to-day work happens directly on `main`. For a large or risky change (schema migrations touching existing data, refactors across modules, anything hard to revert) create a branch and **ask the user before merging into `main`**. Never commit with `--no-verify` — the Husky pre-commit hook (lint-staged: eslint + prettier) must run.

## 2. Money is integer kopecks

Every money value (`balance`, `price`, `budget`) is an `Int` in kopecks. Never floats, never rubles, in code or in the schema.

## 3. User-facing text is Russian

Bot notifications, business-error messages, and Swagger summaries are written in Russian. Code identifiers and docs stay English.

## 4. No mass reformatting

Never run project-wide prettier/eslint sweeps or reformat lines you did not otherwise change. Diffs must contain only the task's changes.

## 5. Schema changes ship as migrations

Editing `prisma/schema.prisma` without running `npx prisma migrate dev --name ...` and committing the generated migration is forbidden — production applies migrations with `migrate deploy` on container start, so a schema-only edit never reaches the database. See [database-and-migrations.md](../development/database-and-migrations.md).

## 6. Endpoints ship with Swagger and docs

A new or changed endpoint carries `@ApiOperation`/`@ApiTags`/`@ApiBearerAuth` (or `@Public()`) decorators, and the same change updates [api-endpoints.md](../development/reference/api-endpoints.md).
