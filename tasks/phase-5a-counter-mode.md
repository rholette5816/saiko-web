# Task: phase-5a-counter-mode

## Goal
Add a tablet-friendly counter / cashier order entry page at `/admin/counter` so staff can punch in walk-in orders, take payment, and produce a printable receipt. Walk-in orders land in the existing `orders` table flagged with `channel='counter'` and `status='completed'`.

## Why
Saiko does in-store sales but currently has no fast way to capture them. The web order flow is built for customer self-service. Counter mode is a separate UI optimized for one-handed tap entry, payment, and immediate printable receipt.

## Critical compatibility notes
- Reuses existing `orders` + `order_items` tables. Adds new optional columns: `channel`, `payment_method`, `amount_received`. Defaults preserve existing web behavior (`channel='web'`, others null).
- Adds a new RPC `place_counter_order` separate from `place_order_with_items`. Existing customer flow is untouched.
- Migration number is `009_counter_orders.sql`. Migrations 001-008 may exist; 009 is the next free slot.
- Does NOT add VAT, senior/PWD, OR numbering, or business settings. Those land in Phase 5B.
- Receipt is a basic non-BIR-compliant format with a clear "Not an Official Receipt" disclaimer. Phase 5B replaces the receipt with BIR-compliant fields once business info is captured.

## Files to modify

### 1. `client/src/lib/supabase.ts`
Extend `OrderRow` with three optional fields (append, do not remove anything else):
```ts
channel?: "web" | "counter" | null;
payment_method?: string | null;
amount_received?: number | null;
```

### 2. `client/src/components/AdminLayout.tsx`
Add a **Counter** nav item between **Orders** and **Products**. Use the `Receipt` or `Calculator` icon from lucide-react. Active state when location starts with `/admin/counter`.

### 3. `client/src/App.tsx`
Register the protected route alongside the other admin routes:
```tsx
<Route path={"/admin/counter"}>
  <AdminGuard>
    <AdminCounter />
  </AdminGuard>
</Route>
```
Add the import: `import AdminCounter from "./pages/admin/Counter";`

## Files to create

### 4. `supabase/migrations/20260426_009_counter_orders.sql`

```sql
-- Phase 5A: counter / walk-in orders. Adds channel + payment fields and a dedicated RPC.

alter table orders
  add column if not exists channel text not null default 'web'
    check (channel in ('web', 'counter')),
  add column if not exists payment_method text,
  add column if not exists amount_received numeric(10,2)
    check (amount_received is null or amount_received >= 0);

create index if not exists orders_channel_idx on orders(channel);

create or replace function place_counter_order(
  p_customer_name text,
  p_customer_phone text,
  p_total_amount numeric,
  p_payment_method text,
  p_amount_received numeric,
  p_notes text,
  p_items jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  v_tracking_token := replace(gen_random_uuid()::text, '-', '');

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    total_amount,
    status,
    channel,
    payment_method,
    amount_received,
    tracking_token
  )
  values (
    coalesce(nullif(trim(p_customer_name), ''), 'Walk-in'),
    coalesce(nullif(trim(p_customer_phone), ''), 'walk-in'),
    'Walk-in (now)',
    now(),
    false,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_total_amount,
    'completed',
    'counter',
    nullif(trim(coalesce(p_payment_method, '')), ''),
    p_amount_received,
    v_tracking_token
  )
  returning id, orders.order_number into v_order_id, v_order_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  return query select v_order_id, v_order_number;
end;
$fn$;

revoke all on function place_counter_order(text, text, numeric, text, numeric, text, jsonb) from public;
grant execute on function place_counter_order(text, text, numeric, text, numeric, text, jsonb) to authenticated;
```

Notes:
- Tracking token is generated for consistency with web orders (so the order shows in /track/:token if needed).
- `customer_phone` defaults to literal `'walk-in'` when blank because the column is `not null` from migration 001.
- `pickup_label` defaults to `'Walk-in (now)'` and `pickup_time` to `now()` for the same reason.
- Function is `to authenticated` only. Anon cannot call this (counter is admin-only).

### 5. `client/src/pages/admin/Counter.tsx`
Tablet-optimized two-pane page wrapped in `AdminLayout`.

**Layout (desktop / tablet):**
- Left pane (60% width): menu grid
  - Category filter chips at top (use `menuData` categories)
  - Search input above the grid
  - Items rendered as tap targets (`bg-white rounded-lg p-3` cards in a 3-4 col grid). On tap: add to current order (qty 1) or increment if already in order. Show price, name, and tiny image if available.
- Right pane (40% width): current order
  - List of line items with name, unit price, qty stepper (-/+ pill), line total, remove button
  - Subtotal at the bottom
  - Customer name field (optional, placeholder "Walk-in")
  - Customer phone field (optional)
  - Notes field (optional)
  - Payment method radio: Cash / GCash / Card
  - Cash received input (only shown when Cash; auto-computes change due)
  - **Submit & Print** button (primary red); disabled if cart empty
  - **Cancel / Reset** button (secondary)

