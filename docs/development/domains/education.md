# Education

Reference data the marketplace is built on: subjects, teachers, university groups, and the join tables linking them. Mostly written by the parser, read by everything else.

## Key files

| File                                      | Purpose                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `src/modules/education/subjects/`         | Subject reads + stats (API is read-only; writes live in service) |
| `src/modules/education/teachers/`         | Teacher reads, teachers-by-subject, stats                        |
| `src/modules/education/teacher-subjects/` | `TeacherSubject` link reads + stats                              |
| `src/modules/education/groups/`           | Group reads (minimal)                                            |

## Data model

- `Subject` — unique `name`, `isActive` flag; inactive subjects are hidden from form selectors (`GET /education/subjects/active`)
- `Teacher` — `fullName`, unique `foreignId` (ID in the university's external system), free-form `data Json?`
- `Group` — `number` (e.g. "4312"), unique `foreignId`, `data Json?`; users reference a group via `User.groupId`
- Join tables, each with `isActive` and a composite `@@unique`:
  - `TeacherSubject` — which teachers teach which subjects (drives service/request form selectors)
  - `GroupSubject` — which subjects a group studies
  - `GroupSubjectTeacher` — the full triple: this group has this subject with this teacher

## Where the data comes from

The parser ([parser.md](parser.md)) upserts `Group`, `Subject`, `Teacher`, `GroupSubject`, `GroupSubjectTeacher` from the university API, matching on `foreignId`. The HTTP API is read-only — write endpoints were removed because without a role system any user could rewrite the catalog; the service-layer create/update/remove methods remain for the parser and future admin tooling. `foreignId` and `data` are university-specific — the product currently serves KAI but is designed to onboard other universities on the same codebase, so keep university-specific assumptions inside `data`, not in new columns.

## Deletion rules

`Subject`, `Teacher`, and `TeacherSubject` deletes are refused while the row is referenced by services/requests/deals ("only if unused"). Prefer `deactivate` over delete for anything the parser manages — the next sync may recreate deleted rows.

## Common mistakes

- Creating teachers or groups by hand without a `foreignId` strategy — the parser matches on `foreignId` and may duplicate manual rows
- Filtering selectors by all subjects instead of active ones — use the `/active` endpoints
