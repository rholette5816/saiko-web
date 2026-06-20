# Task: data-center-run-1-views-rpcs

## Goal
Move Daily Report aggregation off the browser and onto Postgres. Same page, same look, but it pulls compact aggregate rows from RPCs instead of fetching every order with all its items.

## Why
Today `client/src/pages/admin/DailyReport.tsx` calls `supabase.from("orders").select("*, order_items(*)")` for the date range and then does every aggregation client side in `useMemo`. That ships thousands of rows over the wire and stalls for ranges over a week. Server side rollup makes a 30 day report load in under 500ms and unblocks the rest of the Data Center work.

## Files to create

### 1. `supabase/migrations/20260623_020_data_center_views.sql`
SQL migration. Postgres only.

Create these views and RPCs. All RPCs are `security definer`, `set search_path = public`, `revoke all from public`, `grant execute to authenticated`.

#### View `daily_sales_summary_v1`
One row per `(business_date, channel, status)`. `business_date` is `(created_at at time zone 'Asia/Manila')::date`.

Columns:
- `business_date date`
- `channel text` (`coalesce(channel, 'counter')`)
- `status text`
- `order_count bigint`
- `gross_sales numeric` (sum of `total_amount`)
- `subtotal_total numeric` (sum of `coalesce(subtotal, total_amount)`)
- `promo_discount numeric` (sum of `discount_amount` where `promo_code is not null`)
- `senior_pwd_discount numeric` (sum of `senior_pwd_discount`)
- `net_sales numeric` (gross_sales minus promo_discount minus senior_pwd_discount)
- `vatable_sales numeric`
- `vat_amount numeric`
- `vat_exempt_sales numeric`
- `cash_total numeric` (sum where lower(payment_method) = 'cash')
- `gcash_total numeric` (sum where lower(payment_method) = 'gcash')
- `card_total numeric` (sum where lower(payment_method) = 'card')
- `online_total numeric` (sum where payment_method is null or is not one of the three above)
- `first_or text` (min `or_number` where `or_number is not null`)
- `last_or text` (max `or_number` where `or_number is not null`)

Group by `business_date, channel, status`. No where clause on dates here. Filtering happens in the RPC.

#### View `daily_product_sales_v1`
One row per `(business_date, item_id, item_name)` joining `orders` and `order_items`. Use only orders with `status = 'completed'`.

Columns:
- `business_date date`
- `channel text`
- `item_id text`
- `item_name text`
- `qty_sold numeric` (sum quantity)
- `revenue numeric` (sum line_total)
- `order_count bigint` (count distinct order_id)

#### View `daily_table_sales_v1`
One row per `(business_date, channel, table_label)`. `table_label` is `coalesce(nullif(trim(table_number), ''), case when channel = 'web' then 'Web' else 'Counter' end)`. Only `status = 'completed'`.

Columns:
- `business_date date`
- `channel text`
- `table_label text`
- `order_count bigint`
- `item_count numeric` (sum of order_items.quantity for the order)
- `revenue numeric` (sum of total_amount)
- `cash_total numeric`
- `gcash_total numeric`
- `card_total numeric`
- `online_total numeric`
- `first_or text`
- `last_or text`

#### RPC `get_daily_summary(p_start date, p_end date, p_channel text default null, p_status text default null)`
Returns `setof daily_sales_summary_v1`.
- Filter `business_date between p_start and p_end`
- If `p_channel is not null` filter `channel = p_channel`
- If `p_status is not null` filter `status = p_status`
- `order by business_date, channel, status`

#### RPC `get_product_sales(p_start date, p_end date, p_channel text default null)`
Returns `setof daily_product_sales_v1`.
- Filter `business_date between p_start and p_end`
- If `p_channel is not null` filter `channel = p_channel`
- `order by business_date, revenue desc, item_name`

#### RPC `get_table_sales(p_start date, p_end date, p_channel text default null)`
Returns `setof daily_table_sales_v1`.
- Filter `business_date between p_start and p_end`
- If `p_channel is not null` filter `channel = p_channel`
- `order by business_date, table_label`

#### RPC `get_or_gaps(p_start date, p_end date)`
Returns `table(or_number text, prev_or text, next_or text)`. Finds non sequential OR numbers among completed orders inside the range.

Implementation:
- Collect `or_number` from `orders` where `status = 'completed'`, `or_number ~ '^[0-9]+$'`, and `business_date between p_start and p_end`.
- Sort numerically.
- For each adjacent pair where `next_int - prev_int > 1`, emit one row per missing integer with `or_number` as the missing value (zero padded to match the source width), `prev_or` and `next_or` as the bounding existing numbers.
- If there are no completed orders with a numeric OR in the range, return no rows.

Use a CTE with `lag()` and `generate_series` to materialize the gap values. If OR numbers contain a non numeric prefix, ignore those rows for the gap calculation but do not error.

