# Task: phase-3-analytics-ops

## Goal
Three things in one phase:

1. **Analytics on the admin Dashboard** — date-range KPIs and two charts (revenue per day, orders by status).
2. **Product management** — new `/admin/products` page with availability and best-seller toggles, backed by a new `item_overrides` Supabase table that the public-facing menu reads from at runtime.
3. **CSV export** — one-click export of the currently-filtered orders list from `/admin/orders`.

## Why
Phase 2 made orders operational. Phase 3 makes the system data-driven and gives staff direct control over what's visible to customers without redeploying. Toggles in admin must immediately affect the public site so "Sold Out" actually means sold out.

This is the largest phase to date. Read the whole spec before starting.

## Files to modify

### 1. `client/src/lib/supabase.ts`
Add an `ItemOverrideRow` interface alongside the existing `OrderRow` and `OrderItemRow`:

```ts
export interface ItemOverrideRow {
  item_id: string;
  is_available: boolean;
  is_best_seller: boolean;
  updated_at: string;
}
```

Do not change anything else.

### 2. `client/src/pages/admin/Dashboard.tsx`
Currently shows three stat cards + 5 most recent orders. Expand to:

- **Add a date range selector** at the top (Today / Yesterday / Last 7 / This Month / Custom). Use the existing `DateRangeKey` and helpers from `lib/dateRanges.ts`. Default: Today. Persist selection in component state only (no URL persistence yet).
- **KPI cards row** (4 cards in a responsive grid, was 3): **Orders**, **Gross Sales**, **Completed Sales**, **Avg Order Value**. Numbers respect the selected range. Use the new `computeKpis` helper.
- **Two charts** below the KPI row:
  - Revenue per day (bar chart, x = day, y = revenue) — use `recharts` `<BarChart>` (already in `package.json`)
  - Orders by status (donut/pie) — use `recharts` `<PieChart>`
  - Charts use brand colors (`#ac312d`, `#e88627`, `#c08643`, `#0d0f13`, `#705d48`)
  - Mobile: charts stack vertically and shrink to full width
- **"Recent Orders" list** stays at the bottom, unchanged in behavior but updated to respect the selected range (last 5 inside the range).

Loading and error states for each section. Empty-state message when no orders fall in the range.

### 3. `client/src/pages/admin/Orders.tsx`
Add two enhancements above the existing filters:

- **Summary strip** showing for the active range: orders count, gross sales total, count by active status (pending + preparing + ready). Single horizontal strip on desktop, stacked cards on mobile.
- **Export CSV button** next to the summary strip. On click, calls the new `exportOrdersToCsv` helper from `lib/csvExport.ts`, passing the currently visible filtered orders. Triggers a browser download named `saiko-orders-<rangeKey>-<YYYYMMDD>.csv`.

Existing filters and table behavior stay unchanged.

### 4. `client/src/components/AdminLayout.tsx`
Add **Products** to the admin sidebar nav, between **Orders** and **Logout**. Active state when `location` starts with `/admin/products`. Use a `Box` or `Package` icon from lucide-react for consistency with the existing nav items.

### 5. `client/src/App.tsx`
Two changes:

a. Register the new protected route:

```tsx
<Route path={"/admin/products"}><AdminGuard><AdminProducts /></AdminGuard></Route>
```

Add the import: `import AdminProducts from "./pages/admin/Products";`. Place the route alongside the other `/admin/*` routes.

b. Wrap the entire app (everywhere the public-facing pages render) with the new `<MenuOverridesProvider>` from `lib/itemOverrides.tsx`. This goes inside `CartProvider`:

```tsx
<CartProvider>
  <MenuOverridesProvider>
    <Toaster />
    <Router />
    <CartButton />
    <CartDrawer />
  </MenuOverridesProvider>
</CartProvider>
```

Add the import: `import { MenuOverridesProvider } from "./lib/itemOverrides";`.

### 6. `client/src/components/MenuItemCard.tsx`
Merge the override into the item rendering:

