# Task: phase-7a-tables

## Goal
Add a Tables grid for dine-in service. Staff sees all 23 tables as cards. Clicking a card opens an order entry page for that table where each "round" of ordering creates a separate order (status=preparing), prints kitchen + bar tickets automatically, and stays on the page so more rounds can be added. When the customer asks for the bill, "Close & Bill" aggregates all open rounds, captures payment, and prints one consolidated Table Bill. The existing Counter (walk-in) page stays unchanged.

## Why
Saiko serves dine-in customers who order in rounds (food first, drinks during meal, dessert at the end). Single-submission Counter mode doesn't fit. Staff also need food/drinks routed to kitchen and bar separately. A visual table grid lets staff see at a glance which tables have open tabs and how long they have been seated.

## Critical compatibility notes
- The existing Counter page (`/admin/counter`) and its CounterReceipt stay unchanged. Walk-in flow is untouched.
- The existing `place_counter_order` RPC is NOT modified.
- This phase ADDS new RPCs and a new column. It does not change schema for existing orders.
- Migration number is `011_table_orders.sql`. Migrations 001-010 may or may not all be applied; this one only needs 001 (orders + order_items) and 010 (business_settings) to function.
- Real-time updates on the Tables grid use Supabase Realtime channels.

## Files to modify

### 1. `client/src/lib/supabase.ts`
Append to `OrderRow`:
```ts
table_number?: string | null;
```

### 2. `client/src/components/AdminLayout.tsx`
Add **Tables** nav item between **Counter** and **Products**. Use the `LayoutGrid` icon from lucide-react. Active state when location starts with `/admin/tables`. Match existing nav styling. Do NOT remove the Counter nav item.

### 3. `client/src/App.tsx`
Register two new protected routes (place near other admin routes):
```tsx
<Route path={"/admin/tables"}>
  <AdminGuard>
    <AdminTables />
  </AdminGuard>
</Route>
<Route path={"/admin/tables/:tableId"}>
  {(params) => (
    <AdminGuard>
      <AdminTableOrder tableId={params.tableId} />
    </AdminGuard>
  )}
</Route>
```
Add the imports:
```tsx
import AdminTables from "./pages/admin/Tables";
import AdminTableOrder from "./pages/admin/TableOrder";
```

## Files to create

### 4. `client/src/lib/tables.ts`
Hardcoded table list. Adjust if Ken corrects the capacities later.

```ts
export interface TableDef {
  id: string;
  number: number;
  capacity: string;
}

export const TABLES: TableDef[] = [
  { id: "T1", number: 1, capacity: "5-6 pax" },
  { id: "T2", number: 2, capacity: "5-6 pax" },
  { id: "T3", number: 3, capacity: "5-6 pax" },
  { id: "T4", number: 4, capacity: "5-6 pax" },
  { id: "T5", number: 5, capacity: "4 pax" },
  { id: "T6", number: 6, capacity: "4 pax" },
  { id: "T7", number: 7, capacity: "4 pax" },
  { id: "T8", number: 8, capacity: "4 pax" },
  { id: "T9", number: 9, capacity: "2 pax" },
  { id: "T10", number: 10, capacity: "2 pax" },
  { id: "T11", number: 11, capacity: "4 pax" },
  { id: "T12", number: 12, capacity: "2 pax" },
  { id: "T13", number: 13, capacity: "2 pax" },
  { id: "T14", number: 14, capacity: "4 pax" },
  { id: "T15", number: 15, capacity: "4 pax" },
  { id: "T16", number: 16, capacity: "4 pax" },
  { id: "T17", number: 17, capacity: "4 pax" },
  { id: "T18", number: 18, capacity: "4 pax" },
  { id: "T19", number: 19, capacity: "4 pax" },
  { id: "T20", number: 20, capacity: "4 pax" },
  { id: "T21", number: 21, capacity: "6-8 pax" },
  { id: "T22", number: 22, capacity: "6-8 pax" },
  { id: "T23", number: 23, capacity: "6-8 pax" },
];

export function getTable(id: string): TableDef | undefined {
  return TABLES.find((t) => t.id === id);
}
```

### 5. `supabase/migrations/20260618_011_table_orders.sql`

