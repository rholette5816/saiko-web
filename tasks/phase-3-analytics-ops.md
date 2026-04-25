# Task: phase-3-analytics-ops

## Goal
Add a Phase 3 admin operations layer on top of Phase 2: analytics cards/charts, product performance insights, and basic item override controls for availability and best-seller tags.

## Why
Phase 2 made orders operational. Phase 3 should help staff and owners make decisions quickly: what is selling, what is underperforming, what revenue looks like by date range, and which items should be marked available or featured.

## Files to modify

### 1. `client/src/pages/admin/Dashboard.tsx`
- Expand the dashboard with analytics sections below the existing top cards.
- Add date range controls (`today`, `yesterday`, `last7`, `thisMonth`, `custom`) using `dateRanges.ts`.
- Add summary blocks:
  - Gross sales for range
  - Completed sales for range
  - Cancellation count and cancellation rate
  - Average order value
- Add chart area using existing `recharts` dependency:
  - Revenue by day (line or bar)
  - Orders by status (donut or bar)
- Keep existing "Recent Orders" list.

### 2. `client/src/pages/admin/Orders.tsx`
- Add lightweight summary strip above table/cards:
  - selected range sales
  - selected range order count
  - pending/preparing/ready count
- Keep existing filters and interactions.

### 3. `client/src/lib/supabase.ts`
- Add TypeScript interfaces for new Phase 3 table shape:
  - `ItemOverrideRow`
- Keep existing exports intact.

### 4. `client/src/App.tsx`
- Register one new protected route for product insights/controls:
  - `/admin/products`
- Wrap with `<AdminGuard>`.

## Files to create

### 5. `client/src/pages/admin/Products.tsx`
Admin products page wrapped in `AdminLayout`:
- Table or card list of menu items (from `menuData.ts`) with:
  - item name
  - category
  - base price
  - sold qty in selected range
  - gross revenue in selected range
  - current override flags (`is_available`, `is_best_seller`)
- Controls per item:
  - availability toggle
  - best-seller toggle
- Save changes to Supabase `item_overrides`.
- Show loading, save pending state, and error/success feedback.
- Mobile layout must be card-based, not horizontal scroll.

### 6. `client/src/lib/analytics.ts`
Reusable pure helpers:
- `groupRevenueByDay(orders)` for chart input
- `countByStatus(orders)` for chart input
- `computeKpis(orders)` returning:
  - grossSales
  - completedSales
  - cancelledCount
  - totalCount
  - averageOrderValue
- `computeItemPerformance(ordersWithItems)` returning per-item qty/revenue.

### 7. `supabase/migrations/20260426_002_item_overrides.sql`
Create `item_overrides` table:
- `item_id text primary key`
- `is_available boolean not null default true`
- `is_best_seller boolean not null default false`
- `updated_at timestamptz not null default now()`

Add trigger to maintain `updated_at`.

RLS:
- authenticated: select/update/insert allowed
- anon: select denied, write denied

## Files to delete
None.

## Constraints
- Inherits from `AGENTS.md`.
- No new npm dependencies.
- Keep public site pages untouched.
- Keep Phase 2 admin routes/behavior working.
- Reuse existing brand palette and spacing conventions.

## Reference patterns
- Date range logic: `client/src/lib/dateRanges.ts`
- Admin shell: `client/src/components/AdminLayout.tsx`
- Orders data access: `client/src/pages/admin/Orders.tsx`
- Supabase setup style: `supabase/migrations/20260425_001_orders.sql`

## Acceptance criteria
- [ ] `rg -n "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `client/src/pages/admin/Products.tsx` exists and is reachable at `/admin/products`
- [ ] `client/src/lib/analytics.ts` exists and exports chart/KPI helpers
- [ ] Dashboard shows at least 2 charts and KPI cards for selected range
- [ ] Products page can toggle availability and best-seller flags and persists to Supabase
- [ ] `supabase/migrations/20260426_002_item_overrides.sql` exists
- [ ] No public page imports or behavior regressions

## Out of scope
- Promo code engine
- AI daily report generation
- CSV/PDF export
- Realtime subscriptions
- Multi-tenant or role-based admin auth

## Notes for Codex
- Use the order/items data already stored in Supabase from Phase 1.
- Numeric database values may arrive as strings; cast with `Number(...)` before math.
- Prefer clear, readable chart labels over dense visuals.
