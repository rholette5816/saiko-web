# Task: phase-5b-bir-fields

## Goal
Add BIR-compliant data capture on top of Phase 5A counter mode: a business settings page, sequential OR numbers, VAT breakdown on receipts, Senior/PWD discount handling, and a thermal-receipt-friendly print layout. Saiko remains responsible for actual BIR accreditation (out of scope); this spec produces accurate data and a receipt template that an accredited POS or accountant can use.

## Why
Phase 5A captures walk-in orders but its receipt has placeholder business info and no tax breakdown. For real-world counter use, Saiko needs: business name + TIN + address on every receipt, VAT-exclusive and VAT-inclusive line totals (if VAT-registered), Senior Citizen / PWD discount applied per Philippine law (20% off + VAT exempt for those line items), and a sequentially-numbered Official Receipt or Sales Invoice number. None of this is BIR accreditation; it is the data foundation for accreditation.

## Critical compatibility notes
- Builds on Phase 5A. Phase 5A migration 009 must be applied first.
- New migration is `20260426_010_bir_settings.sql`.
- Adds new columns to `orders` for VAT and Senior/PWD breakdown. All optional / default 0; existing rows are unaffected.
- Adds a new `business_settings` single-row table.
- Adds a sequential `or_number` per counter order (web orders do not get one).
- Replaces the basic counter receipt with a BIR-formatted receipt that uses settings.
- Does NOT pursue BIR accreditation. The receipt clearly states whether it is an "OFFICIAL RECEIPT" (only when business has accreditation flag set) or "PROVISIONAL RECEIPT" (default).
- Does NOT modify customer-facing pages or any existing Edge Function.

## Files to modify

### 1. `client/src/lib/supabase.ts`
Append new optional fields to `OrderRow` (do not remove anything):

```ts
or_number?: string | null;
vat_amount?: number | null;
vatable_sales?: number | null;
vat_exempt_sales?: number | null;
senior_pwd_discount?: number | null;
senior_pwd_id?: string | null;
senior_pwd_name?: string | null;
```

Add a new `BusinessSettings` interface:

```ts
export interface BusinessSettings {
  id: string;
  business_name: string;
  business_tin: string | null;
  business_address: string | null;
  business_contact: string | null;
  vat_registered: boolean;
  vat_rate: number;
  or_prefix: string;
  or_next_number: number;
  receipt_footer: string | null;
  is_bir_accredited: boolean;
  updated_at: string;
}
```

### 2. `client/src/components/AdminLayout.tsx`
Add **Settings** to the admin sidebar nav, between **Promos** and **Logout** (or at the bottom — match the existing visual hierarchy). Use the `Settings` icon from lucide-react. Active state when location starts with `/admin/settings`.

### 3. `client/src/App.tsx`
Register the protected route alongside the other admin routes:

```tsx
<Route path={"/admin/settings"}>
  <AdminGuard>
    <AdminSettings />
  </AdminGuard>
</Route>
```

Add the import: `import AdminSettings from "./pages/admin/Settings";`

### 4. `client/src/pages/admin/Counter.tsx`
Three additions, no removals:

**a. Senior / PWD section** (above the Payment method radios):
- Checkbox: "Senior Citizen / PWD"
- When checked, reveal two required text inputs: ID Number, Full Name
- When applied, compute discount: 20% off the order subtotal AND mark the order as VAT-exempt (no VAT charged on this transaction)
- Note: Phase 5B does NOT support partial senior orders (where only some items qualify). It's all-or-nothing per transaction. This is a simplification; document it as such in the UI: "Senior/PWD discount applies to the entire order."

**b. Receipt footer changes:**
- Read business settings on mount: `const settings = useBusinessSettings();`
- Pass settings to `<CounterReceipt />` so it can render proper business info and OR number
- After successful submit, the RPC now returns `or_number` along with `order_number`; pass it through to the receipt

**c. RPC call signature change:**
The new RPC `place_counter_order` now accepts the Senior/PWD fields. Update the call:

```ts
const { data, error: rpcError } = await supabase.rpc("place_counter_order", {
  p_customer_name: customerName.trim(),
  p_customer_phone: customerPhone.trim(),
  p_total_amount: total,
  p_subtotal: subtotal,                       // NEW
  p_payment_method: paymentMethod,
  p_amount_received: paymentMethod === "cash" ? received : total,
  p_notes: notes.trim() || null,
  p_senior_pwd: isSeniorPwd,                  // NEW
  p_senior_pwd_id: isSeniorPwd ? seniorId.trim() : null,    // NEW
  p_senior_pwd_name: isSeniorPwd ? seniorName.trim() : null, // NEW
  p_items: orderItems.map(...),
});
```

The RPC computes VAT breakdown server-side based on `business_settings`. Frontend trusts the returned values for display.

