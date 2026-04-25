# Codex Project Rules — Saiko Web

You are working on the Saiko Ramen & Sushi marketing site. Claude (Opus) plans, you execute.
You will usually be invoked with `codex exec --full-auto "Read tasks/<slug>.md and execute the plan exactly. Run acceptance checks at the end and report results."`

## How to work

1. Open the spec at `tasks/<slug>.md`. Treat it as the source of truth.
2. Make exactly the changes listed. No extras. No "while you're at it" cleanup.
3. Run the acceptance checks at the bottom of the spec.
4. Report what you changed and the check results. If a check fails, do not retry blindly. Stop and report.
5. If the spec is ambiguous, do nothing and report what's unclear. Never guess on judgment calls (copy, design choices, naming).

## Project conventions

### Stack
- React 19 + TypeScript + Vite
- Tailwind CSS 4 with arbitrary value classes (`bg-[#ac312d]`)
- Routing: wouter (`Link`, `useLocation`, `Switch`, `Route`)
- Icons: lucide-react
- Path alias: `@/` maps to `client/src/*`
- Static deploy on Vercel via `vercel.json`

### Brand colors (use these literal hex values, no other reds/oranges)
- `#ac312d` Appetite Red — CTAs and accents only
- `#0d0f13` Saiko Black — foundation, dark sections
- `#c08643` Broth Gold — accents, small text, dividers
- `#e88627` Logo Orange — warmth gradient, badge highlights
- `#f5a24b` Amber — secondary warmth
- `#ebe9e6` Cream — section backgrounds
- `#705d48` Brown — body text on light backgrounds
- `#ffffff` White

### Typography
- Headings: `font-poppins` Bold, `uppercase tracking-wide` for section H2s
- Body: Inter (default)
- Display: `font-display` Playfair Display (italic blockquotes only)

### Copy rules (non-negotiable)
- **No em dashes (—) or en dashes (–) anywhere.** Use periods, commas, or "to" for ranges.
- **No emojis in user-facing copy** unless the spec explicitly says to use one.
- Direct, owner-voice. No "we believe", no "passionate". Pair every claim with a proof.
- Taglish only where the spec marks it. Don't insert it on your own judgment.
- Filipino currency: `₱123` or `PHP 123`, no decimals.

### File structure
- Pages: `client/src/pages/*.tsx`
- Components: `client/src/components/*.tsx`
- Library / hooks / data: `client/src/lib/*.ts(x)`
- Assets: `client/src/assets/` (imported) or `client/public/` (static URLs)

### Component patterns
- Prefer named exports: `export function FooSection() {}`
- Always use `Link` from wouter for internal navigation, never `<a href="/path">` for routes
- Use `<a>` only for external URLs, `tel:`, `mailto:`, or hash anchors
- Image imports: `import foo from "@/assets/images/foo.png"` then `<img src={foo} />`
- Below-fold images: `loading="lazy" decoding="async"`
- Hero/critical images: `loading="eager" fetchPriority="high"`

## Hard limits

- **Do not add npm dependencies** unless the spec explicitly lists them.
- **Do not modify `package.json`, `vite.config.ts`, `tsconfig.json`, or `vercel.json`** unless the spec says so.
- **Do not delete files** unless the spec lists them under "Files to delete".
- **Do not run `npm install`** unless installing a dependency listed in the spec.
- **Do not commit** unless the spec says to. Claude handles commits.
- **Do not push to git** ever. Claude handles pushes.

## Verification

After every change, run these unless the spec overrides:

```bash
# 1. No em or en dashes anywhere
grep -rn "[—–]" client/src && echo "FAIL: dashes found" || echo "PASS: no dashes"

# 2. TypeScript compiles
npx tsc --noEmit

# 3. Build succeeds (only if spec says deploy-bound)
# pnpm build
```

Report results in this format:
```
SPEC: tasks/<slug>.md
CHANGES:
  - modified: <file>
  - created: <file>
  - deleted: <file>
CHECKS:
  - dashes: PASS
  - tsc: PASS
  - <custom check from spec>: PASS/FAIL
NOTES: <anything Claude should know on review>
```

## When to bounce back to Claude

Stop and report instead of guessing if you encounter:
- Two valid ways to implement and the spec doesn't say which
- A copy choice not provided in the spec
- A build error whose fix isn't obvious from the error message
- A file that doesn't match what the spec described (drift)
- Anything that would require touching files outside the spec's scope

## Existing patterns to mimic

- New section component: see `client/src/components/FeaturedSection.tsx`
- New page: see `client/src/pages/Menu.tsx`
- Form with submit + Formspree: see `client/src/components/LocationSection.tsx`
- Cart-aware component: see `client/src/components/AddToCartButton.tsx`
- Live time-based UI: see `client/src/components/OpenStatusBadge.tsx` + `client/src/lib/hours.ts`