**Mobile (`<md`):**
- Single column. Menu grid first, current order below as a fixed bottom sheet that expands when items are present. Acceptable to have a "View Cart" button that toggles the sheet on mobile.

**State:**
```ts
const [activeCategory, setActiveCategory] = useState<string>("all");
const [search, setSearch] = useState("");
const [orderItems, setOrderItems] = useState<{ id: string; name: string; price: number; quantity: number; image?: string }[]>([]);
const [customerName, setCustomerName] = useState("");
const [customerPhone, setCustomerPhone] = useState("");
const [notes, setNotes] = useState("");
const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "card">("cash");
const [cashReceived, setCashReceived] = useState("");
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const [printingOrder, setPrintingOrder] = useState<{ orderNumber: string; items: typeof orderItems; total: number; payment: string; received: number; change: number; customer: string; notes: string; createdAt: Date } | null>(null);
```

**Add to order helper:**
```ts
function addToOrder(item: { id: string; name: string; price: number; image?: string }) {
  setOrderItems((cur) => {
    const existing = cur.find((i) => i.id === item.id);
    if (existing) {
      return cur.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
    }
    return [...cur, { ...item, quantity: 1 }];
  });
}
```

**Submit handler:**
```ts
async function handleSubmit() {
  if (!orderItems.length) return;
  setSubmitting(true);
  setError(null);
  const subtotal = orderItems.reduce((n, i) => n + i.price * i.quantity, 0);
  const received = paymentMethod === "cash" ? Number(cashReceived || 0) : subtotal;
  if (paymentMethod === "cash" && received < subtotal) {
    setError("Cash received is less than the total.");
    setSubmitting(false);
    return;
  }

  const { data, error: rpcError } = await supabase.rpc("place_counter_order", {
    p_customer_name: customerName.trim(),
    p_customer_phone: customerPhone.trim(),
    p_total_amount: subtotal,
    p_payment_method: paymentMethod,
    p_amount_received: paymentMethod === "cash" ? received : subtotal,
    p_notes: notes.trim() || null,
    p_items: orderItems.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      unit_price: i.price,
      quantity: i.quantity,
      line_total: i.price * i.quantity,
    })),
  });

  if (rpcError) {
    setError(rpcError.message);
    setSubmitting(false);
    return;
  }

  const firstRow = Array.isArray(data) ? data[0] : data;
  const orderNumber = firstRow?.order_number ?? "";

  setPrintingOrder({
    orderNumber,
    items: orderItems,
    total: subtotal,
    payment: paymentMethod,
    received,
    change: Math.max(0, received - subtotal),
    customer: customerName.trim() || "Walk-in",
    notes: notes.trim(),
    createdAt: new Date(),
  });

  // Reset for next customer.
  setOrderItems([]);
  setCustomerName("");
  setCustomerPhone("");
  setNotes("");
  setCashReceived("");
  setPaymentMethod("cash");
  setSubmitting(false);
}
```

**Receipt print:**
When `printingOrder` is set, render `<CounterReceipt {...printingOrder} />` inside a `print-receipt` container. On mount of the receipt, call `window.print()` once with a small delay.

After printing (or after a brief "Order #SAIKO-XXXX completed" success toast), call `setPrintingOrder(null)` to dismiss. Provide a manual "Print Again" button on the success card.

### 6. `client/src/components/CounterReceipt.tsx`

Printable receipt component. Renders cleanly on screen and via print.