```sql
-- Phase 7A: dine-in table orders

alter table orders
  add column if not exists table_number text;

create index if not exists orders_table_open_idx
  on orders(table_number, status)
  where table_number is not null and status in ('preparing','ready');

-- RPC: open a new round for a table.
-- Creates an order with status='preparing', table_number stamped, NO payment fields yet.
-- VAT breakdown computed per round so each round's OR is BIR-compliant.
-- Senior/PWD is NOT handled here; applied at close-bill time.

create or replace function place_table_round(
  p_table_number text,
  p_subtotal numeric,
  p_notes text,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number text,
  or_number text,
  vatable_sales numeric,
  vat_amount numeric
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
begin
  if p_table_number is null or trim(p_table_number) = '' then
    raise exception 'Table number is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  select * into v_settings from business_settings limit 1;

  v_or_number := next_or_number();
  v_tracking_token := replace(gen_random_uuid()::text, '-', '');

  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(p_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := p_subtotal - v_vat;
  end if;

  insert into orders (
    customer_name, customer_phone, pickup_label, pickup_time,
    is_pre_order, notes, subtotal, total_amount, status, channel,
    table_number, or_number, vatable_sales, vat_amount, tracking_token
  )
  values (
    'Table ' || p_table_number, 'dine-in', 'Dine-in (now)', now(),
    false, nullif(trim(coalesce(p_notes, '')), ''),
    p_subtotal, p_subtotal, 'preparing', 'counter',
    trim(p_table_number), v_or_number, v_vatable, v_vat, v_tracking_token
  )
  returning id, orders.order_number, or_number into v_order_id, v_order_number, v_or_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text, item_name text, unit_price numeric,
    quantity integer, line_total numeric
  );

  return query select v_order_id, v_order_number, v_or_number, v_vatable, v_vat;
end;
$fn$;

revoke all on function place_table_round(text, numeric, text, jsonb) from public;
grant execute on function place_table_round(text, numeric, text, jsonb) to authenticated;

-- RPC: close all open rounds for a table.
-- Aggregates totals, applies Senior/PWD discount if requested, updates payment fields.
-- Returns aggregated info for the printed bill.

create or replace function close_table_bill(
  p_table_number text,
  p_payment_method text,
  p_amount_received numeric,
  p_senior_pwd boolean,
  p_senior_pwd_id text,
  p_senior_pwd_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_settings business_settings%rowtype;
  v_subtotal numeric := 0;
  v_senior_discount numeric := 0;
  v_total numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
  v_vat_exempt numeric := 0;
  v_or_first text;
  v_or_last text;
  v_round_count integer;
  v_rounds jsonb;
begin
  if p_table_number is null or trim(p_table_number) = '' then
    raise exception 'Table number is required';
  end if;

  select * into v_settings from business_settings limit 1;

  -- Aggregate subtotal across open rounds for this table.
  select coalesce(sum(subtotal), 0), min(or_number), max(or_number), count(*)
    into v_subtotal, v_or_first, v_or_last, v_round_count
    from orders
   where table_number = trim(p_table_number)
     and status in ('preparing','ready');

  if v_round_count = 0 then
    raise exception 'No open rounds for table %', p_table_number;
  end if;

  -- Compute taxes / discount on the aggregated subtotal.
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

  -- Snapshot of every round being closed (returned to the client for the printed bill).
  select jsonb_agg(jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'or_number', o.or_number,
    'created_at', o.created_at,
    'subtotal', o.subtotal,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total
      ) order by oi.id)
      from order_items oi where oi.order_id = o.id
    )
  ) order by o.created_at)
  into v_rounds
  from orders o
  where o.table_number = trim(p_table_number)
    and o.status in ('preparing','ready');

  -- Close every open round atomically and stamp the payment + senior/pwd fields.
  update orders
     set status = 'completed',
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         amount_received = p_amount_received,
         senior_pwd_discount = case
           when p_senior_pwd then round(subtotal * 0.20, 2)
           else 0
         end,
         senior_pwd_id = case when p_senior_pwd then nullif(trim(coalesce(p_senior_pwd_id, '')), '') else null end,
         senior_pwd_name = case when p_senior_pwd then nullif(trim(coalesce(p_senior_pwd_name, '')), '') else null end,
         vat_exempt_sales = case when p_senior_pwd then subtotal - round(subtotal * 0.20, 2) else 0 end,
         vat_amount = case when p_senior_pwd then 0 else vat_amount end,
         vatable_sales = case when p_senior_pwd then 0 else vatable_sales end
   where table_number = trim(p_table_number)
     and status in ('preparing','ready');

  return jsonb_build_object(
    'table_number', trim(p_table_number),
    'rounds', v_rounds,
    'round_count', v_round_count,
    'or_first', v_or_first,
    'or_last', v_or_last,
    'subtotal', v_subtotal,
    'senior_discount', v_senior_discount,
    'vatable_sales', v_vatable,
    'vat_amount', v_vat,
    'vat_exempt_sales', v_vat_exempt,
    'total', v_total,
    'payment_method', nullif(trim(coalesce(p_payment_method, '')), ''),
    'amount_received', p_amount_received,
    'change', greatest(coalesce(p_amount_received, 0) - v_total, 0),
    'senior_pwd', coalesce(p_senior_pwd, false),
    'senior_pwd_id', nullif(trim(coalesce(p_senior_pwd_id, '')), ''),
    'senior_pwd_name', nullif(trim(coalesce(p_senior_pwd_name, '')), '')
  );
end;
$fn$;

revoke all on function close_table_bill(text, text, numeric, boolean, text, text) from public;
grant execute on function close_table_bill(text, text, numeric, boolean, text, text) to authenticated;
```

