# Task: phase-2-admin-orders

## Goal
Add a password-protected admin section at `/admin` with three pages: an overview with today's stats, an orders list with date-range filters and status updates, and an order detail page with a print-friendly pickup slip. Single shared admin account via Supabase Auth.

## Why
Restaurant staff needs to see incoming orders, mark progress (preparing → ready → completed), and print pickup slips for the kitchen. Phase 1 captures orders into Supabase; Phase 2 makes those orders actionable. Sales analytics, product performance, AI reports, promo codes, and stock toggles are out of scope here (Phase 3+).

## Files to modify

### 1. `client/src/lib/supabase.ts`
Currently the client passes `auth: { persistSession: false }`. Change to `persistSession: true` so the admin's session survives page reloads. Keep all other code unchanged.

### 2. `client/src/App.tsx`
Register the new admin routes. Add imports for the admin pages and protect the non-login admin routes with the new `AdminGuard` wrapper.

Add these routes inside the `<Switch>` (place them ABOVE the final `<Route component={NotFound} />` fallback):

```tsx
<Route path={"/admin/login"} component={AdminLogin} />
<Route path={"/admin"}><AdminGuard><AdminDashboard /></AdminGuard></Route>
<Route path={"/admin/orders"}><AdminGuard><AdminOrders /></AdminGuard></Route>
<Route path={"/admin/orders/:id"}>{(params) => <AdminGuard><AdminOrderDetail id={params.id} /></AdminGuard>}</Route>
<Route path={"/admin/orders/:id/print"}>{(params) => <AdminGuard><AdminPrintSlip id={params.id} /></AdminGuard>}</Route>
```

Adjust imports as needed. Do not modify any of the existing public routes.

## Files to create

### 3. `client/src/lib/auth.ts`
Auth helpers and a `useAuth` hook.

Exports:
- `signIn(email: string, password: string): Promise<{ error: string | null }>` — wraps `supabase.auth.signInWithPassword`
- `signOut(): Promise<void>`
- `useAuth(): { session: Session | null; loading: boolean }` — initial fetch via `supabase.auth.getSession()`, subscribes to `supabase.auth.onAuthStateChange`, returns updated session

Use the `Session` type from `@supabase/supabase-js`.

### 4. `client/src/lib/dateRanges.ts`
Asia/Manila-aware helpers. Mirror the timezone pattern from `client/src/lib/hours.ts` (uses `Intl.DateTimeFormat` with `timeZone: "Asia/Manila"`).

Exports:
- `type DateRangeKey = "today" | "yesterday" | "last7" | "thisMonth" | "custom"`
- `interface DateRange { key: DateRangeKey; startIso: string; endIso: string; label: string }` (start inclusive, end exclusive, both in UTC ISO)
- `getRange(key: Exclude<DateRangeKey, "custom">): DateRange`
- `getCustomRange(startDate: string, endDate: string): DateRange` (accepts `YYYY-MM-DD` strings, treats as Manila local dates)

Logic notes:
- `today`: Manila midnight today to Manila midnight tomorrow, in UTC
- `yesterday`: Manila midnight yesterday to Manila midnight today
- `last7`: 7 days back from now (Manila), to now
- `thisMonth`: 1st of current Manila month at 00:00 to 1st of next Manila month at 00:00

### 5. `client/src/components/AdminGuard.tsx`
Wraps protected admin pages. Uses `useAuth`. While loading, render a small centered spinner div (use a simple Tailwind animation, no new deps). If no session, redirect to `/admin/login` via `useLocation` from wouter. If session, render `children`.

```tsx
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { type ReactNode, useEffect } from "react";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate("/admin/login");
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ebe9e6]">
        <div className="w-8 h-8 border-4 border-[#c08643] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
```

### 6. `client/src/components/AdminLayout.tsx`
Shell for all admin pages except Login and Print. Provides:
- Top bar with the Saiko logo (link to /admin), a "Sign out" button, and current admin email
- Side navigation on desktop (collapses to a top horizontal scroll on mobile): **Dashboard**, **Orders**, **Logout**
- Active state for current route via `useLocation`
- Body slot via `children`

