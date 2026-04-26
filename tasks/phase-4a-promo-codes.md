# Task: phase-4a-promo-codes

> REVISED for current codebase state. The original version of this spec used the wrong migration number and a wrong `place_order_with_items` signature. This revision is built to slot into what exists in `main` plus the in-flight tracking_token work.

## Goal
Add promo codes that customers can apply at checkout to receive a percent or fixed-amount discount, plus an admin page to manage them. Discount info flows through to the orders table, the customer order text, and the admin order detail view. **The existing tracking_token system, customer tracking page, Messenger notification flow, and in-flight uncommitted work are not modified.**

## Why
The restaurant runs occasional promos (₱50 off, 10% off bundles, weekday-only deals). Right now there's no way to honor a promo from the website. This phase makes promos a first-class feature audit-trailed in the orders table.

## Critical compatibility notes (read first)

The current `place_order_with_items` RPC was created in migration `007_order_tracking_tokens.sql` with this signature:

```
place_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_pickup_time timestamptz,
  p_is_pre_order boolean,
  p_notes text,
  p_total_amount numeric,
  p_items jsonb
) returns table (order_id uuid, order_number text, tracking_token text)
```

The new RPC version in this spec **extends** the existing signature to 11 args by adding `p_subtotal`, `p_total_amount` already present, `p_discount_amount`, and `p_promo_code`. The return type **stays the same**: `(order_id, order_number, tracking_token)`. The internal logic that generates `tracking_token` must be preserved exactly so the customer tracking page and `get-order-tracking` Edge Function keep working.

`Checkout.tsx` currently sends 8 args and reads `tracking_token` from the response. After this spec, it will send 11 args and continue to read `tracking_token`. The customer-facing tracking flow is untouched.

## Files to modify

### 1. `client/src/lib/supabase.ts`
Add a `PromoCodeRow` interface alongside the existing `OrderRow`, `OrderItemRow`, `ItemOverrideRow`. Extend `OrderRow` with three optional fields:

- `promo_code?: string | null`
- `subtotal?: number | null`
- `discount_amount?: number | null`

Do NOT remove or change `tracking_token`, `messenger_psid`, `ready_notified_at`, or any other existing fields. The new fields are appended.

