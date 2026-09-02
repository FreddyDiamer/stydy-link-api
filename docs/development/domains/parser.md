# Parser

Fetches groups, subjects, and teachers from the university's API and syncs them into the education tables. Runs in a separate worker thread so a long parse never blocks the HTTP event loop.

## Key files

| File                                                 | Purpose                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/modules/parser/parser.controller.ts`            | `POST /parser/sync` (awaits result) and `POST /parser/async` (background) — JWT required |
| `src/modules/parser/services/parser.service.ts`      | Spawns the worker, 30-minute timeout, single-run lock, returns `ParseResultDto`          |
| `src/modules/parser/workers/main-parser.worker.ts`   | Worker entrypoint (`worker_threads`)                                                     |
| `src/modules/parser/workers/utils/kai-api-client.ts` | HTTP client for the university (KAI) API                                                 |
| `src/modules/parser/workers/utils/parser-pool.ts`    | Parallelizes fetching across groups                                                      |
| `src/modules/parser/workers/utils/sync-service.ts`   | Upserts into `Group`, `Subject`, `Teacher`, `GroupSubject`, `GroupSubjectTeacher`        |

## How it runs

1. `ParserService.parseAndSync()` spawns the worker: in dev it loads the `.ts` worker via ts-node; in production it runs the compiled `.js` from `dist/`. Keep this dual path in mind when renaming worker files — the path is resolved at runtime.
2. The worker fetches groups, then per-group subjects and teachers through the parser pool.
3. `sync-service` upserts rows matching on `foreignId` (see [education.md](education.md)); university-specific extras go into the `data Json?` column.
4. The parse has a **30-minute timeout**; on timeout the worker is terminated and the sync fails.

`POST /parser/sync` blocks until done (minutes); `POST /parser/async` returns `{ message: 'Parsing started' }` immediately (its worker errors are logged, not thrown). Both require a JWT, and only one sync runs at a time — a second call returns `409 PARSER_BUSY`.

## Multi-university note

The client is KAI-specific today (`kai-api-client.ts`), but the schema is university-agnostic (`foreignId` + `data`). A new university means a new API client + parser implementation feeding the same `sync-service` contract — not new columns.

## Common mistakes

- Calling `/parser/sync` casually against a real database — it mass-upserts reference data
- Editing worker file paths or names without checking `parser.service.ts` — the dev/prod worker resolution breaks silently
- Doing DB writes in the worker outside `sync-service` — keep the upsert contract in one place
