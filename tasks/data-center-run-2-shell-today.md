# Task: data-center-run-2-shell-today

## Goal
Replace the single Daily Report screen with a true Data Center shell: tabbed layout, mobile first responsive, URL backed filters, and a polished "Today" tab built on the Run 1 RPCs. The other tabs (Trends, Reconciliation, Audit, Export) ship as placeholders that say "Available in next update" so navigation works end to end.

## Why
The current page is a 1075 line monolith. It is desktop only, hides important numbers below dense controls, and gives no comparison context. Owners check sales on their phone. We need a phone first layout, big KPI tiles with comparison badges, and a clear tab structure to grow into.

## Prerequisites
Run 1 (`tasks/data-center-run-1-views-rpcs.md`) must be merged. `client/src/lib/dataCenter.ts` and the `get_daily_summary`, `get_product_sales`, `get_table_sales`, `get_or_gaps`, `get_payment_mix` RPCs must exist and work.

## Files to create

### 1. `client/src/lib/manilaDate.ts`
Pure helpers, no React. Single file.

Exports:
```ts
export function todayYmdManila(): string;            // YYYY-MM-DD in Asia/Manila
export function shiftYmdManila(ymd: string, days: number): string;
export function rangeLabel(start: string, end: string): string;  // "Today", "Yesterday", "Jun 14 to Jun 20" etc
export function rangeForPreset(preset: PresetRange): { start: string; end: string };
export type PresetRange = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth";
```

Behavior:
- Use `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })` for all date math so we stay in Manila day regardless of browser timezone.
- `rangeLabel` produces compact labels: same start and end day in current year shows "Jun 20", different days shows "Jun 14 to Jun 20", different years shows "Jun 14 2026 to Jan 2 2027".

### 2. `client/src/lib/dataCenterUrl.ts`
URL search params helper for filter persistence. Single file.

Exports:
```ts
export interface DataCenterFilters {
  start: string;            // YYYY-MM-DD
  end: string;
  channel: "counter" | "web" | "both";
  status: "completed" | "cancelled" | "all";
  tab: "today" | "trends" | "reconcile" | "audit" | "export";
}

export function defaultFilters(): DataCenterFilters;
export function filtersFromSearch(search: string): DataCenterFilters;
export function filtersToSearch(filters: DataCenterFilters): string;
```

Behavior:
- `defaultFilters`: today range in Manila, channel `counter`, status `completed`, tab `today`.
- Parsing: validate each field, fall back to default if invalid.
- Output: stable key order `tab,start,end,channel,status`. Empty string if filters equal defaults.

### 3. `client/src/components/dataCenter/DataCenterShell.tsx`
Layout shell. Named export `DataCenterShell`. Renders all tab content via children.

Props:
```ts
interface DataCenterShellProps {
  filters: DataCenterFilters;
  onChangeFilters: (next: DataCenterFilters) => void;
  loading: boolean;
  scopeLabel: string;          // human label for the active filter set
  children: ReactNode;          // tab content
  onPrint?: () => void;
  onExportCsv?: () => void;
  onRefresh?: () => void;
}
```

Layout:

Mobile (default, under `md`):
- Sticky top bar:
  - Left: page title "Data Center" in `font-poppins font-bold uppercase tracking-wide text-base text-[#0d0f13]`.
  - Right: filter button (lucide `SlidersHorizontal` icon, 44px tap target). Tapping it opens a bottom sheet.
- Sticky scope chip row directly below: shows the active range, channel, and status as small chips. Tap a chip to open the bottom sheet.
- Tab navigation: bottom fixed tab bar with 5 icons + labels. Active tab gets `text-[#ac312d]` and a 2px top accent. Inactive gets `text-[#705d48]`. Min height 56px. Use icons: `Activity` (today), `TrendingUp` (trends), `Wallet` (reconcile), `ShieldAlert` (audit), `Download` (export).
- Bottom action bar appears just above the tab bar when `onPrint` or `onExportCsv` is provided. Two buttons: Print (outline) and Export (primary). Hidden if neither prop is set.

Tablet (`md` to `lg`):
- Top bar: title + scope chips inline + refresh button.
- Tabs as a horizontal row right under the top bar with the same active styling.
- Bottom action bar disappears. Print and Export move to the top bar on the right.

Desktop (`lg` and up):
- Two column layout:
  - Left rail (260px): persistent filter card. Date range presets (Today, Yesterday, Last 7, Last 30, This Month, Last Month) as chips. Custom date range with two date inputs and an Apply button. Channel and Status as chip rows.
  - Right: tab row at top, content below.
