# Task: <slug>

> Copy this file, rename to your task slug, fill in each section, delete unused sections.

## Goal
One sentence describing what done looks like.

## Why
One short paragraph on the user-facing or business reason. Helps Codex pick reasonable defaults if it has to.

## Files to modify
- `client/src/path/to/file.tsx` — what changes (1-2 sentences)
- `client/src/path/to/other.ts` — what changes

## Files to create
- `client/src/path/to/new.tsx` — full purpose. List exports, props (with types), behavior.

## Files to delete
- `client/src/path/to/old.tsx` — reason

## Constraints
- Inherits from `AGENTS.md` (no em dashes, brand colors, no new deps, etc.)
- Add task-specific constraints here only if they go beyond AGENTS.md

## Reference patterns
- Component to mimic: `client/src/components/<file>.tsx`
- Data shape to match: `client/src/lib/<file>.ts`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] Specific behavior: when X happens, Y appears
- [ ] No console errors in browser dev mode
- [ ] <task-specific check>

## Out of scope
What NOT to touch. Helps Codex avoid wandering.

## Notes for Codex
Any non-obvious context (existing bugs to work around, why a weird approach is intentional, etc.)
