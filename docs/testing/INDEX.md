# Testing Zone

The state of testing in this project and the conventions to follow when tests are written.

## When to read this zone

- You are about to write tests
- A task asks to "run the tests" and you need to know what exists

## Files

| File                                   | What it covers                                                          |
| -------------------------------------- | ----------------------------------------------------------------------- |
| [testing-status.md](testing-status.md) | What the suite covers today, the tooling, and the conventions to follow |

## The short version

`pnpm test` runs **6 unit suites (87 tests)** covering auth, deals, reviews, both response flows, and user privacy. They mock the Prisma layer, so no database is needed.

Uncovered areas — service/request listings, education, parser, notifications, and anything HTTP-level — still need lint, build, and manual endpoint checks against a running dev server (Swagger at `/api/docs`).
