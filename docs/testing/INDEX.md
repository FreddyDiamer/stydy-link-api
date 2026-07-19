# Testing Zone

The state of testing in this project and the conventions to follow when tests are written.

## When to read this zone

- You are about to write tests
- A task asks to "run the tests" and you need to know what exists

## Files

| File                                   | What it covers                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| [testing-status.md](testing-status.md) | Current state (no tests yet), the configured tooling, and conventions for future tests |

## The short version

**There are no tests yet.** Jest + ts-jest + supertest are configured and `pnpm test` runs, but zero `.spec.ts` files exist. Do not claim test coverage as verification — verify changes by lint, build, and exercising endpoints against a running dev server (Swagger at `/api/docs`).
