# Task: data-center-run-3-reconcile-audit-pdf

## Goal
Finish the Data Center: ship a real Reconciliation tab (cash drawer close, GCash and card variance, manager approval), a real Audit tab (discrepancies + OR gaps), and a real Export tab (CSV plus printable PDF style Z-reading + BIR pack). Add anomaly badges and comparison context to the Today tab.

## Why
Runs 1 and 2 made the reports fast and the UI livable. Run 3 closes the reconciliation loop, which is the actual operational pain. Variances stop living in the cashier's head, OR gaps and BIR mismatches get caught before audit, and the PDF view replaces the brittle `window.print` flow with a layout that prints clean on both A4 and 80mm thermal.

## Prerequisites
Runs 1 and 2 must be merged. `client/src/pages/admin/DataCenter.tsx`, `client/src/lib/dataCenter.ts`, `client/src/lib/dataCenterUrl.ts`, and the supporting components must exist.

## Files to create

### 1. `supabase/migrations/20260623_021_cash_drawer_closings.sql`
SQL migration. Sequence `021` follows Run 1's `020`. Date prefix `20260623` keeps file ordering consistent. Do not pick a different number even if the directory contains other migrations dated later.

#### Table `cash_drawer_closings`
Columns:
- `id uuid primary key default gen_random_uuid()`
- `business_date date not null`
- `channel text not null default 'counter'` (counter or web; future use)
- `cashier_label text` (`activeCashier` string; we are not joining to a users table yet)
- `opening_float numeric not null default 0`
- `expected_cash numeric not null default 0`
- `counted_cash numeric not null default 0`
- `cash_variance numeric generated always as (counted_cash - expected_cash) stored`
- `expected_gcash numeric not null default 0`
- `actual_gcash numeric not null default 0`
- `gcash_variance numeric generated always as (actual_gcash - expected_gcash) stored`
- `expected_card numeric not null default 0`
- `actual_card numeric not null default 0`
- `card_variance numeric generated always as (actual_card - expected_card) stored`
- `payouts_total numeric not null default 0`
- `notes text`
- `status text not null default 'draft'` (`draft`, `submitted`, `approved`)
- `submitted_at timestamptz`
- `submitted_by uuid` (`auth.uid()` at submit)
- `approved_at timestamptz`
- `approved_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique constraint on `(business_date, channel)` so there is one closing per day per channel. Use `on conflict (business_date, channel) do update` patterns in the RPC, not in the table.

RLS:
- Enable RLS.
- Policy `auth read closings`: `for select to authenticated using (true)`.
- Policy `auth write closings`: `for insert to authenticated with check (true)`.
- Policy `auth update closings`: `for update to authenticated using (true) with check (true)`.

Trigger to update `updated_at` on update.

#### Table `cash_drawer_payouts`
Per line payout breakdown.

Columns:
- `id uuid primary key default gen_random_uuid()`
- `closing_id uuid not null references cash_drawer_closings(id) on delete cascade`
- `label text not null`
- `amount numeric not null default 0`
- `created_at timestamptz not null default now()`

RLS: enable. Read + insert + update + delete for authenticated.

#### RPC `start_shift_close(p_business_date date, p_channel text default 'counter')`
Returns the row from `cash_drawer_closings` for that date + channel.
- If no row exists: insert one with status `draft`, prefill `expected_cash`, `expected_gcash`, `expected_card` from `daily_sales_summary_v1` for that date + channel (sum of `*_total` for status = 'completed'). Set `opening_float = 0`. Return the inserted row.
- If a row exists: do not touch any field, just return it.

#### RPC `submit_shift_close(p_id uuid, p_opening_float numeric, p_counted_cash numeric, p_actual_gcash numeric, p_actual_card numeric, p_payouts_total numeric, p_notes text)`
- Update fields, set `status = 'submitted'`, `submitted_at = now()`, `submitted_by = auth.uid()`.
- Reject with raise if current `status = 'approved'`.
- Returns the updated row.

#### RPC `approve_shift_close(p_id uuid)`
- Set `status = 'approved'`, `approved_at = now()`, `approved_by = auth.uid()`.
- Reject with raise if current `status != 'submitted'`.
- Returns the updated row.

#### RPC `add_payout(p_closing_id uuid, p_label text, p_amount numeric)`
- Insert a row into `cash_drawer_payouts`.
- Update `cash_drawer_closings.payouts_total` via select sum of payouts.

#### RPC `remove_payout(p_payout_id uuid)`
- Delete the payout row.
- Recalculate `payouts_total` on the parent closing.

#### RPC `list_recent_closings(p_limit int default 14)`
- Returns recent rows from `cash_drawer_closings` ordered by `business_date desc`.

#### View `discrepancy_findings_v1`
One row per finding.

Columns:
- `business_date date`
- `order_id uuid`
- `order_number text`
- `or_number text`
- `total_amount numeric`
- `finding_type text` (one of: `missing_or`, `vat_total_mismatch`, `senior_pwd_missing_holder`, `billed_not_settled`)
- `details text` (human readable)

Logic:
- `missing_or`: completed orders with `or_number is null`.
- `vat_total_mismatch`: completed orders where `abs(coalesce(vatable_sales, 0) + coalesce(vat_exempt_sales, 0) + coalesce(senior_pwd_discount, 0) - coalesce(total_amount, 0)) > 1`. The 1 peso tolerance accounts for rounding.
- `senior_pwd_missing_holder`: completed orders where `senior_pwd_discount > 0` and (`senior_pwd_name is null` or `senior_pwd_id is null`).
- `billed_not_settled`: orders with `status in ('preparing', 'ready')` and `created_at < now() - interval '24 hours'` and `kitchen_ticket_printed_at is not null`.

#### RPC `get_discrepancies(p_start date, p_end date, p_type text default null)`
Returns rows from `discrepancy_findings_v1` filtered to range and optional type. Order by `business_date desc, finding_type, order_number`.

All RPCs: `security definer`, `set search_path = public`, `revoke all from public`, `grant execute to authenticated`.

### 2. `client/src/lib/cashDrawer.ts`
TypeScript types and RPC wrappers.

Exports:
```ts
export type ClosingStatus = "draft" | "submitted" | "approved";

