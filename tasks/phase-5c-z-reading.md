# Task: phase-5c-z-reading

## Goal
Add an end-of-day Z-reading report at `/admin/reports/daily` that aggregates all completed orders for a chosen date and produces a printable, BIR-style daily summary suitable for handing to an accountant or reconciling the cash drawer.

## Why
Phases 5A and 5B let staff take counter orders. They now need a daily total at end of shift: gross sales, VAT collected, VAT-exempt sales, Senior/PWD discounts, refunds (none for V1), and a payment-method breakdown so the cashier can reconcile cash on hand against the system. This is the operational end of the day, separate from the marketing AI report.

## Critical compatibility notes
- Read-only feature. No new tables, no schema changes, no migration.
- Reads from `orders`, `order_items`, and `business_settings`.
- Phases 5A + 5B must be applied first (this report relies on `channel`, `or_number`, `vat_amount`, `vatable_sales`, `vat_exempt_sales`, `senior_pwd_discount`, `payment_method`, `amount_received`).
- Compatible with web orders too: web orders are EXCLUDED from Z-reading by default (toggleable). Z-reading is for in-store transactions per BIR convention.
- Print layout uses the same 80mm thermal CSS pattern as the receipt, with an A4 fallback for office printers.

## Files to modify

### 1. `client/src/components/AdminLayout.tsx`
Add **Daily Report** to the admin sidebar nav, between **Counter** and **Settings** (or wherever it fits visually). Use `FileText` or `ClipboardList` icon from lucide-react. Active state when location starts with `/admin/reports/daily`.

### 2. `client/src/App.tsx`
Register the protected route:

```tsx
<Route path={"/admin/reports/daily"}>
  <AdminGuard>
    <AdminDailyReport />
  </AdminGuard>
</Route>
```

Add the import: `import AdminDailyReport from "./pages/admin/DailyReport";`

## Files to create

### 3. `client/src/pages/admin/DailyReport.tsx`
Wrapped in `AdminLayout`.

**Top controls:**
- Date picker (`<input type="date">`), default to today (Asia/Manila)
- Channel filter chip group: **Counter only (default) · Both · Web only**
- "Generate Report" button (or auto-generate on date change)
- "Print" button (calls `window.print()`)
- "Export CSV" button (uses the existing `exportOrdersToCsv` from `lib/csvExport.ts`)

**Report body** (rendered after data loads, inside a `daily-report-print` container):

- Header
  - Business name + TIN + address (from `useBusinessSettings()`)
  - "Z-READING" or "PROVISIONAL Z-READING" depending on `is_bir_accredited`
  - Date selected
  - Generated at (timestamp in Asia/Manila)
  - Cashier (current admin email or a placeholder)

- OR range (counter only)
  - First OR number used today
  - Last OR number used today
  - Count of OR numbers issued

- Sales totals
  - Gross sales (sum of `total_amount` for all completed orders in scope)
  - Discounts given:
    - Promo discounts (sum of `discount_amount` where `promo_code is not null`)
    - Senior/PWD discounts (sum of `senior_pwd_discount`)
  - Net sales (gross sales after all discounts)

- VAT breakdown (only if business is VAT registered)
  - VAT-able sales (sum of `vatable_sales`)
  - VAT (12%, sum of `vat_amount`)
  - VAT-exempt sales (sum of `vat_exempt_sales`)

- Payment method breakdown
  - Cash: count + sum
  - GCash: count + sum
  - Card: count + sum
  - (Web orders may have null `payment_method`; group those under "Online")

- Order count
  - Total completed orders
  - Cancelled orders count (not part of revenue, just for visibility)

- Item summary (top 10 items)
  - Same data shape as Phase 4B prompt but rendered inline
  - Item name, qty sold, gross revenue

- Footer
  - "Cashier signature: ___________"
  - "Manager signature: ___________"
  - Disclaimer (if not BIR-accredited): "This is a provisional Z-reading for internal use. Not an official BIR Z-reading until Saiko is BIR-accredited."

**State:**
```ts
const [date, setDate] = useState(() => formatYmdInManila(new Date()));
const [channel, setChannel] = useState<"counter" | "both" | "web">("counter");
const [orders, setOrders] = useState<OrderRow[]>([]);
const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const { settings } = useBusinessSettings();
```

**Fetch:**
```ts
async function loadReport() {
  setLoading(true);
  setError(null);
  const { startIso, endIso } = manilaDayBoundaries(date);
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("status", "completed")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (channel === "counter") query = query.eq("channel", "counter");
  if (channel === "web") query = query.eq("channel", "web");

  const { data, error: fetchError } = await query;
  if (fetchError) {
    setError(fetchError.message);
    setLoading(false);
    return;
  }
  // Flatten items off each order for aggregations.
  setOrders((data ?? []) as OrderRow[]);
  setOrderItems((data ?? []).flatMap((o: any) => (o.order_items ?? []).map((it: any) => ({ ...it, order_id: o.id }))));
  setLoading(false);
}
```

