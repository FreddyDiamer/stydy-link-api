# Task Playbooks

Step-by-step recipes per task type. Each assumes you have read [hard-rules.md](hard-rules.md); each ends with the [post-change checklist](post-change-checklist.md).

## New endpoint

1. Read [architecture.md](../development/architecture.md) (request lifecycle) and the domain doc for the module you are touching
2. Add/extend a DTO in the module's `dto/` folder — class-validator + Swagger decorators on every field
3. Add the controller method: thin, with `@ApiOperation` (Russian summary), ownership check via `@CurrentUser()` if it mutates; `@Public()` only if it genuinely needs no auth
4. Put the logic in the service; throw `@common` exceptions, not raw errors
5. If the change should notify the counterparty, add a `void this.notificationService.notifyX(...)` call ([notifications.md](../development/domains/notifications.md))
6. Update [api-endpoints.md](../development/reference/api-endpoints.md)

## Prisma schema change

1. Read [database-and-migrations.md](../development/database-and-migrations.md)
2. Edit `prisma/schema.prisma` following the schema conventions (uuid ids, `@@map`, timestamps, `Int` kopecks for money)
3. `npx prisma migrate dev --name short_snake_case_description` against your **local** database
4. Commit schema + migration folder together; update the affected domain doc

## Bug fix

1. Reproduce or at least trace the bug in code before changing anything
2. Fix the root cause, not the symptom; keep the diff minimal
3. If the bug contradicts a doc under `docs/`, fix the doc in the same change

## New feature module

1. Read [architecture.md](../development/architecture.md) — mirror the existing module shape: `*.module.ts`, `*.controller.ts`, `*.service.ts` (extends `BaseService`), `dto/`
2. Register the module in `src/app.module.ts`
3. Follow the "New endpoint" playbook for each route
4. Write a new domain doc in `docs/development/domains/` and add it to the [development INDEX](../development/INDEX.md) — see the [ai-documentation zone](../ai-documentation/INDEX.md) for the skeleton
