# Task: phase-1-supabase-orders

## Goal
Replace the current Messenger/Email send choice with a single Supabase-backed order flow. Customer places order → row written to Supabase → browser redirects to `m.me/saikoramenandsushi?ref=<ORDER_NUMBER>` so Botcake can pick it up via the ref param.

## Why
Phase 1 of the ordering + admin dashboard rollout. Establishes the database foundation (orders + order_items tables) and removes the manual copy-paste flow. Future phases (admin auth, dashboard, AI reports) all build on this schema. Botcake-side flow that consumes `ref` and fetches the order is set up by Ken outside this codebase, so this spec only needs to write the order, surface the order number, and redirect.

## Files to modify

### 1. `package.json`
Add dependency `@supabase/supabase-js` at the latest 2.x version. Use whichever package manager matches the existing lockfile (check for `pnpm-lock.yaml` first, then `package-lock.json`). Run the install so the lockfile updates. This is one of the explicit exceptions where modifying `package.json` and running install is allowed.

### 2. `.env.example`
Append two new variables under the existing block. Final state should include (do not remove existing keys):

```
# Supabase backend (orders, admin, future dashboard)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 3. `client/src/pages/Checkout.tsx`
Significant changes. Implement these in order:

**a. Imports**
- Remove `Mail` from the `lucide-react` import
- Remove the `MessageCircle` icon usage in the method-picker block (still used elsewhere — check before removing)
- Add `import { supabase } from "@/lib/supabase";`

**b. State**
- Remove the `method` state and the `SendMethod` type alias
- Remove the `FORMSPREE_ENDPOINT` constant
- Keep all other state unchanged

**c. handleSubmit**
Replace the entire `handleSubmit` body. New behavior:

1. Validate as before (`canSubmit` check stays)
2. Build the payload:
   - `customer_name` from name.trim()
   - `customer_phone` from phone.trim()
   - `pickup_label` from selectedSlot.label
   - `pickup_time` from selectedSlot.date.toISOString()
   - `is_pre_order` from selectedSlot.isTomorrow ?? false
   - `notes` from notes.trim() (null if empty string)
   - `total_amount` from cart.totalPrice
   - `items` (separate array) from cart.items mapped to `{ item_id, item_name, unit_price, quantity, line_total: price * qty }`
3. Insert the order: `.from("orders").insert({...}).select("id, order_number").single()`
4. If the order insert errors, set the friendly error message and stop
5. Insert the order items: `.from("order_items").insert(items.map(i => ({ ...i, order_id: orderRow.id })))`
6. If items insert errors, attempt cleanup by deleting the order row (best-effort), set error, stop
7. Stash to sessionStorage:
   ```
   sessionStorage.setItem("saiko-last-order", JSON.stringify({
     orderNumber: orderRow.order_number,
     orderText: formatOrderText(...),  // unchanged usage of formatOrderText
     name, phone,
     pickup: selectedSlot.label,
     isTomorrow: !!selectedSlot.isTomorrow,
     total: cart.totalPrice,
   }));
   ```
8. `cart.clear()`
9. `navigate("/order-confirmed")`

**d. Send-method picker UI block**
Remove the entire "How should we receive your order?" block including its label and the two buttons (Messenger / Email). Replace with a single static info paragraph (small text, muted) that says:

> "Your order will be sent to our Messenger right after you tap Place Order. Confirm pickup details there."

Keep the rest of the form unchanged.

### 4. `client/src/pages/OrderConfirmed.tsx`
Rewrite the body. New behavior:

- Read from sessionStorage as before
- Display: order number (large, e.g. `Order #SAIKO-0001`), green check, "Sending you to Messenger..." subtitle, and the formatted order text in a muted card (so the customer can verify what we recorded)
- Auto-redirect to `https://m.me/saikoramenandsushi?ref=<ORDER_NUMBER>` after **1500ms** using `window.location.href = ...`
- Show a manual fallback button "Open Messenger" with the same URL in case the redirect is blocked (e.g., iOS popup blockers)
- Show "Tomorrow pickup" badge when `isTomorrow` is true (existing logic)
- Keep the "No order to show" empty state unchanged
- Remove the entire "Copy order" + "Open Messenger" two-step flow
- Remove the email-method conditional branch
- Keep the bottom "Call Saiko" / "Browse Menu" two-button row at the bottom