**Helpers (inline or imported from `lib/dateRanges.ts`):**
```ts
function formatYmdInManila(d: Date): string {
  // returns "YYYY-MM-DD" formatted in Asia/Manila
}
function manilaDayBoundaries(ymd: string): { startIso: string; endIso: string } {
  // returns start of `ymd` and start of next day, both as UTC ISO strings
}
```

If `lib/dateRanges.ts` already exposes equivalents (it does, via `getCustomRange`), reuse them. Otherwise add the inline helpers above.

**Computation:**
Use `Number()` on every numeric field. Compute:
- `grossSales = sum(total_amount)`
- `promoDiscount = sum(discount_amount)` where `promo_code` is set
- `seniorPwdDiscount = sum(senior_pwd_discount)`
- `vatableSales = sum(vatable_sales)`
- `vatAmount = sum(vat_amount)`
- `vatExemptSales = sum(vat_exempt_sales)`
- Group by `payment_method` for the breakdown (null methods count as "Online")
- Top 10 items via the same pattern as `lib/analytics.ts:computeItemPerformance` if reusable, else inline

**Print CSS:**
Add a `<style>` block (or inject):
```css
@media print {
  @page { size: A4; margin: 1.5cm; }
  body { background: white !important; }
  .print-hide { display: none !important; }
  .admin-print-scope > *:not(.daily-report-print) { display: none !important; }
  .daily-report-print { box-shadow: none !important; padding: 0 !important; }
}
```

For thermal printer mode, add a small toggle "Thermal (80mm)" that switches the print CSS to `@page { size: 80mm auto; margin: 0; }` and shrinks fonts. Default is A4.

### 4. (Optional) Reuse `lib/analytics.ts` if its helpers fit
If `computeItemPerformance` from `lib/analytics.ts` already exists from Phase 3 and accepts `(orderItems, orderStatusById)`, reuse it. Otherwise inline the aggregation in `DailyReport.tsx`. Do NOT modify `lib/analytics.ts` to fit this page — if it doesn't fit, just inline.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- **No new npm dependencies.**
- **No schema changes.** Read-only feature.
- Brand colors only.
- Do NOT modify any in-flight uncommitted file.
- Do NOT modify any existing migration, RPC, or Edge Function.
- Numeric values cast with `Number()`.

## Reference patterns
- Date range helpers: `client/src/lib/dateRanges.ts`
- Print pattern: `client/src/components/CounterReceipt.tsx` (Phase 5A/5B pattern with `@media print` and `body > *:not(...)` hiding)
- Analytics-style aggregation: `client/src/lib/analytics.ts`
- CSV export: `client/src/lib/csvExport.ts`
- Settings hook: `client/src/lib/businessSettings.tsx` (Phase 5B)
- AdminLayout sidebar: existing nav items in `client/src/components/AdminLayout.tsx`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `client/src/pages/admin/DailyReport.tsx` exists
- [ ] `App.tsx` registers `/admin/reports/daily` route protected by `AdminGuard`
- [ ] `grep -n "Daily Report" client/src/components/AdminLayout.tsx` returns at least one match (the new nav)
- [ ] `grep -n "Z-READING" client/src/pages/admin/DailyReport.tsx` returns at least one match
- [ ] `grep -n "exportOrdersToCsv" client/src/pages/admin/DailyReport.tsx` returns at least one match
- [ ] `grep -n "@media print" client/src/pages/admin/DailyReport.tsx` returns at least one match
- [ ] No new migration files in `supabase/migrations/`
- [ ] No changes to `lib/analytics.ts`, `lib/csvExport.ts`, or any existing Edge Function

## Out of scope
- X-reading (mid-shift cumulative)
- Cash drawer counter (admin enters actual cash counted, system computes variance)
- Email or scheduled delivery of the daily report
- Multi-day or weekly summaries (Phase 4B AI report covers ranges)
- Per-cashier breakdown (single admin account in Phase 5)
- Hash-chained tamper-proof Z numbers
- Offline / cached reporting

## Notes for Codex
- The default channel filter is "Counter only" because Z-reading is a counter-pos concept. Web orders are excluded by default but can be included via the toggle.
- The report header text changes based on `is_bir_accredited`:
  - true: "Z-READING"
  - false: "PROVISIONAL Z-READING"
- VAT breakdown section: hide entirely when `settings.vat_registered === false`.
- Senior/PWD discount section: only show line if `seniorPwdDiscount > 0` for the day.
- Promo discount section: only show line if `promoDiscount > 0` for the day.
- Order count includes a separate "Cancelled" line if any cancelled orders exist for the day, fetched independently with `eq("status", "cancelled")`.
- For the OR range (first / last OR number issued today): query orders where `or_number is not null`, sort by `created_at`, take the first and last `or_number`. If none, show "No counter orders today."
- Date input default: when the page loads, default to today in Asia/Manila. Browser `<input type="date">` default value is set in `useEffect` after mount because Manila date can differ from local browser date.
- Verify with `git diff --name-only` before completing — diff should only include files explicitly named in this spec.