#### RPC `get_payment_mix(p_start date, p_end date, p_channel text default null)`
Returns `table(payment_label text, order_count bigint, total_amount numeric)`.
- Source: completed orders in range.
- `payment_label`: Cash, GCash, Card, Online (Online = anything else or null).
- Sorted by the fixed order Cash, GCash, Card, Online.
- If a label has zero orders, do not return that row.

### 2. `client/src/lib/dataCenter.ts`
TypeScript helpers and types. Single file, named exports.

Exports:

```ts
export interface DailySummaryRow {
  business_date: string;
  channel: string;
  status: OrderRow["status"];
  order_count: number;
  gross_sales: number;
  subtotal_total: number;
  promo_discount: number;
  senior_pwd_discount: number;
  net_sales: number;
  vatable_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  cash_total: number;
  gcash_total: number;
  card_total: number;
  online_total: number;
  first_or: string | null;
  last_or: string | null;
}

export interface ProductSalesRow {
  business_date: string;
  channel: string;
  item_id: string;
  item_name: string;
  qty_sold: number;
  revenue: number;
  order_count: number;
}

export interface TableSalesRow {
  business_date: string;
  channel: string;
  table_label: string;
  order_count: number;
  item_count: number;
  revenue: number;
  cash_total: number;
  gcash_total: number;
  card_total: number;
  online_total: number;
  first_or: string | null;
  last_or: string | null;
}

export interface OrGapRow {
  or_number: string;
  prev_or: string;
  next_or: string;
}

export interface PaymentMixRow {
  payment_label: "Cash" | "GCash" | "Card" | "Online";
  order_count: number;
  total_amount: number;
}

export type ChannelFilter = "counter" | "web" | "both";

export async function fetchDailySummary(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
  status: "completed" | "cancelled" | "all";
}): Promise<DailySummaryRow[]>;

export async function fetchProductSales(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<ProductSalesRow[]>;

export async function fetchTableSales(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<TableSalesRow[]>;

export async function fetchOrGaps(params: {
  start: string;
  end: string;
}): Promise<OrGapRow[]>;

export async function fetchPaymentMix(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<PaymentMixRow[]>;
```

Implementation:
- All functions call `supabase.rpc(...)` with the right argument names (`p_start`, `p_end`, `p_channel`, `p_status`).
- For `channel === "both"`, pass `p_channel: null`.
- For `status === "all"`, pass `p_status: null`.
- On error, log to `console.error("[dataCenter] <fn>:", error)` and return an empty array.
- All numeric columns from Supabase come back as strings or numbers; coerce with `Number(value ?? 0)` before returning.

## Files to modify

### `client/src/pages/admin/DailyReport.tsx`
Goal: keep the existing UI and behavior, but stop fetching raw orders for the summary, products, and tables tabs. Only the Orders tab still fetches detail rows.

Required changes:

1. At the top of the component, add new state for the aggregate rows:
   ```ts
   const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
   const [productRowsRpc, setProductRowsRpc] = useState<ProductSalesRow[]>([]);
   const [tableRowsRpc, setTableRowsRpc] = useState<TableSalesRow[]>([]);
   const [orGaps, setOrGaps] = useState<OrGapRow[]>([]);
   const [paymentMixRpc, setPaymentMixRpc] = useState<PaymentMixRow[]>([]);
   ```

2. Replace the body of `loadReport` so it:
   - Computes `start = normalized.startYmd`, `end = normalized.endYmd` (date strings in `YYYY-MM-DD`).
   - Calls in parallel (`Promise.all`):
     - `fetchDailySummary({ start, end, channel, status: statusFilter })`
     - `fetchProductSales({ start, end, channel })`
     - `fetchTableSales({ start, end, channel })`
     - `fetchOrGaps({ start, end })`
     - `fetchPaymentMix({ start, end, channel })`
   - If `reportView === "orders"`, also runs the existing orders + items fetch (the current query) and stores it in `ordersWithItems`. Skip the orders fetch when `reportView !== "orders"`.
   - Sets all five new state arrays.
   - Sets `generatedAt = new Date()` and clears loading.

3. Replace the existing `useMemo` aggregators with derived values from the new RPC arrays. Specifically:
   - `grossSales`, `promoDiscount`, `seniorPwdDiscount`, `netSales`, `vatableSales`, `vatAmount`, `vatExemptSales`: sum the matching column from `summaryRows`.
   - `paymentBreakdown`: map from `paymentMixRpc` to the existing shape.
   - `productRows`, `topItems`: derived from `productRowsRpc`, summing across days when more than one day is in the range.
   - `tableRows`: derived from `tableRowsRpc`, same summation logic across days.
   - `orRange`: derived from `summaryRows`. `first` is the min `first_or` not null. `last` is the max `last_or` not null. `count` is the sum of `order_count` across rows where `status = 'completed'` and `first_or is not null`.
   - `completedOrders.length`: derived from `summaryRows` where `status === 'completed'` summed `order_count`.
   - `cancelledCount`: derived from `summaryRows` where `status === 'cancelled'` summed `order_count`.
   - `filteredOrders` and `filteredOrderItems`: only used by the Orders tab. Keep the existing logic but only run it when `reportView === "orders"`.

