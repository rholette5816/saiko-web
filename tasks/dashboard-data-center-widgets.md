# Task: dashboard-data-center-widgets

## Goal
Upgrade `client/src/pages/admin/Dashboard.tsx` to show the same high-value widgets already built for Data Center (KPI tiles with trend sparklines, payment mix, top items, OR gap panel) plus a new Hourly Sales chart, without duplicating any of Data Center's logic. Also surface the new Hourly Sales chart on Data Center's Today tab, where it is currently a "Coming in next update" placeholder.

## Why
Dashboard currently shows flat KPI numbers with no trend context and no payment/product/compliance visibility. Data Center already solved this with `KpiTile`, `PaymentMixDonut`, `TopItemsList`, and `OrGapPanel`, all backed by SQL RPCs in `supabase/migrations/20260623_020_data_center_views.sql`. Reuse those exact components and RPCs instead of rebuilding anything. The only genuinely new piece is hourly sales, which doesn't exist anywhere yet.

## Files to modify

- `client/src/pages/admin/DataCenter.tsx`
  - Extract the local helper functions `summarizeRows`, `deltaPct`, `avgTicket`, `buildTrend`, `trendAverage`, and the `SummaryTotals` interface into the new shared file `client/src/lib/salesMetrics.ts` (see "Files to create"). Replace local definitions with imports from that file. Behavior must not change.
  - Add `fetchHourlySales` to the `loadData` `Promise.all` (new state `hourlyRows`, set alongside the other rows).
  - In `renderTodayTab()`, replace the placeholder block:
    ```tsx
    <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Hourly Sales</h2>
      <p className="mt-3 text-sm text-[#705d48]">Coming in next update.</p>
    </div>
    ```
    with `<HourlySalesChart rows={hourlyRows} />` (new component, see below).

- `client/src/lib/dataCenter.ts`
  - Add `HourlySalesRow` interface: `{ hour_of_day: number; order_count: number; net_sales: number }`.
  - Add `fetchHourlySales(params: { start: string; end: string; channel: ChannelFilter })` calling `supabase.rpc("get_hourly_sales", { p_start: params.start, p_end: params.end, p_channel: channelParam(params.channel) })`, following the exact same try/catch-via-console.error pattern as `fetchPaymentMix` directly above it (return `[]` on error, map rows with a `mapHourlySalesRow` helper consistent with the other `map*Row` helpers in this file).