- Print + Export + Refresh as buttons at the top right.

Responsive breakpoint utilities:
- Use Tailwind `md:` and `lg:`.
- All touch targets minimum `min-h-11` (44px).
- Use `safe-area-inset-bottom` aware padding on the mobile tab bar via `pb-[env(safe-area-inset-bottom)]`.

Filter bottom sheet (mobile + tablet):
- Slide up from bottom. Overlay backdrop `bg-black/60`.
- Contents in order: preset chip row, custom start/end inputs, channel chips, status chips, "Apply" primary button, "Reset" outline button.
- Close on backdrop tap, on Apply, or on Cancel.
- Trap focus inside while open.

Loading state:
- When `loading` is true, the top bar shows a thin progress bar (`h-0.5 bg-[#ac312d]/30` with animated `bg-[#ac312d]` slider).

Brand palette only. No new colors.

### 4. `client/src/components/dataCenter/KpiTile.tsx`
Reusable KPI tile. Named export `KpiTile`.

Props:
```ts
interface KpiTileProps {
  label: string;             // "Net Sales"
  value: string;             // already formatted: "PHP 12,540" or "24"
  hint?: string;             // small caption under value, optional
  deltaPct?: number | null;  // +12 means up 12%, -8 means down 8%, null hides
  deltaLabel?: string;       // "vs yesterday"
  trend?: number[];          // 7 to 14 numbers for sparkline
  variant?: "default" | "warning" | "danger";
  onClick?: () => void;
}
```

Visual:
- White card with `rounded-lg border border-[#ebe9e6]`.
- Label: `text-xs uppercase tracking-wide text-[#705d48]`.
- Value: `text-2xl font-bold text-[#0d0f13]`. On `md` screens up: `text-3xl`.
- Hint: `text-xs text-[#705d48]`.
- Delta badge: rounded pill, top right of card.
  - Positive: `bg-[#ebe9e6] text-[#0d0f13]` with up arrow icon.
  - Negative: `bg-[#ac312d]/10 text-[#ac312d]` with down arrow icon.
  - Zero or null: hidden.
- Sparkline: 60x24 inline SVG. Polyline only, no axes. Stroke `#c08643`, 1.5px. Fill below the line `#c08643` at opacity 0.12.
- `variant = "warning"`: left border `border-l-4 border-l-[#e88627]`.
- `variant = "danger"`: left border `border-l-4 border-l-[#ac312d]`.
- `onClick` if provided: whole card becomes a button, `hover:bg-[#faf8f6] cursor-pointer`.

### 5. `client/src/components/dataCenter/Sparkline.tsx`
Tiny SVG sparkline. Named export `Sparkline`. No charting library.

Props:
```ts
interface SparklineProps {
  values: number[];
  width?: number;     // default 60
  height?: number;    // default 24
  stroke?: string;    // default #c08643
  fill?: string;      // default #c08643
  fillOpacity?: number; // default 0.12
  className?: string;
}
```

Implementation:
- Pure function component that returns an SVG.
- Normalize values to fit. If all values are the same, draw a flat line at vertical center.
- No animation. No tooltips.

### 6. `client/src/components/dataCenter/PaymentMixDonut.tsx`
SVG donut for payment mix. Named export `PaymentMixDonut`. No charting library.

Props:
```ts
interface PaymentMixDonutProps {
  rows: PaymentMixRow[];   // from dataCenter.ts
  size?: number;           // default 160
}
```

Visual:
- SVG donut, 4 segments max. Colors in order: Cash `#0d0f13`, GCash `#c08643`, Bank Transfer BPI `#e88627`, Online `#705d48`.
- Center text: total order count.
- Legend below: payment label, count, formatted PHP amount.
- If rows is empty, render a muted message "No completed orders." with the donut hidden.

Important: the `PaymentMixRow.payment_label` union now uses `"Bank Transfer BPI"` (not the legacy `"Card"`). Source of truth is `client/src/lib/paymentMethods.ts` (`PaymentLabel`, `PAYMENT_LABEL_ORDER`). Always derive the segment order from `PAYMENT_LABEL_ORDER` so future label changes flow through without touching this component.

### 7. `client/src/components/dataCenter/TopItemsList.tsx`
Compact list for top items. Named export `TopItemsList`.

