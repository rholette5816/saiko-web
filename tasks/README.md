# Tasks

This folder holds task specs that Claude (planner) writes for Codex (executor).

## How it works

```
You (request feature)
       ↓
Claude writes tasks/<slug>.md
       ↓
You run: codex exec --full-auto "Read tasks/<slug>.md and execute"
       ↓
Codex makes the changes, runs acceptance checks, reports back
       ↓
Claude reviews + commits, or writes a follow-up spec
```

## Conventions

- One spec per task. Use kebab-case filenames: `add-loyalty-banner.md`
- Specs are committed to git as a permanent record of what was built and why
- Once a task is shipped and verified, the spec stays. It's the changelog.
- Use `_template.md` as the starting point for every new spec.

## Routing rule (Claude follows this)

| Task shape | Goes to |
|---|---|
| Pure mechanical (rename, mass field add, regex sweep, scaffold component matching pattern) | Codex via task spec |
| Mixed (some mechanical + judgment) | Claude writes copy/decisions, Codex injects them |
| Pure judgment (UX flow, copy, design tradeoff, debugging unclear failures) | Claude inline |

If a task touches 3+ files of the same pattern, default to writing a spec instead of inline edits.