- `client/src/pages/admin/Dashboard.tsx`
  - Keep all existing functionality (range picker, Revenue Per Day bar chart, Orders By Status pie chart, Recent Orders list, AI Report generator). Do not remove or restructure these.
  - Add a YMD-range derivation: for the existing `rangeKey` ("today" | "yesterday" | "last7" | "thisMonth"), use `rangeForPreset` from `@/lib/manilaDate` to get `{ start, end }` in YMD form. For `rangeKey === "custom"`, use `customStart`/`customEnd` directly (already YMD strings from the `<input type="date">` fields).
  - Using that YMD range, fetch (in a new `useEffect`/`useCallback`, parallel to the existing `fetchOrders` effect, via `Promise.all` and the `safeRows` pattern copied from `DataCenter.tsx`):
    - `fetchDailySummary` for the current range, for the immediately preceding period of equal length (for the delta comparison — mirror `DataCenter.tsx`'s `priorStart`/`priorEnd`/`days` calculation exactly), and for a 14-day window ending at the range's end date (for sparklines — mirror `sparkStart`/`buildTrend` usage exactly).
    - `fetchPaymentMix`, `fetchProductSales`, `fetchOrGaps`, `fetchHourlySales` for the current range.
  - Render, directly under the existing 4 flat KPI `<div>` cards (replace those 4 cards entirely):
    - 4x `KpiTile` (Net Sales, Orders, Average Ticket, Cancellations) using the extracted `salesMetrics.ts` helpers exactly as `DataCenter.tsx`'s `renderTodayTab` does (trend array, `deltaPct` vs prior period, variant/hint logic — copy that logic, don't reinvent it).
  - Below the existing Revenue Per Day / Orders By Status grid, add a new grid row: `<PaymentMixDonut rows={paymentRows} />` and `<TopItemsList rows={productRows} limit={10} />` side by side (same layout as `DataCenter.tsx`'s `renderTodayTab`).
  - Below that, add `<OrGapPanel gaps={orGaps} />`.
  - Below that, add `<HourlySalesChart rows={hourlyRows} />`.
  - Keep the existing "Recent Orders" list and AI Report section where they are, after the new widgets.

## Files to create

- `client/src/lib/salesMetrics.ts`
  - Exports: `SummaryTotals` interface, `summarizeRows(rows: DailySummaryRow[]): SummaryTotals`, `deltaPct(current: number, prior: number): number | null`, `avgTicket(totals: SummaryTotals): number`, `buildTrend(rows: DailySummaryRow[], start: string, pick: (totals: SummaryTotals) => number): number[]`, `trendAverage(values: number[]): number`.
  - Body: move the existing implementations verbatim from `DataCenter.tsx` (lines ~110-146 and ~195-198 as of this writing — grep for the function names to find current locations, the file has changed since). Import `DailySummaryRow` from `@/lib/dataCenter` and `shiftYmdManila` from `@/lib/manilaDate`.

- `client/src/components/dataCenter/HourlySalesChart.tsx`
  - Props: `{ rows: HourlySalesRow[] }` (import `HourlySalesRow` from `@/lib/dataCenter`).
  - Renders a `recharts` `BarChart` with 24 bars (hour 0-23 on the X axis, formatted as "12am", "1am", ... "11pm"), `net_sales` as bar height, in the same card style as `PaymentMixDonut.tsx` / `TopItemsList.tsx` (check those two files for the exact wrapper div classes, heading style, and `ResponsiveContainer` pattern — match them exactly). If `rows` is empty, show "No sales data for this range yet." instead of an empty chart. Use `#ac312d` for the bar fill (matches `Dashboard.tsx`'s existing Revenue Per Day bar color).

## Files to create (migration)

- `supabase/migrations/20260624_021_hourly_sales.sql`
  - One new RPC function, following the exact style of `get_payment_mix` in `supabase/migrations/20260623_020_data_center_views.sql` (inline `with` CTE, `security definer`, `set search_path = public`, `revoke all ... from public` + `grant execute ... to authenticated` immediately after):
    ```sql
    create or replace function get_hourly_sales(
      p_start date,
      p_end date,
      p_channel text default null
    )
    returns table(hour_of_day int, order_count bigint, net_sales numeric)
    language sql
    security definer
    set search_path = public
    as $fn$
      with completed_orders as (
        select
          extract(hour from (o.created_at at time zone 'Asia/Manila'))::int as hour_of_day,
          o.total_amount
        from orders o
        where o.status = 'completed'
          and (o.created_at at time zone 'Asia/Manila')::date between p_start and p_end
          and (p_channel is null or coalesce(o.channel, 'counter') = p_channel)
      )
      select
        hours.hour_of_day,
        coalesce(count(completed_orders.hour_of_day), 0)::bigint as order_count,
        coalesce(sum(completed_orders.total_amount), 0)::numeric as net_sales
      from generate_series(0, 23) as hours(hour_of_day)
      left join completed_orders on completed_orders.hour_of_day = hours.hour_of_day
      group by hours.hour_of_day
      order by hours.hour_of_day;
    $fn$;

    revoke all on function get_hourly_sales(date, date, text) from public;
    grant execute on function get_hourly_sales(date, date, text) to authenticated;
    ```
  - Use that exact SQL (it's already correct — generate_series ensures all 24 hours appear even with zero orders, which the chart needs for a stable X axis).

## Constraints
- Inherits from `AGENTS.md` (no em dashes, brand colors, no new npm deps — `recharts` is already a dependency, reuse it).
- Do not modify `KpiTile.tsx`, `PaymentMixDonut.tsx`, `TopItemsList.tsx`, or `OrGapPanel.tsx` — reuse them as-is with existing props.
- Do not touch the Reconcile, Audit, or Export tabs in `DataCenter.tsx`.
- Do not change `Dashboard.tsx`'s existing range picker UI, AI report generation, or the `fetchOrders`/`orders` state used for the existing Revenue/Status charts and Recent Orders list — only add new fetches/state alongside them.

## Reference patterns
- Component to mimic: `client/src/components/dataCenter/PaymentMixDonut.tsx` and `TopItemsList.tsx` for `HourlySalesChart.tsx`'s card wrapper/heading style.
- Data shape to match: `client/src/lib/dataCenter.ts` (existing `fetch*` functions and `map*Row` helpers) for `fetchHourlySales`.
- Logic to copy, not reinvent: `client/src/pages/admin/DataCenter.tsx`'s `renderTodayTab()` and the `loadData` callback's prior-period/sparkline date math.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] Dashboard shows 4 KPI tiles with sparkline trends and "vs yesterday"-style delta percentages (matching Data Center's Today tab visual style), not the old flat number cards
- [ ] Dashboard shows Payment Mix donut, Top Items list, OR Gap panel, and Hourly Sales chart, all reflecting the currently selected date range (today/yesterday/last7/thisMonth/custom)
- [ ] Switching Dashboard's date range updates all new widgets, not just the existing Revenue/Status charts
- [ ] Data Center's Today tab now shows the same Hourly Sales chart instead of the "Coming in next update" placeholder
- [ ] `DataCenter.tsx` still works identically after the helper-function extraction (no behavior change, just relocated code)
- [ ] No console errors in browser dev mode on both `/admin/dashboard` and `/admin/data-center`

## Out of scope
- Food cost/margin tracking, table turnover duration, cancellation-reason aggregation (separate future work, do not start any of it).
- Any change to the Reconcile/Audit/Export tabs or BIR pack.
- Any change to `Counter.tsx` or `TableOrder.tsx`.

## Notes for Codex
- `DailySummaryRow`, `ProductSalesRow`, `OrGapRow`, `PaymentMixRow`, `ChannelFilter` types already exist in `client/src/lib/dataCenter.ts` — reuse them, do not redefine.
- Dashboard's existing `range` (a `DateRange` with `startIso`/`endIso`) stays as-is for the existing `fetchOrders`/charts. The new YMD-based fetches are a parallel, independent data path — don't try to unify them, that's a bigger refactor than this task calls for.
- The migration is additive only (new function, no table/column changes) — safe to apply standalone.