**d. UI summary panel** must show:
- Subtotal
- Senior/PWD discount line (only if applied), e.g., `Senior/PWD (-20%)  -PHP 50`
- VAT-able sales (only if VAT registered and not senior)
- VAT (12%, only if VAT registered and not senior)
- VAT-exempt sales (only if senior)
- Total
- Payment method, received, change

### 5. `client/src/components/CounterReceipt.tsx`
Significant rewrite. The receipt now reads settings and renders BIR-compliant fields.

**Props (extend):**
```ts
interface Props {
  // existing
  orderNumber: string;
  orNumber: string | null;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  subtotal: number;
  payment: string;
  received: number;
  change: number;
  customer: string;
  notes: string;
  createdAt: Date;
  // new
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  seniorPwdDiscount: number;
  seniorPwdId: string | null;
  seniorPwdName: string | null;
  settings: BusinessSettings;
}
```

**Receipt sections (top to bottom):**

```
SAIKO RAMEN & SUSHI                       <- settings.business_name
TIN: 123-456-789-000                      <- settings.business_tin (or "TIN: ___" if not set)
Circumferential Road 1, Oton, Iloilo      <- settings.business_address
Tel: 0917-865-8587

================================================
PROVISIONAL RECEIPT                       <- "OFFICIAL RECEIPT" if settings.is_bir_accredited
OR No: SAIKO-OR-0001                      <- order.or_number from RPC
Order: SAIKO-0010                         <- order.order_number
Date:  2026-04-26 14:30:00
Cashier: <admin email or name>
Customer: Walk-in / Juan Dela Cruz

------------------------------------------------
ITEMS:
2x Wagyu Teppan @ 504               1,008
3x Pork Gyoza @ 157                   471
1x Lava Rice @ 359                    359
------------------------------------------------

{If senior/PWD applied:}
Subtotal                            1,838.00
Senior/PWD Discount (20%)            -367.60
VAT-Exempt Sales                    1,470.40
TOTAL                               1,470.40
Senior ID: 123-456-789
Customer: Juan Dela Cruz Sr.

{Else if VAT registered:}
VAT-able Sales                      1,640.18
VAT (12%)                             196.82
TOTAL                               1,837.00

{Else (non-VAT):}
TOTAL                               1,838.00

------------------------------------------------
Payment (Cash):                      2,000.00
Change:                                162.00

------------------------------------------------
{settings.receipt_footer or default "Salamat at bumalik kayo!"}

{If !settings.is_bir_accredited:}
This is a provisional receipt for transaction
tracking only. Not a BIR Official Receipt.
================================================
```

Use monospace font (`Courier New`), 80mm width, dashed dividers. Print CSS already established in 5A; tighten/expand spacing to fit thermal width.

VAT math notes:
- If VAT-registered and prices are VAT-inclusive (the assumption per AGENTS.md): `vatableSales = total / 1.12`, `vatAmount = total - vatableSales`. Round to 2 decimals.
- If senior/PWD: `vatExemptSales = total - seniorDiscount` (after 20% off). VAT amount is 0.
- If non-VAT: total is just the sum, no breakdown.

### 6. `supabase/functions/get-order/index.ts` and `supabase/functions/get-order-tracking/index.ts`
No code change required, but verify the SELECT returns the new columns (PostgREST returns them automatically since `select=*`). Confirm only.

## Files to create

### 7. `supabase/migrations/20260426_010_bir_settings.sql`

