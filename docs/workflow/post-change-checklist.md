# Post-Change Checklist

Definition of done. Run through this before declaring any code change complete.

1. **Lint passes:** `pnpm run lint:check` — no errors on the files you touched
2. **Build passes:** `pnpm run build`
3. **Schema is consistent:** if you touched `prisma/schema.prisma`, the migration exists in `prisma/migrations/` and `npx prisma generate` has been run
4. **Swagger is complete:** new/changed endpoints carry `@ApiOperation` and auth decorators; check them at `http://localhost:3000/api/docs` if the dev server is running
5. **Docs are current:**
   - endpoint changes → [api-endpoints.md](../development/reference/api-endpoints.md)
   - env variable changes → [environment-variables.md](../development/reference/environment-variables.md)
   - behavior changes in a domain → the matching doc in `docs/development/domains/`
   - new doc created → one-line entry in that zone's `INDEX.md`
6. **Diff is clean:** only the task's changes, no drive-by reformatting, no leftover debug output
7. **Report honestly:** if any step above failed or was skipped, say so explicitly instead of declaring done