### 6. `client/src/pages/admin/Tables.tsx`
Wrapped in `AdminLayout`. Sequential grid of all 23 tables.

**Fetch on mount:**
```ts
const { data: openOrders } = await supabase
  .from("orders")
  .select("id, table_number, total_amount, created_at")
  .in("status", ["preparing", "ready"])
  .not("table_number", "is", null);
```

Build a `Map<tableId, { roundCount, total, openedAt }>` by grouping `openOrders`.

**Realtime subscription:**
```ts
const channel = supabase.channel("tables-status")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "table_number=not.is.null" }, () => loadTables())
  .subscribe();
return () => { supabase.removeChannel(channel); };
```

**Layout:**
- Header: "Tables" + "Refresh" icon button (manual refresh; realtime should keep it live anyway)
- Grid: 2 cols mobile, 3 cols tablet, 4-5 cols desktop
- Each card uses `TABLES` from `lib/tables.ts`
- Empty card: cream background, table number large, capacity small under it, "Empty" badge
- Open card: green tint, table number large, capacity small, status badge "Open · ₱X,XXX · 32 min", click to navigate

**Card click handler:** `navigate("/admin/tables/T5")`

Brand styling. Loading + error states. Use `useLocation` from wouter for nav.

### 7. `client/src/pages/admin/TableOrder.tsx`
Per-table order entry page. Wrapped in `AdminLayout`.

**Props:** `{ tableId: string }`

**On mount:**
1. Look up `getTable(tableId)`. If not found, show "Table not found" + back link.
2. Fetch open rounds for this table:
   ```ts
   supabase.from("orders").select("*, order_items(*)").eq("table_number", tableId).in("status", ["preparing","ready"]);
   ```
3. Subscribe to Supabase Realtime for this table's rounds so if another terminal closes the bill, this page reflects it.

**Layout:**
Top bar: back arrow to `/admin/tables`, table number (e.g., "Table 5 · 4 pax"), open status (e.g., "Open since 6:42 PM · ₱1,200 running"), "Close & Bill" button (primary red, top right).

**Two-pane body:**
- Left pane: menu tap-grid (reuse the same category chips, search, item card layout as Counter.tsx — extract into a shared `MenuTapGrid` component if it makes sense, otherwise duplicate the code, both are acceptable).
- Right pane:
  - **Open Rounds list at the top**: collapsed cards, one per round. Each shows: round number, time, items count, subtotal. Tap to expand and see items.
  - **Current Round Being Built**: the cart for the next Submit. Item list with qty +/- and remove.
  - Notes field (applies only to the round being submitted)
  - **Submit Round** button (primary red). Disabled if cart empty.

**Submit Round handler:**
1. Validate cart not empty.
2. Compute subtotal.
3. Split items into `kitchenItems` (non-drinks) and `barItems` (drinks). To determine category for each item: stamp `category` on each cart item at add-time (the `addToOrder` helper needs to know which category the item came from).
4. Call `place_table_round` RPC with subtotal, notes, items.
5. On success:
   - Pop the printingTicket state: `{ orderNumber, orNumber, table: tableDef, kitchenItems, barItems, createdAt: new Date() }`
   - Trigger `window.print()` after a 200ms delay
   - Clear the cart and notes
   - Refresh open rounds list (or rely on realtime)
