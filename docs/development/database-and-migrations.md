# Database and Migrations

Prisma 6 over PostgreSQL: where the schema lives, how to change it safely, and the schema conventions to keep.

## Key files

| File                               | Purpose                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `prisma/schema.prisma`             | The whole schema: 18 models, 5 enums, Russian comments                 |
| `prisma/migrations/`               | Migration history — one folder per migration, applied in order         |
| `prisma/seed.ts`                   | Seed script (`pnpm run prisma:seed`)                                   |
| `src/database/database.service.ts` | `DatabaseService extends PrismaClient`, injected into services as `db` |

## Model map

- **Core:** `User` (acts as both tutor and student; no separate role tables)
- **Education reference data:** `Subject`, `Teacher`, `Group` + join tables `TeacherSubject`, `GroupSubject`, `GroupSubjectTeacher` — populated by the parser ([domains/parser.md](domains/parser.md))
- **Marketplace:** `Service`, `Request`, `ServiceResponse`, `RequestResponse`, `Deal` ([domains/marketplace.md](domains/marketplace.md))
- **Feedback:** `Review` (one-to-one with `Deal`)

## Changing the schema

1. Edit `prisma/schema.prisma`
2. Create the migration — this also regenerates the client:

```bash
npx prisma migrate dev --name short_snake_case_description
```

3. Commit the schema change **and** the new folder under `prisma/migrations/` together

Editing the schema without creating a migration is a hard-rule violation (`docs/workflow/hard-rules.md`): production applies `npx prisma migrate deploy` on container start, so an unmigrated schema change silently never reaches the database.

If only the client is stale (e.g. after pulling someone else's migration): `npx prisma generate`.

## Seed

`pnpm run prisma:seed` fills a **local** database with demo data. It throws before any write when `NODE_ENV=production`; the Docker entrypoint never calls it.

| Block          | Rows                                                                                                                             | Found by                                                                                    | On re-run                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| Users          | 5 tutors + 3 students (`anna_math` … `student_pavel`)                                                                            | `telegramId`                                                                                | profile and balance reset |
| Reference data | 18 subjects, 10 teachers (`teacher_001`…), their `TeacherSubject` links, 8 groups (`seed_group_4101`…)                           | `name` / `foreignId`                                                                        | untouched                 |
| Marketplace    | 8 services, 6 requests, 15 responses, 7 deals (`PENDING`, `ACCEPTED`, one-side-confirmed, 3 `COMPLETED`, `CANCELLED`), 5 reviews | fixed ids (`5eed0001-…` services, `5eed0002-…` requests), then the schema's `@@unique` keys | untouched (`update: {}`)  |

Log in as a seed user with `POST /auth/dev/login` and the `userId` the seed prints. Marketplace rows mirror what the API produces: every deal hangs off an `ACCEPTED` response, and its price and deadline follow the `accept()` fallbacks. Groups are seeded only so the profile's group picker is not empty locally (`seed_group_*` foreign ids never collide with the university's); real groups and all group links (`GroupSubject`, `GroupSubjectTeacher`) come from the parser ([domains/parser.md](domains/parser.md)).

When adding demo rows, extend the `demoServices` / `demoRequests` arrays in `prisma/seed.ts` and give each new service or request its own fixed id. `IN_PROGRESS` deals are not seeded: no code path produces that status.

## Schema conventions

- IDs are `String @id @default(uuid())`
- Tables are mapped to snake_case plural with `@@map("users")`; model names stay PascalCase singular
- Every model has `createdAt @default(now())` and `updatedAt @updatedAt`
- Money columns are `Int` in kopecks
- Duplicates are prevented with `@@unique` (e.g. one response per `[studentId, serviceId]`, unique `Subject.name`, unique `Teacher.foreignId`)
- Relations to `User` and other owners use `onDelete: Cascade`; reference-data relations (subject/teacher on services) do not cascade
- External-system rows (`Teacher`, `Group`) carry `foreignId` (unique) plus a free-form `data Json?` payload

## Common mistakes

- Running `prisma migrate dev` against a shared/production `DATABASE_URL` — check `.env` first; dev migrations can reset data on drift
- Forgetting `npx prisma generate` after switching branches with different schemas — the compiled types silently lag behind
- Adding a money column as `Float` or `Decimal` — this project stores kopecks as `Int`
