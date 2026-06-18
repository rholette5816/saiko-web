# Task: admin-product-management

## Goal
Admin can create new menu items, edit existing item fields (name, price, description, badge, category), and toggle availability — all from the Admin → Products page, with changes reflecting live on the public Menu page without a code deploy.

## Why
Today menu items are hardcoded in `client/src/lib/menuData.ts`. Adding a new dish or changing a price requires a code change and redeploy. Ken wants to manage the menu (add items, disable items, edit prices/descriptions) directly from the admin UI.

## Files to create
- `supabase/migrations/<next_number>_menu_items_table.sql` — new `menu_items` table:
  ```sql
  create table if not exists menu_items (
    id text primary key,
    category_id text not null,
    name text not null,
    price integer not null,
    description text,
    image text,
    badge text check (badge in ('bestseller', 'chefs-pick', 'new', 'spicy') or badge is null),
    sort_order integer not null default 0,
    is_available boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  ```
  Add `updated_at` trigger matching the pattern in `supabase/migrations/20260426_002_item_overrides.sql`.
  RLS: anon SELECT only (where `is_available = true`), authenticated full read/write — same policy shape as `item_overrides`.
  Also create a `menu_categories` table (id text primary key, name text, emoji text, sort_order integer) seeded with the existing category list from `menuData.ts` (featured, ramen, alacarte, sushi, stirfry, salad, dumplings, friedrice, yakitori, pizza, bento, doria, side, donburi, teppanyaki, drinks).

- `client/src/lib/menuItems.ts` — replaces static reliance on `menuData.ts` items array. Exports:
  - `fetchMenuCategories(): Promise<MenuCategory[]>` — joins `menu_categories` + `menu_items` (only `is_available = true` for public use), shaped exactly like the existing `MenuCategory`/`MenuItem` types in `menuData.ts` so `CategorySection.tsx` and `MenuItemCard.tsx` don't need changes.
  - Keep the existing `MenuItem` / `MenuCategory` / `MenuBadge` type exports (re-export from `menuData.ts` or move them here, whichever keeps fewer import changes).

- `client/src/pages/admin/ProductForm.tsx` — modal or inline form component used by `Products.tsx` to create/edit a menu item. Fields: name (text), category (select from `menu_categories`), price (number), description (textarea, optional), badge (select: none/bestseller/chefs-pick/new/spicy), image URL (text, optional), is_available (switch). Props: `{ mode: "create" | "edit", initialItem?: MenuItem & { categoryId: string }, onSaved: () => void, onCancel: () => void }`. On submit, upsert into `menu_items` via Supabase client.

## Files to modify
- `client/src/lib/menuData.ts` — keep the file but mark it deprecated with a one-line comment pointing to `menuItems.ts` and `supabase/migrations/<...>_menu_items_table.sql` as the seed source. Do not delete (used as historical reference / seed data source for the migration). Do not change its exported types if moved to `menuItems.ts` — avoid duplicate type definitions, pick one source of truth.

- `client/src/pages/Menu.tsx` — replace `menuData` static import with `fetchMenuCategories()` called in a `useEffect`/loading state. Keep all existing search/filter logic working against the fetched data. Add a loading skeleton or simple "Loading menu..." state while fetching.

- `client/src/pages/admin/Products.tsx` — add a "New Item" button that opens `ProductForm` in create mode. Add an "Edit" action per row that opens `ProductForm` in edit mode pre-filled. Keep the existing availability/best-seller switches working, but now they write to `menu_items.is_available` / a `is_best_seller` column added to `menu_items` (carry over the existing `item_overrides` toggle behavior into the new table so there's one source of truth — do not keep two separate override systems running in parallel).

- `client/src/lib/itemOverrides.tsx` — once `menu_items.is_available` is the source of truth, update `useMenuOverrides`/`getOverride` to read from `menu_items` instead of `item_overrides` (or deprecate this file entirely if `fetchMenuCategories()` already returns `is_available` per item — prefer deprecating if it removes a redundant fetch).

## Constraints
- Inherits from `AGENTS.md` (no em dashes, brand colors, no new deps unless absolutely required)
- Do not introduce a new state management library — use existing patterns (useState/useEffect, Supabase client direct calls) as seen in `Products.tsx`
- Do not change the public-facing visual design of the Menu page or `MenuItemCard.tsx`
- Keep `MenuItem`/`MenuCategory`/`MenuBadge` type shapes backward compatible so existing components don't break
- Categories themselves are NOT admin-editable in this task (no add/remove category UI) — only items

## Reference patterns
- Toggle/switch UI pattern: `client/src/pages/admin/Products.tsx` (existing Switch usage)
- Supabase query pattern: `client/src/lib/itemOverrides.tsx` and `client/src/pages/admin/Products.tsx`
- Migration file pattern: `supabase/migrations/20260426_002_item_overrides.sql`
- Data shape to match exactly: `client/src/lib/menuData.ts` (`MenuItem`, `MenuCategory` interfaces)

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] New migration file runs cleanly (check SQL syntax matches existing migration style in the repo)
- [ ] Admin can click "New Item", fill the form, save, and the item appears on the public `/menu` page without a deploy
- [ ] Admin can edit an existing item's price/name/description and see it update on `/menu`
- [ ] Toggling availability off hides the item from `/menu` (same behavior as today's sold-out state)
- [ ] No duplicate/conflicting override system left running (either `item_overrides` is migrated into `menu_items` or clearly deprecated, not both active)
- [ ] No console errors in browser dev mode on both `/menu` and `/admin/products`

## Out of scope
- Category management UI (add/remove/reorder categories)
- Image upload (URL field only, no file upload widget)
- Bulk import/export of menu items
- Changing the printed Legal-size menu artwork (separate workstream, not code)

## Notes for Codex
- `menuData.ts` currently has ~16 categories and ~140 items hardcoded with real Saiko menu data (prices in PHP, badges like bestseller/chefs-pick/new/spicy). Use this as the exact seed data for the `INSERT` statements in the migration so the live menu doesn't go blank after migration — every existing item must be preserved with its current id, name, price, badge, and image.
- Existing item ids (e.g. `r1`, `f5`, `do8`) are referenced elsewhere (cart, order_items.item_id in Supabase). Keep the same id values when seeding `menu_items` so historical orders and cart references don't break.
- `item_overrides` table already has live data for some items (is_available/is_best_seller flags). When migrating, merge those existing override values into the new `menu_items` rows for the matching `item_id` rather than resetting everyone to default.