Props:
```ts
interface TopItemsListProps {
  rows: ProductSalesRow[];     // raw RPC rows, possibly multi-day
  limit?: number;              // default 10
}
```

Behavior:
- Group rows by `item_id` summing `qty_sold` and `revenue`. Sort by revenue desc.
- Render top `limit` rows as `flex justify-between` rows: left is item name and qty, right is PHP revenue.
- Empty state: muted "No sold items in this scope."

### 8. `client/src/components/dataCenter/OrGapPanel.tsx`
Already designed in Run 1 but lifted into a component now.

Props:
```ts
interface OrGapPanelProps {
  gaps: OrGapRow[];
  max?: number;   // default 10
}
```

Visual:
- White card. `border-l-4 border-l-[#ac312d]`.
- Title: `OR Gaps (count)`.
- List up to `max` rows: `1042 missing between 1041 and 1043`.
- If `gaps.length > max`, append `and N more`.
- If `gaps.length === 0`, render nothing (return null).

### 9. `client/src/pages/admin/DataCenter.tsx`
The new page. Named default export `AdminDataCenter`.

Responsibilities:
- Read filters from URL on mount via `filtersFromSearch(window.location.search)`.
- Push filter changes back to URL via `wouter`'s `useLocation` setter so back button works.
- Fetch from RPCs whenever filters change.
- Compute the comparison range for "Today" tab:
  - "vs yesterday" = same range shifted back by `(end - start + 1)` days.
  - "vs same day last week" = same range shifted back by 7 days.
- Render `DataCenterShell` with the active tab content.

Tab content:

#### Today tab
Layout (single column on mobile, 2 column on desktop):

Row 1: KPI grid.
- Mobile: 2 columns of tiles.
- Tablet: 3 columns.
- Desktop: 4 columns.
Tiles:
1. Net Sales, PHP, delta vs yesterday, sparkline of last 14 days.
2. Orders, count, delta vs yesterday, sparkline.
3. Average Ticket = net sales / order count, PHP, delta vs yesterday.
4. Cancellations, count, delta vs yesterday, variant `warning` if positive delta or count > 0.

Row 2: side by side on `lg` and up, stacked below:
- Left: `PaymentMixDonut`.
- Right: `TopItemsList` with limit 10.

Row 3: `OrGapPanel` (full width).

Row 4: Hourly sales mini grid (placeholder). For now render a card titled "Hourly Sales" with a single line "Coming in next update."

For comparison fetches:
- Run 3 parallel fetches: current range summary, yesterday range summary, same range 7 days ago summary.
- Compute deltas as `(currentNet - priorNet) / priorNet * 100`, rounded to one decimal. If prior is 0 and current > 0, delta is `null` (do not show).

Sparkline source:
- For each tile, fetch 14 days of `daily_sales_summary` ending at the end date, channel + status filtered. Use one call: `fetchDailySummary({ start: shiftYmdManila(end, -13), end, channel, status })`. Build an array of 14 numbers per metric. If a date is missing, fill with 0.

#### Trends tab
Placeholder. Card with text:
```
Trends
Multi day chart and comparison views land in the next update.
For now, use the Today tab and switch the date range to see the change.
```

#### Reconciliation tab
Placeholder. Card with text:
```
Reconciliation
Drawer close, GCash actual, and card terminal variance land in Run 3.
```

#### Audit tab
Placeholder card listing the OR gaps via `OrGapPanel` (real, reuses the same data) plus a note:
```
Discrepancy checks (missing OR, VAT mismatches, holders missing) land in Run 3.
```

#### Export tab
Card with the same CSV export buttons that exist today: Summary, Products, Tables, Orders. Wire to a helper `exportCurrentView(view, filters)` that calls the existing `exportRowsToCsv` and produces files identical to the current DailyReport export.

### 10. `client/src/lib/dataCenterExport.ts`
Helper for CSV export, lifted from the old DailyReport so the Export tab is self contained.

Exports:
```ts
export type ExportView = "summary" | "products" | "tables" | "orders";
export function exportCurrentView(args: {
  view: ExportView;
  filters: DataCenterFilters;
  summary: DailySummaryRow[];
  products: ProductSalesRow[];
  tables: TableSalesRow[];
  orders?: OrderRow[];           // optional, only present if we fetched
  businessName: string;
  generatedAt: Date;
  scopeLabel: string;
  cashierName: string;
}): void;
```

