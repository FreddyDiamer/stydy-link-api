# Doc Style

Tone and voice rules for agent-targeted docs. Applies to everything under `docs/` and to `CLAUDE.md`.

## Voice

- Direct and imperative: "Run `pnpm run build`", not "You might want to consider running the build"
- Third person about the system: "The guard rejects requests without a token", never "we reject" / "our guard"
- English only in `docs/` — Russian belongs in user-facing strings inside the code

## What to leave out

- History and changelog notes ("previously this was...", "as of the last refactor...") — git history owns that
- Alternatives that were not chosen and reasoning tours — state the rule, not the debate
- Marketing language ("powerful", "robust", "seamless")
- Hedging ("probably", "should be fine") — verify, then state facts; if genuinely unknown, say "unverified"

## Formatting

- Specify a language on every code block: ` ```typescript `, ` ```bash `
- Tables for enumerable facts (files, endpoints, env vars); prose for flows and reasoning
- Bold sparingly, for the one load-bearing phrase in a section
- No emoji except ✅/⚠️ in status-like tables

## Voice check

Before committing a doc, scan it for:

1. Any sentence starting with "We" or "Our" → rewrite in third person
2. Any paragraph explaining why the doc exists → delete it; the INDEX hook covers that
3. Any code block without a language tag → add one
4. Any claim you did not verify against the code → verify or mark unverified
