# Task: fix-mobile-cart

## Goal
Fix five mobile responsive issues in the cart and order flow so the floating cart button doesn't obscure hero content, the bottom action bar respects iPhone safe-area, and menu item rows don't break layout when the qty stepper appears.

## Why
On phones (especially iPhone X+ with notch and home indicator) the cart UI has overlap and squashed-content bugs:
1. The top-right floating cart button covers part of the hero on narrow screens because it's a wide pill ("Cart" text + count) anchored to the top.
2. `pb-safe` is referenced in `MobileActionBar` but the utility is not defined anywhere. iPhone home indicator squashes the bottom row of the action bar.
3. When a menu item is added to the cart, the small `Add` pill swaps for a wider qty stepper. The right-side column has no min-width, so the stepper can push the title/description column or wrap awkwardly on 360-390px viewports.
4. The CartDrawer footer (Subtotal + Checkout) sits flush against the iPhone home indicator.
5. Page bottom padding `pb-16` (64px) is too tight to fully clear the MobileActionBar (which has icons + text + safe-area inset on iPhones), so the last bit of page content can be obscured.

## Files to modify

### 1. `client/src/components/CartButton.tsx`
The `CartButton` (mobile floating button) currently always renders as a wide "Cart" pill at top-right with `px-5 py-3`. Make it compact:
- When `totalQty === 0`: render an **icon-only circular button**, ~44x44 tap target. No "Cart" text. No badge. Just the `ShoppingBag` icon centered.
- When `totalQty > 0`: render the icon + count badge (no "Cart" text). The button is a smaller pill, roughly 56-64px wide. The count badge stays as the red circle.
- Keep the existing position: `md:hidden fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[70]`.
- Keep `bg-[#0d0f13]` background, `shadow-2xl`, `active:scale-95`, `hover:bg-black`.
- Update the `aria-label` to keep matching: "Open cart" when empty, "Open cart, N items" when not.
- Do NOT change `CartIconNav` (the desktop nav variant). Leave it untouched.

### 2. `client/src/index.css`
Add a `pb-safe` utility under the existing `@layer components` block (or directly in the file if no clean spot exists). Definition:

```css
.pb-safe {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
```

Place it near the other utility classes (e.g., after `.gradient-text` or `.accent-bar`). Do not duplicate any existing class.

### 3. `client/src/components/MenuItemCard.tsx`
The right column (price + AddToCartButton) needs a stable min-width so layout doesn't shift when the stepper expands.

Find the existing right column:
```tsx
<div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
```
Change className to:
```tsx
<div className="flex-shrink-0 text-right flex flex-col items-end gap-2 min-w-[96px]"
```

This reserves enough width for the qty stepper without pushing the title/description.

### 4. `client/src/components/CartDrawer.tsx`
The drawer's footer (`Subtotal` + `Checkout` button) needs safe-area padding on iPhone.

Find this exact line near the end of the drawer:
```tsx
<div className="border-t border-[#ebe9e6] p-5 bg-[#ebe9e6]/30 space-y-3">
```
Replace with:
```tsx
<div className="border-t border-[#ebe9e6] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-[#ebe9e6]/30 space-y-3">
```

Do not change anything else in this file.

### 5. `client/src/pages/Home.tsx`, `client/src/pages/Menu.tsx`, `client/src/pages/Checkout.tsx`
Each of these pages has a wrapper `<div className="min-h-screen ... pb-16 md:pb-0">`. The `pb-16` is too tight on mobile. Change `pb-16` to `pb-24` in all three files.

`Home.tsx` line:
```tsx
<div className="min-h-screen bg-white pb-16 md:pb-0">
```
to:
```tsx
<div className="min-h-screen bg-white pb-24 md:pb-0">
```

Apply the same `pb-16 -> pb-24` change in `Menu.tsx` and `Checkout.tsx`. The background colors differ; do not modify anything except the padding token.

## Files to create
None.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specifically:
- No new dependencies.
- No commits, no pushes (Claude handles those).
- Brand colors only (no new hex values introduced).
- No copy changes anywhere.
- Do NOT modify desktop variants (`CartIconNav`, `TopNav`, anything inside `md:flex` / desktop-only blocks).
- Do NOT change cart logic, only its mobile presentation.

## Reference patterns
- Compact icon button reference: `client/src/components/MobileActionBar.tsx` (the icon + label cells use small fixed padding)
- Safe-area handling: not currently used anywhere in the codebase, so the new `pb-safe` utility is the canonical pattern going forward.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `grep -n "pb-safe" client/src/index.css` returns at least one line (the utility is defined)
- [ ] `grep -rn "pb-16" client/src/pages` returns nothing (all converted to `pb-24`)
- [ ] `grep -n "min-w-\[96px\]" client/src/components/MenuItemCard.tsx` returns one match
- [ ] `grep -n "safe-area-inset-bottom" client/src/components/CartDrawer.tsx` returns one match
- [ ] `CartButton.tsx` no longer contains the literal string `Cart` as visible text content (the button is icon-only when empty, icon + count when not)
- [ ] No console errors when loading the site in mobile dev tools

## Out of scope
- The iPhone clipboard API behavior on `/order-confirmed` (working as expected, leave it).
- Any change to `MobileActionBar` other than what's needed for `pb-safe` to take effect (the file already uses `pb-safe`, so just defining the utility makes it work).
- Any change to `TopNav`, `FeaturedSection`, `HeroSection`, `Footer`, or any desktop layout.
- Any change to `OrderConfirmed.tsx`.
- Adding tests.

## Notes for Codex
- The existing CartButton import is `import { ShoppingBag } from "lucide-react";` — keep it.
- Tailwind v4 supports arbitrary values like `min-w-[96px]` and `pb-[max(1.25rem,env(safe-area-inset-bottom))]` natively. No config changes needed.
- The `CartIconNav` export at the bottom of `CartButton.tsx` must remain unchanged. Only edit the `CartButton` function above it.