Use the same CSV column structure as the current DailyReport. Filenames follow the same `saiko-daily-<range>-<channel>-<view>.csv` pattern.

## Files to modify

### `client/src/App.tsx`
Add the new route. Keep the old route working for one release so a stale tab in someone's browser still loads.

Insert after the existing daily report route:
```tsx
<Route path={"/admin/data-center"}>
  <AdminGuard adminOnly>
    <AdminDataCenter />
  </AdminGuard>
</Route>
```
Import: `import AdminDataCenter from "./pages/admin/DataCenter";`

The existing `/admin/reports/daily` route continues to render `AdminDailyReport`. Do not remove it.

### `client/src/components/AdminLayout.tsx`
Update the nav items list. Add a new entry for Data Center and demote the old Daily Report so both show during the transition:

```ts
{ href: "/admin/data-center", label: "Data Center", icon: BarChart3, active: (path: string) => path.startsWith("/admin/data-center") },
{ href: "/admin/reports/daily", label: "Daily Report", icon: FileText, active: (path: string) => path.startsWith("/admin/reports/daily") },
```

Import `BarChart3` from `lucide-react`. Place Data Center directly above Daily Report in the nav. Both items are admin only (already filtered by the existing staff label whitelist).

## Files to delete
None. The old DailyReport stays for one cycle.

## Constraints
- Inherits from `AGENTS.md`.
- No new npm dependencies. No charts library. Sparkline and donut are hand drawn SVG.
- Use only the brand palette. Do not introduce other reds, oranges, or accents.
- All copy is direct, owner voice. No em or en dashes.
- All tap targets minimum 44px.
- All numeric formatting goes through helpers, not raw `toLocaleString` calls scattered across components.
- The page must work without crashing on a fresh load with `?` query string and with garbage values in the query string.

## Reference patterns
- Existing AdminLayout sticky header and nav: `client/src/components/AdminLayout.tsx`.
- Existing brand palette use: `client/src/pages/admin/Tables.tsx`.
- URL state via wouter: `useLocation()` returns `[path, setPath]`. Use it together with `window.location.search` for the search portion.
- Brand color pattern: `bg-[#0d0f13] text-white`, `bg-[#c08643] text-[#0d0f13]`.
- Form pattern: see `client/src/pages/admin/Login.tsx`.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `/admin/data-center` renders without errors on a fresh Supabase project (assuming Run 1 has been applied).
- [ ] Navigating to `/admin/data-center?tab=audit` lands on the Audit tab on first paint.
- [ ] Changing the date range on the Today tab updates the URL search params.
- [ ] On viewport width 360px, the page shows one column of KPI tiles, the filter bottom sheet opens from the bottom, and the tab bar is fixed at the bottom of the viewport.
- [ ] On viewport width 1280px, the left filter rail is visible, KPI tiles are 4 across, and the donut + top items list sit side by side.
- [ ] Each KPI tile shows a delta badge or no badge (never a broken NaN).
- [ ] Sparkline renders with 14 data points and never crashes on all zero values.
- [ ] CSV export from the Export tab produces files identical in column layout to the current Daily Report exports.
- [ ] The old Daily Report at `/admin/reports/daily` continues to work unchanged.

## Out of scope
- Cash drawer reconciliation (Run 3).
- Discrepancy detection beyond OR gaps (Run 3).
- PDF export and BIR pack (Run 3).
- Realtime auto refresh.
- Anomaly threshold badges (Run 4).
- Saved Views.
- Email scheduling.
- Hourly sales heatmap (placeholder card only).
- Deleting or rewriting `DailyReport.tsx` itself.

## Notes for Codex
- Component file organization: put all new components under `client/src/components/dataCenter/` to keep the namespace tidy. Use named exports.
- The donut and sparkline must be inline SVG, no canvas, no external lib. Keep them under 100 lines each.
- Comparison fetches: use `Promise.all` with three parallel `fetchDailySummary` calls. Treat any single failure as `[]` and proceed with `deltaPct = null`.
- For the sparkline 14 day source, group `summaryRows` by `business_date`, summing `net_sales`. Fill missing days with 0 to maintain continuous x axis.
- Bottom sheet: implement with a fixed positioned div and a tailwind transition. No headless UI dependency.
- All clickable elements should be real `<button>` elements with `type="button"` to avoid accidental form submissions.
- Do not run `pnpm build`. `npx tsc --noEmit` is enough.
- If you discover a need to touch any file outside this spec to get types to compile, stop and report instead of editing it.