6. On error: show inline error message in red.

**Close & Bill handler:**
1. Open a modal asking for payment method, cash received (if cash), Senior/PWD toggle + ID + name (if applicable).
2. Compute bill preview using current open rounds list.
3. On confirm:
   - Call `close_table_bill` RPC.
   - On success:
     - Set printingBill state with the returned aggregation JSON.
     - Trigger `window.print()` after a 200ms delay to print the Table Bill.
     - Navigate to `/admin/tables` after print starts (or after a short success toast).
4. On error: show inline error.

**State (high level):**
```ts
const [orderItems, setOrderItems] = useState<TableCartItem[]>([]);
const [notes, setNotes] = useState("");
const [openRounds, setOpenRounds] = useState<RoundWithItems[]>([]);
const [submittingRound, setSubmittingRound] = useState(false);
const [printingTicket, setPrintingTicket] = useState<TicketPayload | null>(null);
const [closing, setClosing] = useState(false);
const [closeForm, setCloseForm] = useState({ paymentMethod: "cash" as "cash"|"gcash"|"card", cashReceived: "", senior: false, seniorId: "", seniorName: "" });
const [printingBill, setPrintingBill] = useState<BillPayload | null>(null);
const [error, setError] = useState<string | null>(null);
```

**TableCartItem shape:** `{ id, name, price, quantity, image?, category: string }`. Category is the menuData category id (e.g., "drinks", "ramen"), used to split tickets.

**Drinks detection:** `barItems = orderItems.filter(i => i.category === "drinks"); kitchenItems = orderItems.filter(i => i.category !== "drinks");`

### 8. `client/src/components/RoundTicket.tsx`
Printable component for a single ticket (kitchen OR bar). Re-uses CounterReceipt's print pattern.

**Props:**
```ts
interface RoundTicketProps {
  kind: "kitchen" | "bar";
  tableNumber: string;
  capacity: string;
  orderNumber: string;
  orNumber: string;
  items: { name: string; quantity: number }[]; // no prices on kitchen/bar tickets
  notes?: string;
  createdAt: Date;
}
```

**Layout (80mm thermal):**
```
=== KITCHEN ===          (or === BAR ===)
TABLE 5 (4 pax)
Order: SAIKO-0042
OR: SAIKO-OR-0010
Time: 6:42 PM

-------------------------
2x Wagyu Ramen
3x Pork Gyoza
1x Lava Rice
-------------------------

Notes: Konting kanin lang
```

No prices. No payment info. Just what to cook.

Use monospace font, large legible text. `@page { size: 80mm auto; margin: 0; }`.

### 9. `client/src/components/TableBill.tsx`
Printable consolidated bill shown when Close & Bill completes.

**Props:**
```ts
interface TableBillProps {
  table: TableDef;
  rounds: Array<{
    order_number: string;
    or_number: string;
    created_at: string;
    subtotal: number;
    items: Array<{ item_name: string; quantity: number; unit_price: number; line_total: number }>;
  }>;
  subtotal: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  seniorDiscount: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  seniorPwd: boolean;
  seniorPwdId?: string | null;
  seniorPwdName?: string | null;
  settings: BusinessSettings;
}
```

**Layout (80mm thermal):**
```
SAIKO RAMEN & SUSHI
<TIN>
<address>

PROVISIONAL TABLE BILL          (or OFFICIAL TABLE BILL if accredited)
Table 5 (4 pax)
Date: 2026-06-18 19:30

ROUND 1 — 6:42 PM — OR: SAIKO-OR-0010
  2x Wagyu Ramen ............ 830
  1x Lava Rice .............. 359
  Subtotal: 1,189

ROUND 2 — 7:05 PM — OR: SAIKO-OR-0011
  3x Mango Shake ............ 405
  Subtotal: 405

ROUND 3 — 7:30 PM — OR: SAIKO-OR-0012
  2x Halo-Halo .............. 360
  Subtotal: 360

============================
GRAND SUBTOTAL .... 1,954
{if senior:}
Senior/PWD (-20%) .. -390.80
VAT-Exempt Sales ... 1,563.20
{if VAT registered, not senior:}
VAT-able Sales ..... 1,744.64
VAT (12%) .......... 209.36
{always:}
TOTAL .............. <bold large>

Payment (Cash) ..... 2,000
Change ............. 46

{if not BIR accredited:}
This is a provisional bill for tracking only.
Not a BIR Official Receipt.
```

