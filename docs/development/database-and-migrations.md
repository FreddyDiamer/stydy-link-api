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
