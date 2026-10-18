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

`pnpm test` runs **16 unit suites (185 tests)** covering auth, deals, requests, both response flows, services, reviews and user privacy — they mock the Prisma layer, so no database is needed. `pnpm run test:e2e` adds **19 HTTP-level tests** against a real Postgres (setup in [testing-status.md](testing-status.md)).

Uncovered areas — education, parser and notification delivery — still need lint, build, and manual endpoint checks against a running dev server (Swagger at `/api/docs`).