Use the same `@media print` rules as CounterReceipt to hide non-print elements.

### 10. `client/src/components/RoundsListModal.tsx` (optional, can be inlined)
The Close & Bill modal. Reusable in the future. Keep it inline in TableOrder.tsx if simpler.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- **No new npm dependencies.**
- Brand colors only.
- Counter page and CounterReceipt are NOT modified.
- The existing `place_counter_order` RPC is NOT modified.
- No changes to public-facing pages, customer cart, or checkout flow.
- Use `Number()` to cast numeric Supabase fields.
- Drinks split logic uses category id `drinks` strictly.

## Reference patterns
- Existing admin page wrapper: `client/src/pages/admin/Counter.tsx` (similar two-pane layout)
- Sticky bottom action: `client/src/pages/admin/OrderDetail.tsx`
- Realtime subscription: `client/src/lib/adminRealtime.ts` (if present)
- Counter RPC: `supabase/migrations/20260426_010_bir_settings.sql`
- Print receipt: `client/src/components/CounterReceipt.tsx`
- Admin nav item: `client/src/components/AdminLayout.tsx`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `supabase/migrations/20260618_011_table_orders.sql` exists
- [ ] `client/src/lib/tables.ts` exists and exports `TABLES` (23 entries) and `getTable`
- [ ] `client/src/pages/admin/Tables.tsx` exists
- [ ] `client/src/pages/admin/TableOrder.tsx` exists
- [ ] `client/src/components/RoundTicket.tsx` exists
- [ ] `client/src/components/TableBill.tsx` exists
- [ ] `App.tsx` registers `/admin/tables` and `/admin/tables/:tableId` routes both protected by `AdminGuard`
- [ ] `grep -n "place_table_round" client/src/pages/admin/TableOrder.tsx` returns at least one match
- [ ] `grep -n "close_table_bill" client/src/pages/admin/TableOrder.tsx` returns at least one match
- [ ] `grep -n "Tables" client/src/components/AdminLayout.tsx` returns at least one match (the new nav)
- [ ] The Counter page (`client/src/pages/admin/Counter.tsx`) is NOT modified
- [ ] The CounterReceipt component is NOT modified
- [ ] `grep -n "table_number" client/src/lib/supabase.ts` returns at least one match

## Out of scope
- Open Tab page with running per-table state shown over time (defer to Phase 7B)
- Drag-and-drop table layout / floor plan editor
- Reservations
- Transfer items between tables
- Split bill across multiple payment methods
- Per-cashier accountability
- Voiding individual rounds after Submit
- Editing items in a submitted round
- Reprinting old Table Bills from the admin Orders list
- Custom kitchen/bar routing per item (everything other than `drinks` goes to kitchen)

## Notes for Codex
- The two-pane layout from Counter.tsx is a good reference. Feel free to duplicate the menu tap-grid markup into TableOrder.tsx rather than extracting a shared component, especially if the structure diverges (e.g., open rounds list above the cart).
- For the dual print (kitchen + bar), render both ticket components inside a single `print-tickets-root` container with `page-break-after: always` on the first ticket. A single `window.print()` triggers both pages.
- If the round has only food, render only the kitchen ticket. If only drinks, only the bar ticket.
- When a customer is Senior/PWD, the entire table's total gets the 20% off and is VAT-exempt. Individual rounds keep their original VAT breakdown in the DB for audit, but the printed bill shows the aggregated senior treatment. The RPC handles the math.
- For Supabase Realtime, listen to changes on `orders` table with a filter so the Tables grid auto-updates when another terminal opens or closes a tab.
- `notes` on the round goes onto the kitchen ticket. Be loud about it on the ticket so kitchen sees it.
- After Submit Round, clear the cart and notes but stay on the page. Staff might immediately add another round.
- After Close & Bill, navigate back to `/admin/tables` once the print dialog has opened (use `setTimeout` to let the print start, then navigate).
- The Close & Bill modal MUST not allow submission if `paymentMethod === "cash"` and `Number(cashReceived) < grandTotal`. Show an inline error.
- Verify with `git diff --name-only` before completing — the diff should only include files explicitly named in this spec.
- Override for this session: you ARE allowed to git add, commit, and push to origin/master after the acceptance checks pass. Use a clear commit message: `Phase 7A: Tables grid + dine-in order entry with kitchen/bar tickets`.