```ts
export interface PromoCodeRow {
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### 2. `client/src/lib/orderFormat.ts`
Update `formatOrderText` to include a Promo line when applicable. Extend `OrderForm` with three optional fields:

- `promoCode?: string | null`
- `subtotal?: number`
- `discountAmount?: number`

When `promoCode` and `discountAmount` are both set and `discountAmount > 0`, insert these two lines before the existing `Total:` line:

```
Subtotal: PHP <subtotal>
Promo: <PROMO_CODE> (-PHP <discount>)
```

The `Total:` line still reflects the discounted amount. When promo fields are absent, the formatter behaves exactly as it does today.

### 3. `client/src/pages/Checkout.tsx`
Currently calls `place_order_with_items` with 8 args and reads `order_number` + `tracking_token`. Add promo support without breaking the tracking flow.

**a. State (add)**
```ts
const [promoInput, setPromoInput] = useState("");
const [promoExpanded, setPromoExpanded] = useState(false);
const [appliedPromo, setAppliedPromo] = useState<{
  code: string;
  description: string | null;
  discountAmount: number;
  total: number;
} | null>(null);
const [promoError, setPromoError] = useState<string | null>(null);
const [validatingPromo, setValidatingPromo] = useState(false);
```

**b. Promo apply handler**
```ts
async function handleApplyPromo() {
  const code = promoInput.trim();
  if (!code) return;
  setValidatingPromo(true);
  setPromoError(null);
  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_code: code,
    p_subtotal: cart.totalPrice,
  });
  setValidatingPromo(false);
  if (error || !data || !data.valid) {
    setPromoError((data && data.error) || "Could not apply promo code");
    setAppliedPromo(null);
    return;
  }
  setAppliedPromo({
    code: data.code,
    description: data.description ?? null,
    discountAmount: Number(data.discount_amount),
    total: Number(data.total),
  });
}
```

Plus a `handleClearPromo` that resets `appliedPromo`, `promoInput`, `promoError`.

**c. UI block**
Add a collapsible "Have a promo code?" section between the existing Notes textarea and the existing static "Your order will be sent to our Messenger..." paragraph (or wherever the current Checkout has its closing static text — match the layout). When `promoExpanded` is true, show an input + Apply button. When `appliedPromo` is set, show a success row with code, description, discount, and a Remove link. Show `promoError` in `text-[#ac312d]` when set.

**d. Summary rail**
Update the running summary to display:
- Subtotal: `cart.totalPrice` (always shown)
- Discount line (only when `appliedPromo`): `<code>` and `-₱<discount>` in muted gold or green
- Total: `appliedPromo?.total ?? cart.totalPrice` (use this for the bold red total)

**e. handleSubmit**
Replace ONLY the `supabase.rpc("place_order_with_items", {...})` call. Add the three new params. Do NOT change anything else about the function (keep the existing tracking_token handling, sessionStorage stash, navigate call):

```ts
const finalSubtotal = cart.totalPrice;
const finalDiscount = appliedPromo?.discountAmount ?? 0;
const finalTotal = appliedPromo?.total ?? cart.totalPrice;

const { data: orderResult, error: orderError } = await supabase.rpc("place_order_with_items", {
  p_customer_name: name.trim(),
  p_customer_phone: phone.trim(),
  p_pickup_label: selectedSlot.label,
  p_pickup_time: selectedSlot.date.toISOString(),
  p_is_pre_order: selectedSlot.isTomorrow ?? false,
  p_notes: notes.trim() || null,
  p_subtotal: finalSubtotal,
  p_total_amount: finalTotal,
  p_discount_amount: finalDiscount,
  p_promo_code: appliedPromo?.code ?? null,
  p_items: orderItems,
});
```

The existing extraction of `order_number` and `tracking_token` from the response stays exactly as it is.

Update the `formatOrderText` call to pass the new fields:

```ts
const orderText = formatOrderText(cart.items, {
  name: name.trim(),
  phone: phone.trim(),
  pickupLabel: selectedSlot.label,
  notes: notes.trim() || undefined,
  promoCode: appliedPromo?.code ?? null,
  subtotal: finalSubtotal,
  discountAmount: finalDiscount,
});
```

Update the sessionStorage stash to include `subtotal`, `discountAmount`, `promoCode`. The existing `tracking_token` stash stays.

### 4. `client/src/pages/OrderConfirmed.tsx`
Extend the `StashedOrder` interface (currently used in this file) with three optional fields:
- `subtotal?: number`
- `discountAmount?: number`
- `promoCode?: string | null`

The order text rendered in the muted card already comes pre-formatted from `formatOrderText`, so the promo line will appear automatically when present. No display logic change beyond keeping the type definition in sync. The existing `trackingToken`, `refFromUrl`, `trackFromUrl`, copy-tracking-URL behavior, and "Track Order" CTA all stay exactly as they are.

### 5. `client/src/pages/admin/OrderDetail.tsx`
When showing the order summary section, if `order.promo_code` is present, render a promo row above the Total. Use brand styling: `text-[#705d48]` for subtotal/promo lines, `text-[#0d0f13]` bold for total.

Display:
```
Subtotal:     ₱{Number(order.subtotal ?? (order.total_amount + (order.discount_amount ?? 0)))}
Promo:        {order.promo_code} (-₱{Number(order.discount_amount ?? 0)})
Total:        ₱{Number(order.total_amount)}
```

Keep the existing Messenger link status display, ready_notified_at display, status update buttons, print slip link, and any other existing OrderDetail UI unchanged.

### 6. `client/src/components/AdminLayout.tsx`
Add **Promos** to the admin sidebar nav, between **Products** and **Logout**. Use a `Tag` or `Ticket` icon from lucide-react. Active state when location starts with `/admin/promos`. Match the existing nav item styling.

### 7. `client/src/App.tsx`
Register the new protected route. Add it next to the other `/admin/*` routes:

```tsx
<Route path={"/admin/promos"}>
  <AdminGuard>
    <AdminPromos />
  </AdminGuard>
</Route>
```

Add the import: `import AdminPromos from "./pages/admin/Promos";`. Place it next to the other admin imports. Do not change any other route.

## Files to create

### 8. `supabase/migrations/20260426_008_promo_codes.sql`
**Migration number is 008 because 006 (order_notifications) and 007 (order_tracking_tokens) are already taken.** This SQL:
1. Creates the `promo_codes` table + RLS
2. Adds `promo_code`, `subtotal`, `discount_amount` columns to `orders`
3. Replaces the existing `place_order_with_items` (8-arg) with an 11-arg version that **preserves the tracking_token generation and return**
4. Adds the new `validate_promo_code` RPC

```sql
-- Phase 4A: promo codes table + order discount columns + extended place_order RPC

create table if not exists promo_codes (
  code text primary key,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  min_order_amount numeric(10,2) default 0 check (min_order_amount >= 0),
  max_discount numeric(10,2) check (max_discount is null or max_discount > 0),
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  times_used integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_active_idx on promo_codes(is_active);

create or replace function set_promo_codes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists promo_codes_set_updated_at on promo_codes;
create trigger promo_codes_set_updated_at
  before update on promo_codes
  for each row execute function set_promo_codes_updated_at();

alter table promo_codes enable row level security;

drop policy if exists "auth manage promos" on promo_codes;
create policy "auth manage promos"
  on promo_codes for all
  to authenticated
  using (true) with check (true);

-- anon does not read promo_codes directly. They validate via the RPC below.

-- Add columns to orders. These are nullable / default-zero so existing rows are unaffected.
alter table orders
  add column if not exists promo_code text,
  add column if not exists subtotal numeric(10,2),
  add column if not exists discount_amount numeric(10,2) not null default 0
    check (discount_amount >= 0);

create index if not exists orders_promo_code_idx on orders(promo_code);

-- Public-callable promo validation. Returns jsonb with either { valid: true, ... } or { valid: false, error }.
create or replace function validate_promo_code(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo promo_codes%rowtype;
  v_discount numeric;
  v_now timestamptz := now();
  v_normalized text := upper(trim(p_code));
begin
  select * into v_promo from promo_codes where upper(code) = v_normalized limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'error', 'Invalid promo code');
  end if;
  if not v_promo.is_active then
    return jsonb_build_object('valid', false, 'error', 'This promo is no longer active');
  end if;
  if v_promo.valid_from is not null and v_now < v_promo.valid_from then
    return jsonb_build_object('valid', false, 'error', 'This promo is not yet active');
  end if;
  if v_promo.valid_until is not null and v_now > v_promo.valid_until then
    return jsonb_build_object('valid', false, 'error', 'This promo has expired');
  end if;
  if v_promo.usage_limit is not null and v_promo.times_used >= v_promo.usage_limit then
    return jsonb_build_object('valid', false, 'error', 'This promo has reached its limit');
  end if;
  if p_subtotal < coalesce(v_promo.min_order_amount, 0) then
    return jsonb_build_object('valid', false, 'error',
      'Minimum order is PHP ' || trim(to_char(v_promo.min_order_amount, 'FM999G999D00')));
  end if;

  if v_promo.discount_type = 'percent' then
    v_discount := round(p_subtotal * v_promo.discount_value / 100, 2);
    if v_promo.max_discount is not null then
      v_discount := least(v_discount, v_promo.max_discount);
    end if;
  else
    v_discount := v_promo.discount_value;
  end if;

  v_discount := least(v_discount, p_subtotal);

  return jsonb_build_object(
    'valid', true,
    'code', v_promo.code,
    'description', v_promo.description,
    'discount_amount', v_discount,
    'subtotal', p_subtotal,
    'total', greatest(p_subtotal - v_discount, 0)
  );
end;
$$;

revoke all on function validate_promo_code(text, numeric) from public;
grant execute on function validate_promo_code(text, numeric) to anon, authenticated;

-- Replace existing place_order_with_items (created in migration 007) with an 11-arg version.
-- The return shape is preserved so the tracking page and get-order-tracking function
-- keep working with no changes.
drop function if exists place_order_with_items(
  text, text, text, timestamptz, boolean, text, numeric, jsonb
);

create or replace function place_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_pickup_time timestamptz,
  p_is_pre_order boolean,
  p_notes text,
  p_subtotal numeric,
  p_total_amount numeric,
  p_discount_amount numeric,
  p_promo_code text,
  p_items jsonb
)
returns table (order_id uuid, order_number text, tracking_token text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
  v_promo_normalized text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  v_tracking_token := replace(gen_random_uuid()::text, '-', '');
  v_promo_normalized := nullif(upper(trim(coalesce(p_promo_code, ''))), '');

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    subtotal,
    total_amount,
    discount_amount,
    promo_code,
    tracking_token
  )
  values (
    trim(p_customer_name),
    trim(p_customer_phone),
    p_pickup_label,
    p_pickup_time,
    coalesce(p_is_pre_order, false),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_subtotal,
    p_total_amount,
    coalesce(p_discount_amount, 0),
    v_promo_normalized,
    v_tracking_token
  )
  returning id, orders.order_number, orders.tracking_token
  into v_order_id, v_order_number, v_tracking_token;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select
    v_order_id,
    item_id,
    item_name,
    unit_price,
    quantity,
    line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  if v_promo_normalized is not null then
    update promo_codes
       set times_used = times_used + 1
     where upper(code) = v_promo_normalized;
  end if;

  return query select v_order_id, v_order_number, v_tracking_token;
end;
$fn$;

revoke all on function place_order_with_items(
  text, text, text, timestamptz, boolean, text, numeric, numeric, numeric, text, jsonb
) from public;

grant execute on function place_order_with_items(
  text, text, text, timestamptz, boolean, text, numeric, numeric, numeric, text, jsonb
) to anon, authenticated;
```

### 9. `client/src/pages/admin/Promos.tsx`
New admin page wrapped in `AdminLayout`. Pattern matches `Products.tsx`.

**Header:**
- Title "Promos"
- "+ New Promo Code" button opens an inline form panel or modal

**List display:**
For each promo, show: code (uppercase bold), description, type+value (`10% off` or `₱50 off`), validity window (formatted in Asia/Manila), usage (`4 / 100 used` or `4 used` if unlimited), Active toggle, Edit button, Delete button (only enabled when `times_used = 0`).

**Form fields (create + edit, modal or inline):**
- Code (text, required, uppercased on save; disabled in edit mode since it's the PK)
- Description (text, optional)
- Discount type (radio: Percent / Fixed)
- Discount value (number, required, > 0)
- Min order amount (number, optional)
- Max discount (number, optional, only meaningful for percent)
- Valid from (datetime-local, optional, convert to ISO via `new Date(value).toISOString()`)
- Valid until (datetime-local, optional)
- Usage limit (integer, optional)
- Active checkbox

**Saves:**
- Create: `supabase.from("promo_codes").insert({...})`. On unique-violation, show "That code already exists."
- Update: `.update({...}).eq("code", originalCode)`
- Delete: `.delete().eq("code", code)` only when `times_used === 0`. Otherwise show a tooltip / message: "Cannot delete a promo that has been used. Deactivate it instead."
- Toggle active: single-field `.update({ is_active })`. Optimistic UI update; rollback on error.

**Empty state:** "No promo codes yet. Create your first one." with a CTA button matching the header button style.

Mobile: card layout. Desktop: card or table, your choice — match Products.tsx for consistency. Brand colors only.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- **No new npm dependencies.** Everything (Supabase, wouter, lucide-react) is already installed.
- **Do not modify the in-flight uncommitted work** beyond the specific edits in this spec to `Checkout.tsx`, `OrderConfirmed.tsx`, `OrderDetail.tsx`, `lib/supabase.ts`, `lib/orderFormat.ts`, `App.tsx`, and `components/AdminLayout.tsx`.
- **Do not touch** `pages/TrackOrder.tsx`, any `supabase/functions/*`, `lib/adminRealtime.ts`, or migrations 001-007.
- **The new `place_order_with_items` MUST return the `tracking_token` field.** The customer tracking page and `get-order-tracking` Edge Function depend on it.
- Brand colors only.
- Numeric values from Supabase come back as strings; cast with `Number()`.

## Reference patterns
- Admin CRUD page pattern: `client/src/pages/admin/Products.tsx`
- Inline form + state: `client/src/pages/Checkout.tsx`
- Migration style: `supabase/migrations/20260426_007_order_tracking_tokens.sql`
- RPC call pattern with tracking_token extraction: `client/src/pages/Checkout.tsx`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `supabase/migrations/20260426_008_promo_codes.sql` exists
- [ ] `client/src/pages/admin/Promos.tsx` exists
- [ ] `App.tsx` registers `/admin/promos` route protected by `AdminGuard`
- [ ] `grep -n "validate_promo_code" client/src/pages/Checkout.tsx` returns at least one match
- [ ] `grep -n "p_promo_code" client/src/pages/Checkout.tsx` returns at least one match
- [ ] `grep -n "p_subtotal" client/src/pages/Checkout.tsx` returns at least one match
- [ ] `grep -n "p_discount_amount" client/src/pages/Checkout.tsx` returns at least one match
- [ ] `grep -n "tracking_token" client/src/pages/Checkout.tsx` still returns at least one match (must be preserved)
- [ ] `grep -n "tracking_token" client/src/pages/TrackOrder.tsx` still returns at least one match (untouched file)
- [ ] `grep -n "Promos" client/src/components/AdminLayout.tsx` returns at least one match
- [ ] `grep -n "promo_code" client/src/pages/admin/OrderDetail.tsx` returns at least one match

## Out of scope
- AI Report generation (Phase 4B, separate spec)
- PDF export
- Per-customer usage limits
- Promo stacking (only one promo per order)
- Tiered or product-specific discounts
- Public "Available promos" page
- Auto-apply codes from URL query params
- Any change to the in-flight TrackOrder, get-order-tracking, notify-order, attach-order-contact, lib/adminRealtime, OR migrations 001-007

## Notes for Codex
- Promo codes are stored uppercase. The validate RPC normalizes input.
- The `place_order_with_items` signature changes from 8 args (current 007) to 11 args (this spec). The migration drops the old function before creating the new one. Codex must update the `Checkout.tsx` call site to use exactly the new 11-arg shape.
- The tracking_token generation logic inside the new RPC is identical to the 007 version. Do not remove or modify it.
- Increment of `times_used` happens inside the RPC (atomic with the order insert). No client-side increment.
- The promo input on Checkout should not push the existing form down jarringly. A simple expand-on-click pattern is fine; no animation required.
- For datetime-local values in Promos.tsx form: input gives `"2026-04-25T18:30"` strings; convert to UTC ISO with `new Date(value).toISOString()` before sending to Supabase.
- `times_used` display: when `usage_limit` is null show `"X used"`; otherwise `"X / Y used"`.
- Validity dates display: use `toLocaleString("en-PH", { timeZone: "Asia/Manila" })`.
- Mobile-first: forms must be usable on a phone.
- Codex MUST NOT touch the in-flight uncommitted files outside the specific edits listed above. Verify by running `git diff --name-only` before completing — the diff should only include files explicitly named in this spec.