The `useEffect` that sets `document.title` stays. Add a second `useEffect` for the redirect with a setTimeout cleanup.

## Files to create

### 5. `client/src/lib/supabase.ts`
Lightweight client wrapper:

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Fail loud in dev so we notice missing env config.
  console.warn("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Order placement will fail.");
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: { persistSession: false },
});

export interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_label: string;
  pickup_time: string;
  is_pre_order: boolean;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}
```

### 6. `supabase/migrations/20260425_001_orders.sql`
Create the migrations directory at the project root (`saiko_web/supabase/migrations/`). Write this exact SQL:

```sql
-- Phase 1: orders + order_items + sequential order numbers + RLS

create extension if not exists "pgcrypto";

create sequence if not exists order_number_seq start 1;

create or replace function next_saiko_order_number()
returns text
language sql
as $$
  select 'SAIKO-' || lpad(nextval('order_number_seq')::text, 4, '0');
$$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default next_saiko_order_number(),
  customer_name text not null,
  customer_phone text not null,
  pickup_label text not null,
  pickup_time timestamptz not null,
  is_pre_order boolean not null default false,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','preparing','ready','completed','cancelled')),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_at_idx on orders(created_at desc);
create index if not exists order_items_order_id_idx on order_items(order_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- RLS
alter table orders enable row level security;
alter table order_items enable row level security;

-- anon: INSERT only (customers placing orders from the web)
drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders"
  on orders for insert
  to anon
  with check (true);

drop policy if exists "anon insert order items" on order_items;
create policy "anon insert order items"
  on order_items for insert
  to anon
  with check (true);

-- authenticated: full read/update/delete (admin dashboard, Phase 2)
drop policy if exists "auth read orders" on orders;
create policy "auth read orders"
  on orders for select
  to authenticated
  using (true);

drop policy if exists "auth update orders" on orders;
create policy "auth update orders"
  on orders for update
  to authenticated
  using (true) with check (true);

drop policy if exists "auth delete orders" on orders;
create policy "auth delete orders"
  on orders for delete
  to authenticated
  using (true);

drop policy if exists "auth read order items" on order_items;
create policy "auth read order items"
  on order_items for select
  to authenticated
  using (true);

drop policy if exists "auth delete order items" on order_items;
create policy "auth delete order items"
  on order_items for delete
  to authenticated
  using (true);

-- service_role bypasses RLS entirely. Botcake will use service_role to read orders by order_number.
```

### 7. `supabase/README.md`
Short setup guide so Ken knows what to do manually:

```md
# Supabase Setup for Saiko

This project uses Supabase as its backend. The migrations under `migrations/`
define the schema. Apply them through the Supabase SQL editor or `supabase db push`
if you have the Supabase CLI linked.

## One-time project setup

1. Create a Supabase project at https://supabase.com (free tier is fine).
2. From Project Settings → API, copy:
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`
   - service_role key → keep secret, only used by Botcake / admin server-side
3. Add the two `VITE_*` keys to `.env` locally and to Vercel env vars (Production + Preview).
4. Open the SQL editor and run each file in `supabase/migrations/` in order.

## Botcake side (separate)

Botcake reads the `ref` query param when a customer lands in the Messenger
conversation from `m.me/saikoramenandsushi?ref=SAIKO-XXXX`. To fetch the
order, Botcake should call the Supabase REST endpoint:

```
GET https://<project>.supabase.co/rest/v1/orders?order_number=eq.SAIKO-XXXX
Authorization: Bearer <service_role_key>
apikey: <service_role_key>
```

Use service_role for this lookup so RLS doesn't block it. Keep that key
in Botcake's secrets, never in the web bundle.
```

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific overrides for this task:
- **`package.json` modification IS allowed** because Supabase JS is the listed dependency.
- **Running `pnpm add @supabase/supabase-js` IS allowed** for the same reason.
- All other AGENTS.md hard limits stand (no commits, no pushes, no other deps, no copy/design changes).

## Reference patterns
- Existing form-with-async-submit: `client/src/pages/Checkout.tsx` (current form layout stays, only the submit handler and the method picker change)
- Cart hook pattern: `client/src/lib/cart.tsx` (similar simple module with named export)
- Path alias: `@/` resolves to `client/src/*` (configured in `vite.config.ts` and `tsconfig.json`, do not modify)

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `grep -rn "FORMSPREE_ENDPOINT" client/src` returns nothing
- [ ] `grep -rn "method ===" client/src/pages/Checkout.tsx` returns nothing
- [ ] `grep -n "from \"@/lib/supabase\"" client/src/pages/Checkout.tsx` returns one match
- [ ] `client/src/lib/supabase.ts` exists and exports `supabase`, `OrderRow`, `OrderItemRow`
- [ ] `supabase/migrations/20260425_001_orders.sql` exists
- [ ] `supabase/README.md` exists
- [ ] `package.json` lists `@supabase/supabase-js` under dependencies
- [ ] Lockfile (pnpm-lock.yaml or package-lock.json) updated to include @supabase/supabase-js
- [ ] `npx tsc --noEmit` passes
- [ ] In `OrderConfirmed.tsx`, `grep -n "Copy" client/src/pages/OrderConfirmed.tsx` returns nothing (the two-step copy/paste UI is gone)
- [ ] In `OrderConfirmed.tsx`, the auto-redirect uses `window.location.href` and references `m.me/saikoramenandsushi?ref=`

## Out of scope
- Admin authentication, admin pages, admin dashboard (Phase 2)
- Sales analytics, charts, reports (Phase 3)
- Promo codes, stock toggles, best-seller admin (Phase 3)
- AI report generation (Phase 4)
- Botcake-side flow (Ken sets this up outside the codebase)
- Any change to MenuItemCard, FeaturedSection, Hero, Footer, or other public-facing components
- Any change to cart logic, MobileActionBar, TopNav
- Email sending of any kind
- Edge Functions (none needed for Phase 1)

## Notes for Codex
- The `formatOrderText` helper at `@/lib/orderFormat` already exists and works. Keep using it for the readable text shown on the confirmation page (so the customer can verify what was sent).
- The `getPickupOptions()` helper at `@/lib/pickupSlots` already returns slots with `.date: Date` and `.label: string` and `.isAsap`/`.isTomorrow`. Use `.date.toISOString()` for the timestamp column.
- If the Supabase env vars are missing at runtime, the order insert will fail. That's intentional. The error message in the catch handler should still say "Something went wrong. Try again or call us directly."
- The `package.json` build/dev scripts already work with pnpm. Use `pnpm add @supabase/supabase-js` (not npm) if `pnpm-lock.yaml` exists.
- Do not introduce a TypeScript `Database` types file (e.g., from `supabase gen types`). The two interfaces in `lib/supabase.ts` are enough for Phase 1.
- Do NOT modify the cart, the menu data, the hero, the footer, or any other component beyond the two pages listed.

## Handoff Note (2026-04-26)

Current production checkout issue to investigate:

- Request failing: `POST https://wiutixrypqrlfbandjox.supabase.co/rest/v1/orders?select=id,order_number`
- Error: `401 Unauthorized`
- Console also shows Umami/preload warnings, but those appear non-blocking.

What has already been validated:

- Supabase schema/RLS/policy/function/sequence verification returned all `true`.
- This strongly suggests the failure is related to the insert flow using `.insert(...).select("id, order_number").single()` while anon has insert-only access.

Likely root cause:

- PostgREST returning selected fields after insert appears to require `SELECT` permission.
- Current RLS setup allows anon insert but does not allow anon select, so returning payload is denied.

Requested fix direction:

- Implement a proper fix in checkout that avoids requiring broad anon read access.
- Do not leave a permanent anon `SELECT`-all policy on `orders`.
- Preserve order-number-based Messenger redirect flow.
- Re-run acceptance checks and report results.