```sql
-- Phase 5B: business settings, BIR-compliant fields on orders, sequential OR numbers, senior/PWD, updated counter RPC.

create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'SAIKO RAMEN & SUSHI',
  business_tin text,
  business_address text,
  business_contact text,
  vat_registered boolean not null default false,
  vat_rate numeric(5,2) not null default 12.00,
  or_prefix text not null default 'SAIKO-OR',
  or_next_number integer not null default 1,
  receipt_footer text,
  is_bir_accredited boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Seed a single row if none exists.
insert into business_settings (business_name)
select 'SAIKO RAMEN & SUSHI'
where not exists (select 1 from business_settings);

create or replace function set_business_settings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists business_settings_set_updated_at on business_settings;
create trigger business_settings_set_updated_at
  before update on business_settings
  for each row execute function set_business_settings_updated_at();

alter table business_settings enable row level security;

drop policy if exists "anon read business settings" on business_settings;
create policy "anon read business settings"
  on business_settings for select
  to anon
  using (true);

drop policy if exists "auth manage business settings" on business_settings;
create policy "auth manage business settings"
  on business_settings for all
  to authenticated
  using (true) with check (true);

-- Add BIR-related columns to orders.
alter table orders
  add column if not exists or_number text,
  add column if not exists vat_amount numeric(10,2) not null default 0
    check (vat_amount >= 0),
  add column if not exists vatable_sales numeric(10,2) not null default 0
    check (vatable_sales >= 0),
  add column if not exists vat_exempt_sales numeric(10,2) not null default 0
    check (vat_exempt_sales >= 0),
  add column if not exists senior_pwd_discount numeric(10,2) not null default 0
    check (senior_pwd_discount >= 0),
  add column if not exists senior_pwd_id text,
  add column if not exists senior_pwd_name text;

create unique index if not exists orders_or_number_idx on orders(or_number) where or_number is not null;
create index if not exists orders_senior_pwd_idx on orders(senior_pwd_id) where senior_pwd_id is not null;

-- Helper: get next OR number atomically.
create or replace function next_or_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings business_settings%rowtype;
  v_number integer;
  v_or_number text;
begin
  update business_settings
     set or_next_number = or_next_number + 1
   returning * into v_settings;

  v_number := v_settings.or_next_number - 1;
  v_or_number := v_settings.or_prefix || '-' || lpad(v_number::text, 4, '0');

  return v_or_number;
end;
$$;

revoke all on function next_or_number() from public;
grant execute on function next_or_number() to authenticated;

-- Replace counter RPC with BIR-aware version.
drop function if exists place_counter_order(text, text, numeric, text, numeric, text, jsonb);

create or replace function place_counter_order(
  p_customer_name text,
  p_customer_phone text,
  p_subtotal numeric,
  p_total_amount numeric,
  p_payment_method text,
  p_amount_received numeric,
  p_notes text,
  p_senior_pwd boolean,
  p_senior_pwd_id text,
  p_senior_pwd_name text,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number text,
  or_number text,
  vatable_sales numeric,
  vat_amount numeric,
  vat_exempt_sales numeric,
  senior_pwd_discount numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_order_number text;
  v_or_number text;
  v_tracking_token text;
  v_settings business_settings%rowtype;
  v_vatable numeric := 0;
  v_vat numeric := 0;
  v_vat_exempt numeric := 0;
  v_senior_discount numeric := 0;
  v_total numeric := p_total_amount;
  v_subtotal numeric := p_subtotal;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  select * into v_settings from business_settings limit 1;

  v_or_number := next_or_number();
  v_tracking_token := replace(gen_random_uuid()::text, '-', '');

  if p_senior_pwd then
    v_senior_discount := round(v_subtotal * 0.20, 2);
    v_vat_exempt := v_subtotal - v_senior_discount;
    v_total := v_vat_exempt;
  elsif coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_subtotal - v_vat;
    v_total := v_subtotal;
  else
    v_total := v_subtotal;
  end if;

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    subtotal,
    total_amount,
    status,
    channel,
    payment_method,
    amount_received,
    or_number,
    vatable_sales,
    vat_amount,
    vat_exempt_sales,
    senior_pwd_discount,
    senior_pwd_id,
    senior_pwd_name,
    tracking_token
  )
  values (
    coalesce(nullif(trim(p_customer_name), ''), 'Walk-in'),
    coalesce(nullif(trim(p_customer_phone), ''), 'walk-in'),
    'Walk-in (now)',
    now(),
    false,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_subtotal,
    v_total,
    'completed',
    'counter',
    nullif(trim(coalesce(p_payment_method, '')), ''),
    p_amount_received,
    v_or_number,
    v_vatable,
    v_vat,
    v_vat_exempt,
    v_senior_discount,
    nullif(trim(coalesce(p_senior_pwd_id, '')), ''),
    nullif(trim(coalesce(p_senior_pwd_name, '')), ''),
    v_tracking_token
  )
  returning id, orders.order_number, or_number into v_order_id, v_order_number, v_or_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  return query select v_order_id, v_order_number, v_or_number, v_vatable, v_vat, v_vat_exempt, v_senior_discount;
end;
$fn$;

revoke all on function place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, jsonb) from public;
grant execute on function place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, jsonb) to authenticated;
```

**Compatibility note:** This migration assumes the column `subtotal` already exists on `orders`. If Phase 4A (`008_promo_codes.sql`) has been applied, it does. If Phase 4A has NOT been applied yet, this migration must add `subtotal` itself. To keep the migration self-contained, **add this line near the top of the alter table block:**

```sql
alter table orders
  add column if not exists subtotal numeric(10,2);
```

(Idempotent. If 008 added it, this line is a no-op.)

### 8. `client/src/lib/businessSettings.tsx`
Context provider + hook for the public-callable business settings.

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { BusinessSettings } from "./supabase";

