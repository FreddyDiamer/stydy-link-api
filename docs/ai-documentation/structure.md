# Doc Structure

The mandatory skeleton and file conventions for every agent-targeted doc in `docs/`.

## File naming

- Lowercase kebab-case: `api-endpoints.md`, `auth-and-users.md`
- The `#` title inside the file is Title Case: `# API Endpoints`
- One topic per file; if a doc grows past its length target, split it and update the INDEX

## Skeleton

Every doc follows this order (skip sections that do not apply):

1. `# Title`
2. **One-line opener** — states what the doc covers, so an agent can confirm in one glance that it is in the right place
3. **Key files table** (`| File | Purpose |`) — only when the doc covers code; this is the "where do I look" shortcut
4. **Content sections** — concepts, flows, patterns; small TypeScript examples where they help
5. **Common mistakes** — optional bullet list of traps
6. **Checklist** — optional numbered list for task-like docs

## Length targets

| Doc kind                               | Target                                 |
| -------------------------------------- | -------------------------------------- |
| INDEX.md                               | 30–80 lines, routing only — no content |
| Architecture / pattern docs            | 100–200 lines                          |
| Domain docs                            | 50–150 lines                           |
| Reference tables (endpoints, env vars) | as long as needed                      |
| Playbooks                              | 10–30 lines each                       |

## Links

- Always use relative links between docs: `[architecture.md](../development/architecture.md)`
- Link source files with repo-relative paths in backticks: `src/main.ts`
- Verify links still resolve after moving or renaming files

## The INDEX rule

When you create a doc, add a one-line entry to the zone's `INDEX.md` in the same change:

```markdown
| [new-doc.md](new-doc.md) | One-line hook saying when to read it |
```

When you delete or rename a doc, update the INDEX in the same change. An unlinked doc is invisible to future agents.

## Common mistakes

- Putting real content into an INDEX.md — INDEX files route, they do not teach
- Duplicating content between docs — link to the owning doc instead
- Describing code in more detail than the code itself — docs explain intent, flows, and traps; the code shows the rest