```tsx
interface Props {
  orderNumber: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  payment: string;
  received: number;
  change: number;
  customer: string;
  notes: string;
  createdAt: Date;
}

export function CounterReceipt(props: Props) {
  return (
    <div className="counter-receipt">
      <style>{`
        .counter-receipt {
          font-family: 'Courier New', monospace;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          padding: 1rem;
          color: #0d0f13;
        }
        .counter-receipt h1 {
          text-align: center;
          font-size: 1.1rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
        }
        .counter-receipt .center { text-align: center; }
        .counter-receipt hr { border: 0; border-top: 1px dashed #999; margin: 0.5rem 0; }
        .counter-receipt .row { display: flex; justify-content: space-between; gap: 0.5rem; }
        .counter-receipt .row.bold { font-weight: bold; }
        .counter-receipt .small { font-size: 0.7rem; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: white !important; }
          body > *:not(.print-receipt-root) { display: none !important; }
        }
      `}</style>
      <h1>SAIKO RAMEN & SUSHI</h1>
      <div className="center small">Oton, Iloilo</div>
      <hr />
      <div className="row small">
        <span>{new Date(props.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</span>
        <span>#{props.orderNumber}</span>
      </div>
      <div className="row small">
        <span>Customer:</span>
        <span>{props.customer}</span>
      </div>
      <hr />
      {props.items.map((item, idx) => (
        <div key={idx}>
          <div className="row">
            <span>{item.quantity}x {item.name}</span>
            <span>{(item.price * item.quantity).toLocaleString()}</span>
          </div>
          <div className="row small" style={{ paddingLeft: "0.75rem" }}>
            <span>@ {item.price}</span>
            <span></span>
          </div>
        </div>
      ))}
      <hr />
      <div className="row bold">
        <span>TOTAL</span>
        <span>PHP {props.total.toLocaleString()}</span>
      </div>
      <div className="row small">
        <span>Payment ({props.payment})</span>
        <span>PHP {props.received.toLocaleString()}</span>
      </div>
      {props.change > 0 && (
        <div className="row small">
          <span>Change</span>
          <span>PHP {props.change.toLocaleString()}</span>
        </div>
      )}
      {props.notes && (
        <>
          <hr />
          <div className="small"><strong>Notes:</strong> {props.notes}</div>
        </>
      )}
      <hr />
      <div className="center small">Salamat at bumalik kayo!</div>
      <div className="center small" style={{ marginTop: "0.5rem", fontSize: "0.6rem" }}>
        This is not an official BIR receipt.
      </div>
    </div>
  );
}
```

The `<style>` block above provides print rules: 80mm thermal width, hide non-receipt elements, no margins. If the user has an A4/A5 printer instead, the receipt will print on one page just centered — acceptable fallback.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- **No new npm dependencies.**
- Brand colors only.
- Do NOT modify any in-flight uncommitted file (TrackOrder.tsx, get-order-tracking, notify-order, attach-order-contact, lib/adminRealtime).
- Do NOT modify migrations 001-008.
- Do NOT modify the existing `place_order_with_items` RPC; counter has its own RPC.
- Do NOT modify the customer-facing Checkout, OrderConfirmed, or TrackOrder pages.

## Reference patterns
- Admin page wrapper: `client/src/pages/admin/Orders.tsx`
- Cart-style item state: `client/src/lib/cart.tsx`
- Print pattern: `client/src/pages/admin/PrintSlip.tsx` (for `@media print` rules)
- RPC call pattern: `client/src/pages/Checkout.tsx`
- Tablet-friendly grids: any 2-column layout in admin, e.g., `Dashboard.tsx`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `supabase/migrations/20260426_009_counter_orders.sql` exists
- [ ] `client/src/pages/admin/Counter.tsx` exists
- [ ] `client/src/components/CounterReceipt.tsx` exists
- [ ] `App.tsx` registers `/admin/counter` route protected by `AdminGuard`
- [ ] `grep -n "place_counter_order" client/src/pages/admin/Counter.tsx` returns at least one match
- [ ] `grep -n "Counter" client/src/components/AdminLayout.tsx` returns at least one match
- [ ] `grep -n "channel" client/src/lib/supabase.ts` returns at least one match (the new field on OrderRow)
- [ ] `grep -n "place_order_with_items" supabase/migrations/20260426_009_counter_orders.sql` returns nothing (we did not modify the existing RPC)

## Out of scope
- VAT, senior/PWD discounts, OR numbering (Phase 5B)
- Business settings page (Phase 5B)
- BIR-compliant receipt formatting (Phase 5B)
- End-of-day Z-reading report (Phase 5C)
- Refund / void flow
- Cash drawer integration
- Receipt printer hardware integration beyond `window.print()`
- Customer phone validation
- Discount stacking with promo codes (counter mode does not support promos in 5A)
- Editing or refunding a completed counter order

## Notes for Codex
- Tablet-first layout: optimize for landscape iPads, common in PH restaurants. Buttons large, tap targets generous (min 48px).
- The category chip "all" is a synthetic filter that shows every category. The other chips are `menuData` category names.
- Search filters items across all categories simultaneously regardless of active category chip.
- For the tap-grid card: clicking adds qty 1; if the item is already in the order, increment the existing line's qty.
- Keep counter UI fully separate from the customer cart context — do NOT use `useCart`. Counter has its own local state.
- The receipt component must work both inline (visible after submit, while the rest of the page is hidden via `@media print`) and on its own. The cleanest approach is to render `printingOrder` inside an absolutely-positioned `print-receipt-root` container that the `@media print` rule shows exclusively.
- If the cashier hits Submit twice quickly, the `submitting` flag must block the second click.
- Reset all order state after successful submit. Customer info, payment method, items — back to defaults.
- After successful order, show a small green success banner "Order #SAIKO-XXXX completed. Receipt printed." with a "Print Again" button and a "Dismiss" button.
- Cancel button: clears the current cart and customer info. Show a confirm prompt only if the cart has items.
- Verify with `git diff --name-only` before completing — diff should only include files explicitly named in this spec.