const Ctx = createContext<{ settings: BusinessSettings | null; loading: boolean; refresh: () => Promise<void> } | null>(null);

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
    setSettings((data as BusinessSettings) ?? null);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  return <Ctx.Provider value={{ settings, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useBusinessSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBusinessSettings must be used inside BusinessSettingsProvider");
  return v;
}
```

Wrap App.tsx with `<BusinessSettingsProvider>` next to `<MenuOverridesProvider>`.

### 9. `client/src/pages/admin/Settings.tsx`
Admin settings page wrapped in `AdminLayout`. Form to manage `business_settings`.

**Fields:**
- Business Name (required)
- TIN (text, format hint: 123-456-789-000)
- Address (textarea)
- Contact (text)
- VAT Registered (checkbox)
- VAT Rate (number, default 12.00, only enabled when VAT Registered)
- OR Prefix (text, default `SAIKO-OR`)
- OR Next Number (number, read-only, shows the next OR number that will be issued — set to large value carefully if importing prior receipts)
- Receipt Footer (textarea, optional)
- BIR Accredited (checkbox, with help text: "Only check this if Saiko is BIR-accredited. Defaults to provisional receipts otherwise.")

**Save:** `supabase.from("business_settings").update({...}).eq("id", settings.id)` then `refresh()`.

Loading + error states. Brand colors only. Mobile-friendly layout.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- **No new npm dependencies.**
- Brand colors only.
- Do NOT modify any in-flight uncommitted file.
- Do NOT modify migrations 001-009 (treat 008 as if it's already applied; if it isn't, the `add column if not exists subtotal` in 010 covers the gap).
- The Senior/PWD discount in 5B is **all-or-nothing per order**. Phase 5C+ may add per-line eligibility.
- Receipt header must NOT say "OFFICIAL RECEIPT" unless `is_bir_accredited` is true. Default to "PROVISIONAL RECEIPT".

## Reference patterns
- Context provider pattern: `client/src/lib/itemOverrides.tsx`
- Admin settings-style page: closest existing is `Products.tsx` (CRUD with inline saves)
- Migration with conditional column add: `supabase/migrations/20260426_007_order_tracking_tokens.sql`
- Counter RPC pattern: `supabase/migrations/20260426_009_counter_orders.sql` (Phase 5A; this spec replaces its RPC with a BIR-aware version)

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `supabase/migrations/20260426_010_bir_settings.sql` exists
- [ ] `client/src/pages/admin/Settings.tsx` exists
- [ ] `client/src/lib/businessSettings.tsx` exists with `BusinessSettingsProvider` + `useBusinessSettings`
- [ ] `App.tsx` wraps the tree with `<BusinessSettingsProvider>`
- [ ] `App.tsx` registers `/admin/settings` route
- [ ] `grep -n "Settings" client/src/components/AdminLayout.tsx` returns at least one match (the new nav)
- [ ] `grep -n "PROVISIONAL RECEIPT" client/src/components/CounterReceipt.tsx` returns at least one match
- [ ] `grep -n "OFFICIAL RECEIPT" client/src/components/CounterReceipt.tsx` returns at least one match
- [ ] `grep -n "next_or_number" supabase/migrations/20260426_010_bir_settings.sql` returns at least one match
- [ ] `grep -n "p_senior_pwd" supabase/migrations/20260426_010_bir_settings.sql` returns at least one match
- [ ] `grep -n "place_order_with_items" supabase/migrations/20260426_010_bir_settings.sql` returns nothing (we did not modify the customer RPC)

## Out of scope
- BIR accreditation paperwork or third-party audit
- Direct BIR e-filing or e-receipt submission
- Z-reading / X-reading reports (Phase 5C)
- Per-line Senior/PWD eligibility (only specific items qualify) — current is all-or-nothing
- Refund / void flow with proper BIR documentation
- Multi-branch settings (single-row settings only)
- Tamper-proof receipt sequencing with hash chains

## Notes for Codex
- VAT math is rounded to 2 decimals using Postgres `round(value, 2)`.
- The `next_or_number` function uses `update business_settings set or_next_number = or_next_number + 1 returning *` for atomicity. Concurrent counter orders cannot collide.
- The single business_settings row pattern: insert seed row in migration, never delete, only update.
- `nullif(trim(coalesce(...)), '')` is the idiom for "if the input is whitespace or empty, store NULL".
- The receipt component must NOT make any database call. It receives all needed data via props.
- The Counter page's RPC return now includes VAT and discount fields. Pass them through to `<CounterReceipt />` so the printed numbers exactly match what the DB recorded.
- The Settings page form: when toggling VAT off, set VAT Rate input to disabled but keep the value displayed. When toggling on, re-enable.
- The OR Next Number field on the Settings form should be editable but with a confirmation modal before saving any change ("Changing the OR sequence may break BIR audit trails. Are you sure?").
- `is_bir_accredited` checkbox: only flips the receipt header. Does NOT actually accredit Saiko.
- Verify with `git diff --name-only` before completing — diff should only include files explicitly named in this spec.