Brand colors per `AGENTS.md`. Sidebar background `#0d0f13` with `#c08643` accent text. Body background `#ebe9e6`. Mobile-first: stack vertically on `<md`, horizontal sidebar on `>=md`.

Sign out calls `signOut()` then navigates to `/admin/login`.

### 7. `client/src/pages/admin/Login.tsx`
Simple email + password form, centered card, no nav. Uses `signIn`. On success, navigate to `/admin`. On error, show inline message. Disable submit while pending.

Card width `max-w-sm`, white background, brand styling consistent with the rest of the site (rounded-2xl, shadow). Page background `#ebe9e6`. No marketing TopNav/Footer here — this page is admin-only.

If a session already exists when the page mounts, redirect immediately to `/admin`.

### 8. `client/src/pages/admin/Dashboard.tsx`
Overview page wrapped in `AdminLayout`. Shows three stat cards in a responsive grid:
- **Orders Today** — count
- **Sales Today** — sum of `total_amount` (formatted as `₱1,234`)
- **Pending Right Now** — count where status in (`pending`, `preparing`, `ready`)

Plus a list of the **5 most recent orders** with order_number, customer_name, status badge, total, and a link to the detail page.

Fetch via `supabase.from("orders").select(...)` filtered by today's range from `dateRanges.ts`. Use `useEffect` + `useState`. Show a loading state and an error state.

### 9. `client/src/pages/admin/Orders.tsx`
Wrapped in `AdminLayout`. Shows the orders table.

Top of page:
- Header: "Orders"
- Date range chip group: **Today · Yesterday · Last 7 Days · This Month · Custom**
- When **Custom** is selected, show two `<input type="date">` pickers (start, end) and an Apply button.
- Status filter chip group: **All · Pending · Preparing · Ready · Completed · Cancelled**
- Right side: a count "N orders · ₱X total"

Table (desktop) / cards (mobile):
- Columns: **Order #**, **Customer**, **Phone**, **Pickup**, **Total**, **Status**, **Created**
- Status rendered as a colored chip (use brand colors: pending=`#705d48`, preparing=`#e88627`, ready=`#c08643`, completed=`#0d0f13`, cancelled=`#ac312d`)
- Each row clickable → `/admin/orders/:id`
- Mobile: render each row as a stacked card with the same fields

Sort: most recent first (`created_at desc`). Cap at 200 rows for now (no pagination yet).

Fetch from Supabase using the selected date range (apply `gte(startIso)` and `lt(endIso)`). On status filter change, re-query with `eq("status", ...)` unless "All".

Loading and error states. Empty state ("No orders for this range. Try a different filter.").

### 10. `client/src/pages/admin/OrderDetail.tsx`
Wrapped in `AdminLayout`. Accepts `id` prop (UUID). Fetches the order + items.

Layout:
- Back link to `/admin/orders`
- Big header: **Order #SAIKO-0001** + status chip
- Customer info card: name, phone, pickup label, pre-order badge if applicable, notes
- Items table: name, qty, unit price, line total
- Total
- **Status update controls**:
  - A row of buttons: **Mark Preparing** · **Mark Ready** · **Mark Completed** · **Cancel Order**
  - Each button updates `orders.status` via `supabase.from("orders").update({ status }).eq("id", id)`
  - After update, refetch and show a brief success toast/banner
  - Disable the button matching the current status
- A **Print Pickup Slip** link → `/admin/orders/:id/print`

Show "Order not found" if the query returns no row. Loading and error states.

### 11. `client/src/pages/admin/PrintSlip.tsx`
Standalone print-optimized page. Does NOT use `AdminLayout`. Minimal HTML: order #, customer name + phone, pickup label, items list (name + qty + line total), total, notes, timestamp.

Print styling via inline `<style>` or a `<style>` block at the top of the JSX:
- Default screen view: clean, centered, legible (white background, dark text)
- `@media print`: hide buttons, set body to `font-family: 'Courier New', monospace`, full width, no margins beyond `1.5cm`

Includes a "Print" button (calls `window.print()`) and a "Back" link (to `/admin/orders/:id`). Both hidden in `@media print`.