4. The existing client side filters `productFilter`, `tableFilter`, `paymentFilter`, `searchTerm`:
   - `productFilter` and `tableFilter` continue to filter the rendered rows in the Products and Tables tabs (filter the RPC arrays, do not re-aggregate).
   - `paymentFilter` only affects the Orders tab.
   - `searchTerm` only affects the Orders tab.

5. Add a new small panel under the existing summary header, visible only when `orGaps.length > 0` and `reportView === "summary"`:
   ```
   OR Gaps (orGaps.length)
   List up to 10 entries: "1042 (between 1041 and 1043)"
   If more than 10, append "and N more"
   ```
   Style: same `bg-[#faf8f6]` card pattern as existing sections. Use the brand palette. Use a small warning-ish accent: text color `#ac312d` for the count, body text `#0d0f13`.

6. Keep all existing CSV export logic working. Update so:
   - Summary CSV continues to read from the same derived values.
   - Products CSV reads from `productRowsRpc` (after filter).
   - Tables CSV reads from `tableRowsRpc` (after filter).
   - Orders CSV continues to use `filteredOrders` (only available when the Orders tab is loaded).

7. Remove the now unused `useMemo` blocks that operated on `ordersWithItems` for summary, products, and tables tabs. Keep only the ones used by the Orders tab.

8. Keep `loadReport` triggered by the same `useEffect` dependency: `[loadReport]`. The function itself depends on `channel`, `endDate`, `startDate`, `statusFilter`, `reportView`. Add the new deps to the `useCallback` dep list.

### `client/src/lib/supabase.ts`
No changes. Reuse existing client. No new types here (types live in `client/src/lib/dataCenter.ts`).

## Files to delete
None.

## Constraints
- Inherits from `AGENTS.md`.
- All currency rendering stays in `php()` helper from DailyReport. Do not introduce a new currency formatter.
- Do not add npm dependencies.
- Do not change the `OrderRow` interface.
- Do not change any UI component besides the OR Gaps panel.
- Do not touch routes or `App.tsx`.
- All SQL must be idempotent: `create or replace view`, `create or replace function`, `drop policy if exists` style.

## Reference patterns
- SQL RPC pattern: `supabase/migrations/20260619_013_table_ticket_print_status.sql` (security definer, search_path, grant authenticated).
- Existing date helpers: `formatYmdInManila`, `normalizeDateRange`, `manilaRangeBoundaries` in `DailyReport.tsx`. Use `normalizeDateRange` then pass the `YYYY-MM-DD` strings to RPCs directly. The RPCs do their own Manila bucketing via `business_date`.
- Supabase RPC call style: see other places that call `supabase.rpc(...)` for argument naming.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `supabase/migrations/20260623_020_data_center_views.sql` exists and contains all five views and RPCs listed above.
- [ ] `client/src/lib/dataCenter.ts` exists and exports the five functions and five row types.
- [ ] `DailyReport.tsx` no longer references `order_items` in any code path other than the Orders tab.
- [ ] When the Orders tab is not selected, the page does not fetch `orders` at all (only RPCs).
- [ ] OR Gaps card renders only when `orGaps.length > 0` and the Summary tab is selected.
- [ ] CSV exports for summary, products, and tables still work and reflect the current filter state.

## Out of scope
- New tabs, new pages, new components beyond what is listed.
- Charts, sparklines, KPI tiles. That is Run 2.
- Cash drawer reconciliation. That is Run 3.
- Realtime auto refresh.
- PDF export.
- Anything in `Counter.tsx`, `TableOrder.tsx`, `Tables.tsx`.

## Notes for Codex
- The migration file name uses sequence `020`, dated `20260623` to sort after the latest existing migration `20260623_019_admin_only_products.sql`. Use this exact filename. Do not renumber existing migrations.
- The RPCs intentionally accept date strings (`p_start date`) not timestamps. Supabase casts `YYYY-MM-DD` to date automatically.
- Aggregating across multiple days in the frontend: when summing product or table rows across days, group by `item_id` (for products) or `table_label` (for tables) and sum the numeric columns. Use a `Map` for grouping, then `Array.from(map.values())`.
- The OR gaps RPC: do not assume OR numbers are zero padded with a fixed width. Pad missing values using the width of `prev_or` if both bounds have the same width, otherwise emit the raw integer as text.
- Do not edit any other admin pages.
- Do not run `pnpm build`. `npx tsc --noEmit` is enough.
