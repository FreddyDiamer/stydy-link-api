# Workflow Zone

**Read this zone first, before any task.** It owns the rules of working in this repository: what is forbidden, how each task type is done, and what "done" means.

## The task lifecycle

1. **Analyze** — understand the request; read the relevant docs from [the development zone](../development/INDEX.md) and the code
2. **Clarify** — if the request is ambiguous or contradicts the code, ask the user before writing code
3. **Implement** — follow the matching playbook in [task-playbooks.md](task-playbooks.md) and the [hard rules](hard-rules.md)
4. **Verify** — run through [post-change-checklist.md](post-change-checklist.md)
5. **Document** — update the docs the checklist points at

## Files

| File                                                 | What it covers                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| [hard-rules.md](hard-rules.md)                       | Non-negotiable rules; violating one means the change is not acceptable |
| [task-playbooks.md](task-playbooks.md)               | Step-by-step recipes: new endpoint, schema change, bug fix, new module |
| [post-change-checklist.md](post-change-checklist.md) | Definition of done — run it before declaring any change complete       |

## Automation in this repo

Configured in `.claude/` — active for every Claude Code session here:

| Mechanism             | What it does                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SessionStart hook     | Injects current branch + a pointer to this zone at session start                                                                  |
| PreToolUse hook       | Blocks `git commit --no-verify` (hard rule 1 is enforced, not just written)                                                       |
| PostToolUse hook      | Runs `eslint --fix` on every edited `src/**/*.ts` file                                                                            |
| Stop hook             | Type-checks changed `.ts` files (`tsc --noEmit`) when a turn ends; failures send the agent back to fix them                       |
| Permissions           | Read-only git/lint/build/prisma-status commands pre-approved; `prisma migrate reset`, `prisma db push`, `git push --force` denied |
| `/verify` command     | Smoke-check: dev server, dev-auth token, one read endpoint per domain (`.claude/commands/verify.md`)                              |
| `code-reviewer` agent | Read-only diff review against hard rules and conventions (`.claude/agents/code-reviewer.md`)                                      |

## Other zones

| Zone             | When to read             | Entry point                                                  |
| ---------------- | ------------------------ | ------------------------------------------------------------ |
| development      | Touching any code        | [../development/INDEX.md](../development/INDEX.md)           |
| testing          | Writing or running tests | [../testing/INDEX.md](../testing/INDEX.md)                   |
| ai-documentation | Writing or editing docs  | [../ai-documentation/INDEX.md](../ai-documentation/INDEX.md) |