Auto-trigger print on mount: `useEffect(() => { setTimeout(() => window.print(), 500); }, []);` (the 500ms gives the data time to load).

Width capped to `max-w-md` for readability on screen. Print sizes via `@page { size: A5; margin: 1cm; }` or letter — pick A5 since pickup slips are typically small.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific overrides for this task:
- **No new npm dependencies.** Everything (Supabase, wouter, lucide-react) is already installed.
- Brand colors only.
- Admin pages do not need the `MobileActionBar`, `Footer`, or marketing `TopNav`.
- Admin pages can omit the global `Reveal` animation wrapper.
- Do not change any public-facing pages, components, hero, footer, menu, cart, or checkout.

## Reference patterns
- Form pattern: `client/src/pages/Checkout.tsx` (handles loading + error states)
- Supabase fetch pattern: pull from `supabase.ts` and use the typed `OrderRow` / `OrderItemRow` interfaces
- Asia/Manila timezone helpers: `client/src/lib/hours.ts` (use `Intl.DateTimeFormat` with `timeZone: "Asia/Manila"`)
- Brand color usage: `client/src/components/FeaturedSection.tsx` and `client/src/pages/Menu.tsx`
- Live time refresh: `client/src/components/OpenStatusBadge.tsx` (setInterval pattern, applicable to Dashboard if needed but not required)

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `client/src/lib/auth.ts` exports `signIn`, `signOut`, `useAuth`
- [ ] `client/src/lib/dateRanges.ts` exports `getRange`, `getCustomRange`, `DateRangeKey`, `DateRange`
- [ ] `client/src/components/AdminGuard.tsx` exists and exports `AdminGuard`
- [ ] `client/src/components/AdminLayout.tsx` exists and exports `AdminLayout`
- [ ] All five admin pages exist under `client/src/pages/admin/`
- [ ] `App.tsx` registers `/admin/login`, `/admin`, `/admin/orders`, `/admin/orders/:id`, `/admin/orders/:id/print`
- [ ] `App.tsx` wraps the four protected routes (not login) with `<AdminGuard>`
- [ ] `grep -n "persistSession: true" client/src/lib/supabase.ts` returns one match
- [ ] `grep -rn "FORMSPREE" client/src` returns nothing (clean carry-over from Phase 1)
- [ ] No marketing components (`TopNav`, `Footer`, `MobileActionBar`) imported in any admin page (those are public-only)

## Out of scope
- Charts and analytics graphs (Phase 3)
- Product performance / item_overrides table for stock or best-seller toggle (Phase 3)
- CSV / PDF export (Phase 3)
- Promo codes (Phase 4)
- AI Report generation (Phase 4)
- Pagination beyond the 200-row cap
- Forgot-password flow
- Multi-user admin / role-based access
- Audit log of who changed what
- Real-time updates (Supabase Realtime subscriptions) — orders refresh on status update via refetch only

## Notes for Codex
- The single shared admin user is created manually by Ken in Supabase Dashboard → Authentication → Users → Add user. Do not implement a sign-up flow on the login page.
- Supabase Auth `email_confirm` may need to be off for the admin user. Ken handles that in Dashboard. Codex's only job is the sign-in form.
- For the orders fetch, use `supabase.from("orders").select("*, order_items(*)")` to nest items in a single query. PostgREST embedded resources work because we have the FK.
- Numeric fields from PostgREST come back as strings. Cast with `Number()` when summing for display.
- Date inputs (`<input type="date">`) return `YYYY-MM-DD` strings. Pass these to `getCustomRange` directly.
- Admin pages render at desktop resolutions and mobile. Use `md:` breakpoints. Card-based mobile layouts are fine; do not force horizontal scrolling tables.
- Status chip colors are listed in the Orders.tsx section. Use the same mapping in OrderDetail and Dashboard for consistency.
- The `MessageCircle` icon and other lucide-react icons used elsewhere are fine to use here.
- `wouter` v3+ supports `<Route path>{(params) => ...}</Route>` for params. The exact pattern is in `App.tsx` from existing routes, but the existing routes don't use params yet so this will be the first.