- Read overrides via `useMenuOverrides()` hook.
- If `override.is_available === false`: render the card with a grayscale image, a prominent **Sold Out** chip overlay (use `bg-[#705d48] text-white` chip), strikethrough name, and **disable** the AddToCartButton.
- If `override.is_best_seller === true` AND the item does not already have `badge: "bestseller"` from `menuData`: show a **Best Seller** badge using the existing `badgeStyles.bestseller` style.
- If both `badge` from menuData and override are set, the menuData `badge` wins (do not render two badges).

Do not change anything else about the card layout.

### 7. `client/src/pages/Menu.tsx`
No structural change. Just ensure the menu still shows sold-out items with the "Sold Out" treatment from MenuItemCard rather than hiding them. (No filtering required at this level — the visual change happens in MenuItemCard.)

## Files to create

### 8. `supabase/migrations/20260426_002_item_overrides.sql`
Create the table and RLS:

```sql
-- Phase 3: item_overrides for admin-controlled availability + best-seller flags

create table if not exists item_overrides (
  item_id text primary key,
  is_available boolean not null default true,
  is_best_seller boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function set_item_overrides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists item_overrides_set_updated_at on item_overrides;
create trigger item_overrides_set_updated_at
  before update on item_overrides
  for each row execute function set_item_overrides_updated_at();

alter table item_overrides enable row level security;

-- anon: SELECT only (public menu reads to show sold-out and best-seller states)
drop policy if exists "anon read item overrides" on item_overrides;
create policy "anon read item overrides"
  on item_overrides for select
  to anon
  using (true);

-- authenticated: full read/write (admin)
drop policy if exists "auth read item overrides" on item_overrides;
create policy "auth read item overrides"
  on item_overrides for select
  to authenticated
  using (true);

drop policy if exists "auth upsert item overrides" on item_overrides;
create policy "auth upsert item overrides"
  on item_overrides for insert
  to authenticated
  with check (true);

drop policy if exists "auth update item overrides" on item_overrides;
create policy "auth update item overrides"
  on item_overrides for update
  to authenticated
  using (true) with check (true);
```

### 9. `client/src/lib/itemOverrides.tsx`
Context provider + hook for public-site override consumption.

Behavior:
- On mount, fetches all rows from `item_overrides`.
- Stores them in a `Map<string, { is_available: boolean; is_best_seller: boolean }>`.
- Exposes `useMenuOverrides()` hook returning a function `getOverride(itemId)` that returns the override row OR `{ is_available: true, is_best_seller: false }` (defaults) when no row exists.
- If the fetch fails, log a warning and use defaults for everything (do not block the public site on a failed override fetch).
- Re-fetches when window regains focus (so admins toggling on a tablet see updates without redeploying).

Skeleton:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

interface Override {
  is_available: boolean;
  is_best_seller: boolean;
}

const DEFAULT_OVERRIDE: Override = { is_available: true, is_best_seller: false };

interface ContextValue {
  getOverride: (itemId: string) => Override;
  loading: boolean;
}

const Ctx = createContext<ContextValue | null>(null);