export interface CashClosingRow {
  id: string;
  business_date: string;
  channel: string;
  cashier_label: string | null;
  opening_float: number;
  expected_cash: number;
  counted_cash: number;
  cash_variance: number;
  expected_gcash: number;
  actual_gcash: number;
  gcash_variance: number;
  expected_card: number;
  actual_card: number;
  card_variance: number;
  payouts_total: number;
  notes: string | null;
  status: ClosingStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface PayoutRow {
  id: string;
  closing_id: string;
  label: string;
  amount: number;
  created_at: string;
}

export async function startShiftClose(businessDate: string, channel?: string): Promise<CashClosingRow | null>;
export async function submitShiftClose(input: {
  id: string;
  opening_float: number;
  counted_cash: number;
  actual_gcash: number;
  actual_card: number;
  payouts_total: number;
  notes: string;
}): Promise<CashClosingRow | null>;
export async function approveShiftClose(id: string): Promise<CashClosingRow | null>;
export async function addPayout(closingId: string, label: string, amount: number): Promise<PayoutRow | null>;
export async function removePayout(payoutId: string): Promise<boolean>;
export async function listRecentClosings(limit?: number): Promise<CashClosingRow[]>;
export async function listPayouts(closingId: string): Promise<PayoutRow[]>;
```

### 3. `client/src/lib/discrepancies.ts`
TypeScript types and RPC wrappers.

Exports:
```ts
export type FindingType = "missing_or" | "vat_total_mismatch" | "senior_pwd_missing_holder" | "billed_not_settled";

export interface DiscrepancyRow {
  business_date: string;
  order_id: string;
  order_number: string;
  or_number: string | null;
  total_amount: number;
  finding_type: FindingType;
  details: string;
}

export async function fetchDiscrepancies(params: {
  start: string;
  end: string;
  type?: FindingType;
}): Promise<DiscrepancyRow[]>;

export const findingLabels: Record<FindingType, string>;
export const findingDescriptions: Record<FindingType, string>;
```

`findingLabels`:
- `missing_or`: "Missing OR"
- `vat_total_mismatch`: "VAT Total Mismatch"
- `senior_pwd_missing_holder`: "Senior/PWD Holder Missing"
- `billed_not_settled`: "Billed Out Not Settled"

`findingDescriptions`: short one liners for the UI hover text.

### 4. `client/src/components/dataCenter/ReconcileForm.tsx`
The drawer close form.

Props:
```ts
interface ReconcileFormProps {
  closing: CashClosingRow;
  payouts: PayoutRow[];
  busy: boolean;
  onChange: (field: ReconcileEditableField, value: number | string) => void;
  onSubmit: () => void;
  onApprove: () => void;
  onAddPayout: (label: string, amount: number) => void;
  onRemovePayout: (id: string) => void;
}
```

Layout:
- Header card showing `business_date`, channel, status pill (`draft` = gold, `submitted` = orange, `approved` = black).
- Three side by side cards on `md` and up, stacked on mobile: Cash, GCash, Card. Each card shows:
  - Expected (from the closing row, read only).
  - Actual (input).
  - Variance (computed live, red if non zero, bold).
- Below: Opening Float input, Payouts list, Add Payout inline form (label + amount + Add button).
- Notes textarea.
- Submit button (primary `bg-[#ac312d]`). Disabled when status is `approved`.
- Approve button visible only when status is `submitted`. Outline black.

Field rules:
- All amount inputs use `inputMode="decimal"`, `step="0.01"`, `min="0"`.
- Live variance turns red below zero, green at zero, gold above zero.
- Submit disabled if `counted_cash`, `actual_gcash`, `actual_card` are all zero (likely not closed yet).
- Approve and Submit both disabled while `busy`.

Responsive:
- Mobile: cards stack, sticky bottom action bar with Submit + Approve.
- Desktop: cards in a row, action buttons in the header card.

### 5. `client/src/components/dataCenter/ReconcileHistory.tsx`
List of recent closings.

Props:
```ts
interface ReconcileHistoryProps {
  rows: CashClosingRow[];
  onSelect?: (row: CashClosingRow) => void;
}
```

Visual:
- Table on `md` and up: date, status, cash variance, gcash variance, card variance, total variance.
- Cards on mobile: same data, one per card.
- Rows with any non zero variance get a left border accent in `#e88627`. Any over 100 peso variance gets `#ac312d`.
- Tap or click to call `onSelect`.

### 6. `client/src/components/dataCenter/DiscrepancyList.tsx`
Renders the discrepancy table grouped by finding type.

Props:
```ts
interface DiscrepancyListProps {
  rows: DiscrepancyRow[];
}
```

Visual:
- Filter chip row at the top: All, plus one chip per finding type. Counts in parentheses.
- Below: group cards. Each group has a header (label + count), then rows.
- Each row: order number link to `/admin/orders/<order_id>`, OR number, total amount, details.
- Empty state: `No discrepancies found in this range. Nice.`

### 7. `client/src/components/dataCenter/ZReadingPrint.tsx`
Printable Z-reading layout. Pure presentational.

Props:
```ts
interface ZReadingPrintProps {
  scope: string;
  rangeLabel: string;
  generatedAt: Date;
  business: { name: string; tin: string | null; address: string | null };
  summary: DailySummaryRow[];          // current range
  paymentMix: PaymentMixRow[];
  productRows: ProductSalesRow[];
  tableRows: TableSalesRow[];
  closing?: CashClosingRow | null;
  payouts?: PayoutRow[];
  thermalMode: boolean;
}
```

Layout:
- A4 mode: standard report layout, similar to the existing Daily Report Z-reading section but cleaner.
- Thermal mode: 80mm width, narrow columns, larger numbers (same scale as the `RoundTicket`).
- Sections:
  1. Header (business name, TIN, address, scope, generated at)
  2. OR range
  3. Sales totals
  4. VAT breakdown (if vat_registered)
  5. Payment mix
  6. Top 10 items
  7. Cash drawer reconciliation (if closing provided)
  8. Signatures footer

CSS: scoped via inline `<style>` like the existing `RoundTicket.tsx`. `@page` rule for thermal (`80mm auto`) and A4.

### 8. `client/src/lib/zReadingPrint.ts`
Helper that wraps `window.print()` with a controlled flow.

Exports:
```ts
export function triggerPrint(): void;        // window.print + restore
```

(Optional. Codex can inline the print call if this helper becomes a single liner; in that case do not create the file.)

### 9. `client/src/components/dataCenter/BirPackButton.tsx`
Button that zips and downloads the BIR pack. Uses only browser APIs (no JSZip). For now, produces a single text file bundle with each report separated by a header line.

Props:
```ts
interface BirPackButtonProps {
  summary: DailySummaryRow[];
  productRows: ProductSalesRow[];
  tableRows: TableSalesRow[];
  closing?: CashClosingRow | null;
  payouts?: PayoutRow[];
  scopeLabel: string;
  rangeLabel: string;
  filenameBase: string;
}
```

Behavior:
- Generate one combined CSV with sections (each preceded by a header row): Summary, Payment Mix, Products, Tables, Cash Drawer Closing, Payouts.
- Trigger download as `<filenameBase>-bir-pack.csv`.

## Files to modify

### `client/src/pages/admin/DataCenter.tsx`
Wire the three placeholder tabs into real implementations:

1. **Reconciliation tab**:
   - On tab mount or when `filters.start` changes, call `startShiftClose(filters.start, "counter")`.
   - Load payouts via `listPayouts(closing.id)`.
   - Render `ReconcileForm` with handlers wired to `submitShiftClose`, `approveShiftClose`, `addPayout`, `removePayout`.
   - Below the form, render `ReconcileHistory` from `listRecentClosings(14)`.
   - On submit success, show a small confirmation toast like message (use a simple `<div>` in scope, no toast library).
   - Reload the closing row after every action.

2. **Audit tab**:
   - Fetch discrepancies via `fetchDiscrepancies({ start: filters.start, end: filters.end })`.
   - Render `OrGapPanel` at top, then `DiscrepancyList` below.

3. **Export tab**:
   - Add a new section above the existing CSV buttons:
     - "Print Z-Reading" primary button. On click: render `ZReadingPrint` in a hidden container, then `window.print()`.
     - Thermal mode toggle checkbox (mobile friendly), same as the current DailyReport thermal toggle.
   - Render `BirPackButton` below.

4. **Today tab anomaly badges**:
   - For each KPI tile, compute simple thresholds:
     - Net Sales: warning if today is below 70% of 7 day average.
     - Cancellations: warning if 5%+ of completed.
     - Average Ticket: no warning.
     - Orders: warning if today is below 50% of 7 day average.
   - When a threshold trips, set `KpiTile` `variant="warning"` and append a hint line like "Below average".

5. **Comparison context**:
   - Already fetched in Run 2. Make sure both "vs yesterday" and "vs same day last week" badges show. If neither is available, show no badge.

### `client/src/lib/dataCenterExport.ts`
Add a new branch: when the export view is "orders", continue to support the current orders CSV. Otherwise nothing changes.

### `client/src/components/AdminLayout.tsx`
Remove the old `/admin/reports/daily` nav entry. The Data Center is the canonical page now.

The old route stays in `App.tsx` for one cycle (so direct links still resolve), but it stops being surfaced in the nav.

## Files to delete
None yet. The old `DailyReport.tsx` and `/admin/reports/daily` route stay for one more cycle. We delete in a follow up after Ken confirms no team member is using the old URL.

## Constraints
- Inherits from `AGENTS.md`.
- No new npm dependencies. PDF is implemented via `window.print()` over a print-styled component.
- All RPCs `security definer`, `revoke from public`, `grant execute to authenticated`.
- Currency rendering uses the same `php()` helper. Variance amounts: positive renders as `+PHP 12.00`, negative as `-PHP 12.00`, zero as `PHP 0.00`.
- All forms wired through real `<form>` elements with `onSubmit` and `type="button"` for non submit buttons.
- All toggles, buttons, inputs respect 44px minimum touch target.

## Reference patterns
- RPC pattern: `supabase/migrations/20260619_013_table_ticket_print_status.sql` and the Run 1 migration.
- Print CSS pattern: `client/src/components/RoundTicket.tsx` and `client/src/components/TableBill.tsx`.
- Form pattern with disabled states: `client/src/pages/admin/Settings.tsx`.
- Tabbed UI with URL state: built in Run 2.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] Migration applies cleanly on a fresh Supabase project that has Runs 1 and 2 applied.
- [ ] Opening the Reconciliation tab for today creates a draft closing row with expected values matching `daily_sales_summary_v1` for today.
- [ ] Submitting a closing sets status to `submitted` and stores variances correctly.
- [ ] Approving requires status `submitted` and sets status to `approved`.
- [ ] Audit tab shows OR gaps and at least one discrepancy when test data is seeded.
- [ ] Export tab Print Z-Reading triggers a browser print preview that contains the same totals as the Today tab.
- [ ] BIR Pack download produces a single CSV containing six labelled sections.
- [ ] On viewport width 360px, the Reconcile form stacks vertically, the sticky bottom action bar shows Submit and Approve, and all inputs are reachable without horizontal scroll.
- [ ] On viewport width 1280px, Reconcile shows three side by side cards (Cash, GCash, Card).
- [ ] Today tab KPI tiles show warning variants when the configured thresholds trip on test data.

## Out of scope
- Multi day chart on the Trends tab. That stays placeholder.
- Real PDF generation via a library. We use `window.print()` over a print styled component.
- Realtime auto refresh.
- Per cashier sales filtering (we use the active cashier label, not a join).
- Inventory reconciliation.
- Email scheduling.

## Notes for Codex
- The migration introduces generated columns and RLS. Test the migration SQL syntactically before writing the file. If a Supabase Postgres version is older than 12 the generated columns will fail; do not work around this with triggers, surface the error.
- For the BIR pack, use the same `exportRowsToCsv` helper. Concatenate sections by writing multiple header rows separated by a blank row. Use a single download trigger.
- For the print flow on the Export tab, render `ZReadingPrint` inside a `<div style={{ display: "none" }}>` and rely on the `@media print` CSS inside the component to show it. The shell already has print-hide patterns; keep them consistent.
- Do not change the existing `RoundTicket` or `TableBill` print logic.
- Do not run `pnpm build`. `npx tsc --noEmit` is enough.
- Stop and report if any RPC requires a column that does not exist in `orders`. Do not add columns to `orders` without Claude approving.