export function MenuOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, Override>>(new Map());
  const [loading, setLoading] = useState(true);

  async function fetchOverrides() {
    const { data, error } = await supabase
      .from("item_overrides")
      .select("item_id, is_available, is_best_seller");
    if (error) {
      console.warn("[overrides] fetch failed", error);
      setLoading(false);
      return;
    }
    const map = new Map<string, Override>();
    for (const row of data ?? []) {
      map.set(row.item_id, { is_available: row.is_available, is_best_seller: row.is_best_seller });
    }
    setOverrides(map);
    setLoading(false);
  }

  useEffect(() => {
    fetchOverrides();
    const onFocus = () => fetchOverrides();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <Ctx.Provider value={{ getOverride: (id) => overrides.get(id) ?? DEFAULT_OVERRIDE, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMenuOverrides() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMenuOverrides must be used inside MenuOverridesProvider");
  return v;
}
```

### 10. `client/src/lib/analytics.ts`
Pure helpers used by the admin Dashboard. No side effects, no React.

Exports (all pure functions):

- `computeKpis(orders: OrderRow[]): { totalCount: number; grossSales: number; completedSales: number; cancelledCount: number; cancellationRate: number; averageOrderValue: number; }`
  - `grossSales`: sum of `total_amount` for non-cancelled orders
  - `completedSales`: sum of `total_amount` where status is `completed`
  - `cancelledCount`: count where status is `cancelled`
  - `cancellationRate`: `cancelledCount / totalCount` (0 if totalCount is 0)
  - `averageOrderValue`: `grossSales / (totalCount - cancelledCount)` (0 if denominator is 0)

- `groupRevenueByDay(orders: OrderRow[], rangeStart: Date, rangeEnd: Date): { day: string; revenue: number }[]`
  - One entry per day in [rangeStart, rangeEnd)
  - `day` formatted as `"MMM D"` (e.g., `"Apr 25"`) using Asia/Manila timezone
  - `revenue` is the sum of `total_amount` for completed orders that day
  - Returns days even when revenue is 0 (so the chart shows a continuous line)

- `countByStatus(orders: OrderRow[]): { status: string; count: number }[]`
  - Returns one entry per status that appears in the input
  - Order: `pending`, `preparing`, `ready`, `completed`, `cancelled` (omit any that have 0)

- `computeItemPerformance(orderItems: OrderItemRow[], orderStatusById: Map<string, OrderRow["status"]>): { itemId: string; itemName: string; soldQty: number; revenue: number }[]`
  - Aggregates by `item_id` + `item_name` (use the row's `item_name` so renames don't break analytics)
  - `soldQty`: sum of quantity for items whose order is `completed` (only completed counts as a real sale)
  - `revenue`: sum of `line_total` for items whose order is `completed`
  - Sorted by revenue descending

All numeric Supabase values may arrive as strings. Cast with `Number()` before math.

### 11. `client/src/lib/csvExport.ts`
Pure helper that builds CSV text and triggers a browser download.

Exports:

- `exportOrdersToCsv(orders: (OrderRow & { items?: OrderItemRow[] })[], filename: string): void`

CSV columns (in order): `Order Number`, `Customer`, `Phone`, `Pickup`, `Items` (semicolon-joined `Qty x Name`), `Total`, `Status`, `Created`

Implementation:
- Build the CSV string with `\r\n` line endings and proper quoting (escape any double quotes in field values, wrap any field containing comma/quote/newline in double quotes)
- Use a Blob with type `text/csv;charset=utf-8;` and prefix with the UTF-8 BOM (`﻿`) so Excel renders peso signs correctly
- Trigger download via a temporary `<a>` element with `download` attribute
- Revoke the object URL after click

Keep this file pure — no React.

### 12. `client/src/pages/admin/Products.tsx`
New admin page wrapped in `AdminLayout`.

Layout (top to bottom):

- Header: **Products**
- Date range selector (same as Dashboard) so the sold-qty/revenue numbers respect the range. Default: This Month.
- Top performers strip: top 3 items by revenue in range (small cards, item name + qty + revenue)
- Main table / mobile cards: for every item in `menuData`, a row showing:
  - Item name
  - Category
  - Base price
  - Sold qty in range (from `computeItemPerformance`)
  - Revenue in range
  - **Available** toggle (Switch component or simple checkbox; saves on change)
  - **Best Seller** toggle (same)
- Toggle changes call `supabase.from("item_overrides").upsert({ item_id, is_available, is_best_seller })` with `onConflict: "item_id"`
- Show inline saving state per row (e.g., a small spinner or "Saving..." text) and error feedback if the upsert fails. Roll back the toggle UI state on error.
- After saving, no need to refetch the entire menu — just update the local state.

Mobile: render each item as a card with its toggles instead of a table.

Loading state while fetching orders + overrides. Error state if either fetch fails.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific overrides for this task:
- **No new npm dependencies.** `recharts` and `lucide-react` are already installed.
- Brand colors only.
- Do not change any other public-facing component, hero, footer, cart, or checkout logic.
- Do not change Phase 2 admin auth or routing patterns.
- All numeric Supabase values: cast with `Number()` before math.

## Reference patterns
- Admin shell: `client/src/components/AdminLayout.tsx`
- Date range helpers: `client/src/lib/dateRanges.ts`
- Supabase typed access: `client/src/lib/supabase.ts`
- Existing chart-friendly Tailwind palette use: `client/src/components/FeaturedSection.tsx`
- Cart context shape (for the new MenuOverridesProvider): `client/src/lib/cart.tsx`
- Existing admin page pattern: `client/src/pages/admin/Orders.tsx`
- Migration style: `supabase/migrations/20260425_001_orders.sql`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `supabase/migrations/20260426_002_item_overrides.sql` exists
- [ ] `client/src/lib/itemOverrides.tsx` exists and exports `MenuOverridesProvider`, `useMenuOverrides`
- [ ] `client/src/lib/analytics.ts` exists and exports `computeKpis`, `groupRevenueByDay`, `countByStatus`, `computeItemPerformance`
- [ ] `client/src/lib/csvExport.ts` exists and exports `exportOrdersToCsv`
- [ ] `client/src/pages/admin/Products.tsx` exists
- [ ] `App.tsx` registers `/admin/products` and wraps the tree with `<MenuOverridesProvider>`
- [ ] `grep -n "useMenuOverrides" client/src/components/MenuItemCard.tsx` returns at least one match
- [ ] `grep -n "Sold Out" client/src/components/MenuItemCard.tsx` returns at least one match
- [ ] `grep -n "exportOrdersToCsv" client/src/pages/admin/Orders.tsx` returns at least one match
- [ ] `grep -n "Products" client/src/components/AdminLayout.tsx` returns at least one match (the new nav item)
- [ ] No public-facing visual regression: `grep -rn "TopNav\\|MobileActionBar\\|Footer" client/src/pages/admin` still returns nothing

## Out of scope
- Promo codes (Phase 4)
- AI Report generation (Phase 4)
- PDF export (Phase 4)
- Realtime updates via Supabase channels
- Per-staff admin accounts / role-based access
- Editing menu prices or descriptions from admin (still in `menuData.ts`)
- Adding entirely new menu items from admin
- Auto-best-seller computation based on actual sales data
- Pagination of orders or audit log

## Notes for Codex
- The `item_overrides` table only stores rows for items where the admin has changed something. Items without a row use the defaults: `is_available: true`, `is_best_seller: false`. The hook handles this fallback.
- For the public site override fetch, do NOT block initial render. Show items with their defaults while loading; update once data arrives.
- The `recharts` library is already installed (`^2.15.2` in `package.json`). Use named imports from `"recharts"` directly. No setup file needed.
- For donut chart of orders by status, set `innerRadius` to make it a donut and label each slice. Match status colors to the chips already used in `Orders.tsx`.
- For the revenue chart, use `tickFormatter` to keep the y-axis as `₱` formatted numbers.
- Numeric values from Supabase come back as strings for `numeric` columns. Always wrap with `Number()`.
- For CSV export, the BOM (`﻿`) prefix is critical for Excel to render `₱` correctly. Do not skip it.
- The Sold Out treatment in `MenuItemCard.tsx` must use a single `<div>` overlay with `pointer-events-none` so the underlying card retains structure but visually shows unavailable.
- Mobile-first: the Products page is heavy on data. On `<md`, render each menu item as a stacked card with toggles below the metrics; on `>=md`, render as a table.
- Status colors used in `Orders.tsx`:
  - pending: `#705d48`
  - preparing: `#e88627`
  - ready: `#c08643`
  - completed: `#0d0f13`
  - cancelled: `#ac312d`
- For the Products top-performers strip, when `range` has zero qualifying orders, show a friendly empty state ("No completed orders in this range yet.") instead of empty cards.
