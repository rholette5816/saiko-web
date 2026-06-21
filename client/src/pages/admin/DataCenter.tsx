import { AdminLayout } from "@/components/AdminLayout";
import { BirPackButton } from "@/components/dataCenter/BirPackButton";
import { DataCenterShell } from "@/components/dataCenter/DataCenterShell";
import { DiscrepancyList } from "@/components/dataCenter/DiscrepancyList";
import { KpiTile } from "@/components/dataCenter/KpiTile";
import { OrGapPanel } from "@/components/dataCenter/OrGapPanel";
import { PaymentMixDonut } from "@/components/dataCenter/PaymentMixDonut";
import { ReconcileForm, type ReconcileEditableField } from "@/components/dataCenter/ReconcileForm";
import { ReconcileHistory } from "@/components/dataCenter/ReconcileHistory";
import { TopItemsList } from "@/components/dataCenter/TopItemsList";
import { ZReadingPrint } from "@/components/dataCenter/ZReadingPrint";
import { useBusinessSettings } from "@/lib/businessSettings";
import {
  addPayout,
  approveShiftClose,
  listPayouts,
  listRecentClosings,
  removePayout,
  startShiftClose,
  submitShiftClose,
  type CashClosingRow,
  type PayoutRow,
} from "@/lib/cashDrawer";
import { useActiveCashier } from "@/lib/cashier";
import {
  fetchDailySummary,
  fetchOrGaps,
  fetchPaymentMix,
  fetchProductSales,
  fetchTableSales,
  type DailySummaryRow,
  type OrGapRow,
  type PaymentMixRow,
  type ProductSalesRow,
  type TableSalesRow,
} from "@/lib/dataCenter";
import { exportCurrentView, type ExportView } from "@/lib/dataCenterExport";
import { defaultFilters, filtersFromSearch, filtersToSearch, type DataCenterFilters } from "@/lib/dataCenterUrl";
import { getCustomRange } from "@/lib/dateRanges";
import { fetchDiscrepancies, type DiscrepancyRow } from "@/lib/discrepancies";
import { rangeLabel, shiftYmdManila } from "@/lib/manilaDate";
import { type OrderItemRow, type OrderRow, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type OrderWithItems = OrderRow & { order_items?: OrderItemRow[] };

interface SummaryTotals {
  orderCount: number;
  netSales: number;
  cancellations: number;
}

const channelLabels: Record<DataCenterFilters["channel"], string> = {
  counter: "Counter",
  web: "Web",
  both: "Both",
};

const statusLabels: Record<DataCenterFilters["status"], string> = {
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All status",
};

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function integer(value: number): string {
  return integerFormatter.format(Number(value || 0));
}

function isYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeFilters(filters: DataCenterFilters): DataCenterFilters {
  const defaults = defaultFilters();
  let start = isYmd(filters.start) ? filters.start : defaults.start;
  let end = isYmd(filters.end) ? filters.end : defaults.end;
  if (start > end) [start, end] = [end, start];
  return { ...filters, start, end };
}

function sameFilters(a: DataCenterFilters, b: DataCenterFilters): boolean {
  return a.tab === b.tab && a.start === b.start && a.end === b.end && a.channel === b.channel && a.status === b.status;
}

function ymdUtc(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function rangeDays(start: string, end: string): number {
  return Math.max(1, Math.round((ymdUtc(end) - ymdUtc(start)) / 86400000) + 1);
}

function summarizeRows(rows: DailySummaryRow[]): SummaryTotals {
  return rows.reduce(
    (totals, row) => ({
      orderCount: totals.orderCount + Number(row.order_count || 0),
      netSales: totals.netSales + Number(row.net_sales || 0),
      cancellations: totals.cancellations + (row.status === "cancelled" ? Number(row.order_count || 0) : 0),
    }),
    { orderCount: 0, netSales: 0, cancellations: 0 },
  );
}

function deltaPct(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

function avgTicket(totals: SummaryTotals): number {
  return totals.orderCount > 0 ? totals.netSales / totals.orderCount : 0;
}

function buildTrend(
  rows: DailySummaryRow[],
  start: string,
  pick: (totals: SummaryTotals) => number,
): number[] {
  const byDate = new Map<string, DailySummaryRow[]>();
  for (const row of rows) {
    const current = byDate.get(row.business_date) ?? [];
    current.push(row);
    byDate.set(row.business_date, current);
  }

  return Array.from({ length: 14 }, (_unused, index) => {
    const date = shiftYmdManila(start, index);
    return pick(summarizeRows(byDate.get(date) ?? []));
  });
}

function placeholderCard(title: string, lines: string[]) {
  return (
    <div className="rounded-lg border border-[#ebe9e6] bg-white p-5">
      <h2 className="text-lg font-bold text-[#0d0f13]">{title}</h2>
      <p className="mt-2 text-sm font-bold uppercase tracking-wide text-[#ac312d]">Available in next update</p>
      <div className="mt-3 space-y-2 text-sm text-[#705d48]">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function manilaRangeBoundaries(startYmd: string, endYmd: string): { startIso: string; endIso: string } {
  const normalized = normalizeFilters({ ...defaultFilters(), start: startYmd, end: endYmd });
  const range = getCustomRange(normalized.start, normalized.end);
  return { startIso: range.startIso, endIso: range.endIso };
}

async function safeRows<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch (error) {
    console.error("[DataCenter] fetch failed:", error);
    return [];
  }
}

async function fetchOrdersForExport(filters: DataCenterFilters): Promise<OrderWithItems[]> {
  const { startIso, endIso } = manilaRangeBoundaries(filters.start, filters.end);
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true });

  if (filters.channel === "counter") query = query.eq("channel", "counter");
  if (filters.channel === "web") query = query.eq("channel", "web");
  if (filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderWithItems[];
}

function trendAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function netSalesVariant(today: number, trend: number[]): "default" | "warning" {
  const baseline = trendAverage(trend.slice(0, 7));
  if (baseline <= 0) return "default";
  return today < baseline * 0.7 ? "warning" : "default";
}

function ordersVariant(today: number, trend: number[]): "default" | "warning" {
  const baseline = trendAverage(trend.slice(0, 7));
  if (baseline <= 0) return "default";
  return today < baseline * 0.5 ? "warning" : "default";
}

function cancellationsVariant(cancellations: number, orderCount: number): "default" | "warning" {
  if (orderCount === 0) return cancellations > 0 ? "warning" : "default";
  return cancellations / orderCount > 0.05 ? "warning" : "default";
}

function netSalesHint(today: number, trend: number[]): string | undefined {
  const baseline = trendAverage(trend.slice(0, 7));
  if (baseline <= 0) return undefined;
  if (today < baseline * 0.7) return "Below 7 day average";
  return undefined;
}

function ordersHint(today: number, trend: number[]): string | undefined {
  const baseline = trendAverage(trend.slice(0, 7));
  if (baseline <= 0) return undefined;
  if (today < baseline * 0.5) return "Half of 7 day average";
  return undefined;
}

function cancellationsHint(cancellations: number, orderCount: number): string | undefined {
  if (orderCount === 0) return undefined;
  const rate = cancellations / orderCount;
  if (rate > 0.05) return `${Math.round(rate * 1000) / 10}% cancellation rate`;
  return undefined;
}

function buildFilenameBase(filters: DataCenterFilters): string {
  const range = filters.start === filters.end ? filters.start : `${filters.start}-to-${filters.end}`;
  return `saiko-${range}-${filters.channel}-${filters.tab}`;
}

export default function AdminDataCenter() {
  const [location, setLocation] = useLocation();
  const { activeCashier } = useActiveCashier();
  const { settings } = useBusinessSettings();
  const [filters, setFilters] = useState<DataCenterFilters>(() =>
    typeof window === "undefined" ? defaultFilters() : normalizeFilters(filtersFromSearch(window.location.search)),
  );
  const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
  const [priorSummaryRows, setPriorSummaryRows] = useState<DailySummaryRow[]>([]);
  const [sameWeekSummaryRows, setSameWeekSummaryRows] = useState<DailySummaryRow[]>([]);
  const [sparklineRows, setSparklineRows] = useState<DailySummaryRow[]>([]);
  const [productRows, setProductRows] = useState<ProductSalesRow[]>([]);
  const [tableRows, setTableRows] = useState<TableSalesRow[]>([]);
  const [orGaps, setOrGaps] = useState<OrGapRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentMixRow[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>([]);
  const [closing, setClosing] = useState<CashClosingRow | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [recentClosings, setRecentClosings] = useState<CashClosingRow[]>([]);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState(new Date());
  const [thermalMode, setThermalMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = normalizeFilters(filtersFromSearch(window.location.search));
    setFilters((current) => (sameFilters(current, fromUrl) ? current : fromUrl));
  }, [location]);

  const changeFilters = useCallback(
    (next: DataCenterFilters) => {
      const normalized = normalizeFilters(next);
      setFilters(normalized);
      setLocation(`/admin/data-center${filtersToSearch(normalized)}`);
    },
    [setLocation],
  );

  const loadData = useCallback(async () => {
    const normalized = normalizeFilters(filters);
    const days = rangeDays(normalized.start, normalized.end);
    const priorStart = shiftYmdManila(normalized.start, -days);
    const priorEnd = shiftYmdManila(normalized.end, -days);
    const weekStart = shiftYmdManila(normalized.start, -7);
    const weekEnd = shiftYmdManila(normalized.end, -7);
    const sparkStart = shiftYmdManila(normalized.end, -13);
    setLoading(true);

    const [
      nextSummary,
      nextPrior,
      nextSameWeek,
      nextSparkline,
      nextProducts,
      nextTables,
      nextGaps,
      nextPaymentRows,
      nextOrders,
      nextDiscrepancies,
    ] = await Promise.all([
      safeRows(fetchDailySummary({ start: normalized.start, end: normalized.end, channel: normalized.channel, status: normalized.status })),
      safeRows(fetchDailySummary({ start: priorStart, end: priorEnd, channel: normalized.channel, status: normalized.status })),
      safeRows(fetchDailySummary({ start: weekStart, end: weekEnd, channel: normalized.channel, status: normalized.status })),
      safeRows(fetchDailySummary({ start: sparkStart, end: normalized.end, channel: normalized.channel, status: normalized.status })),
      safeRows(fetchProductSales({ start: normalized.start, end: normalized.end, channel: normalized.channel })),
      safeRows(fetchTableSales({ start: normalized.start, end: normalized.end, channel: normalized.channel })),
      safeRows(fetchOrGaps({ start: normalized.start, end: normalized.end })),
      safeRows(fetchPaymentMix({ start: normalized.start, end: normalized.end, channel: normalized.channel })),
      normalized.tab === "export" ? safeRows(fetchOrdersForExport(normalized)) : Promise.resolve([] as OrderWithItems[]),
      normalized.tab === "audit"
        ? safeRows(fetchDiscrepancies({ start: normalized.start, end: normalized.end }))
        : Promise.resolve([] as DiscrepancyRow[]),
    ]);

    setSummaryRows(nextSummary);
    setPriorSummaryRows(nextPrior);
    setSameWeekSummaryRows(nextSameWeek);
    setSparklineRows(nextSparkline);
    setProductRows(nextProducts);
    setTableRows(nextTables);
    setOrGaps(nextGaps);
    setPaymentRows(nextPaymentRows);
    setOrders(nextOrders);
    setDiscrepancies(nextDiscrepancies);
    setGeneratedAt(new Date());
    setLoading(false);
  }, [filters]);

  const loadReconciliation = useCallback(async () => {
    if (filters.tab !== "reconcile") return;
    const date = filters.start;
    const channel = filters.channel === "web" ? "web" : "counter";
    const row = await startShiftClose(date, channel);
    setClosing(row);
    if (row) {
      const [payoutRows, history] = await Promise.all([listPayouts(row.id), listRecentClosings(14)]);
      setPayouts(payoutRows);
      setRecentClosings(history);
    } else {
      setPayouts([]);
      setRecentClosings(await listRecentClosings(14));
    }
  }, [filters.tab, filters.start, filters.channel]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadReconciliation();
  }, [loadReconciliation]);

  const scopeLabel = useMemo(
    () => `${rangeLabel(filters.start, filters.end)} / ${channelLabels[filters.channel]} / ${statusLabels[filters.status]}`,
    [filters],
  );
  const totals = useMemo(() => summarizeRows(summaryRows), [summaryRows]);
  const priorTotals = useMemo(() => summarizeRows(priorSummaryRows), [priorSummaryRows]);
  const sameWeekTotals = useMemo(() => summarizeRows(sameWeekSummaryRows), [sameWeekSummaryRows]);
  const sparkStart = useMemo(() => shiftYmdManila(filters.end, -13), [filters.end]);
  const trends = useMemo(
    () => ({
      net: buildTrend(sparklineRows, sparkStart, (row) => row.netSales),
      orders: buildTrend(sparklineRows, sparkStart, (row) => row.orderCount),
      avg: buildTrend(sparklineRows, sparkStart, avgTicket),
      cancellations: buildTrend(sparklineRows, sparkStart, (row) => row.cancellations),
    }),
    [sparkStart, sparklineRows],
  );

  const averageTicket = avgTicket(totals);
  const priorAverageTicket = avgTicket(priorTotals);
  const netDelta = deltaPct(totals.netSales, priorTotals.netSales);
  const ordersDelta = deltaPct(totals.orderCount, priorTotals.orderCount);
  const avgDelta = deltaPct(averageTicket, priorAverageTicket);
  const cancellationsDelta = deltaPct(totals.cancellations, priorTotals.cancellations);

  function handleExport(view: ExportView) {
    exportCurrentView({
      view,
      filters,
      summary: summaryRows,
      products: productRows,
      tables: tableRows,
      orders,
      businessName: settings?.business_name ?? "SAIKO RAMEN & SUSHI",
      generatedAt,
      scopeLabel,
      cashierName: activeCashier,
    });
  }

  function handleReconcileChange(field: ReconcileEditableField, value: number | string) {
    setClosing((current) => {
      if (!current) return current;
      const next = { ...current };
      if (field === "notes") {
        next.notes = typeof value === "string" ? value : String(value);
      } else if (field === "opening_float") {
        next.opening_float = Number(value);
      } else if (field === "counted_cash") {
        next.counted_cash = Number(value);
        next.cash_variance = next.counted_cash - next.expected_cash;
      } else if (field === "actual_gcash") {
        next.actual_gcash = Number(value);
        next.gcash_variance = next.actual_gcash - next.expected_gcash;
      } else if (field === "actual_card") {
        next.actual_card = Number(value);
        next.card_variance = next.actual_card - next.expected_card;
      }
      return next;
    });
  }

  async function handleReconcileSubmit() {
    if (!closing) return;
    setReconcileBusy(true);
    setReconcileMessage(null);
    const result = await submitShiftClose({
      id: closing.id,
      opening_float: closing.opening_float,
      counted_cash: closing.counted_cash,
      actual_gcash: closing.actual_gcash,
      actual_card: closing.actual_card,
      payouts_total: closing.payouts_total,
      notes: closing.notes ?? "",
    });
    if (result) {
      setClosing(result);
      setReconcileMessage("Submitted. Manager can review and approve.");
      setRecentClosings(await listRecentClosings(14));
    } else {
      setReconcileMessage("Submit failed. Check the console for details.");
    }
    setReconcileBusy(false);
  }

  async function handleReconcileApprove() {
    if (!closing) return;
    setReconcileBusy(true);
    setReconcileMessage(null);
    const result = await approveShiftClose(closing.id);
    if (result) {
      setClosing(result);
      setReconcileMessage("Closing approved.");
      setRecentClosings(await listRecentClosings(14));
    } else {
      setReconcileMessage("Approve failed. Check the console for details.");
    }
    setReconcileBusy(false);
  }

  async function handleAddPayout(label: string, amount: number) {
    if (!closing) return;
    setReconcileBusy(true);
    const row = await addPayout(closing.id, label, amount);
    if (row) {
      setPayouts((current) => [...current, row]);
      setClosing((current) =>
        current ? { ...current, payouts_total: current.payouts_total + amount } : current,
      );
    }
    setReconcileBusy(false);
  }

  async function handleRemovePayout(id: string) {
    if (!closing) return;
    const removed = payouts.find((payout) => payout.id === id);
    if (!removed) return;
    setReconcileBusy(true);
    const ok = await removePayout(id);
    if (ok) {
      setPayouts((current) => current.filter((payout) => payout.id !== id));
      setClosing((current) =>
        current ? { ...current, payouts_total: Math.max(0, current.payouts_total - removed.amount) } : current,
      );
    }
    setReconcileBusy(false);
  }

  function handlePrintZReading() {
    if (typeof window === "undefined") return;
    window.print();
  }

  function renderTodayTab() {
    const todayNet = totals.netSales;
    const todayOrders = totals.orderCount;
    const todayCancellations = totals.cancellations;
    const netVariant = netSalesVariant(todayNet, trends.net);
    const ordersVariantValue = ordersVariant(todayOrders, trends.orders);
    const cancellationsVariantValue = cancellationsVariant(todayCancellations, todayOrders);
    const netSalesHintText = netSalesHint(todayNet, trends.net);
    const ordersHintText = ordersHint(todayOrders, trends.orders);
    const cancellationsHintText = cancellationsHint(todayCancellations, todayOrders);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <KpiTile
            label="Net Sales"
            value={php(todayNet)}
            hint={netSalesHintText ?? `Last week ${php(sameWeekTotals.netSales)}`}
            deltaPct={netDelta}
            deltaLabel="vs yesterday"
            trend={trends.net}
            variant={netVariant}
          />
          <KpiTile
            label="Orders"
            value={integer(todayOrders)}
            hint={ordersHintText ?? `Last week ${integer(sameWeekTotals.orderCount)}`}
            deltaPct={ordersDelta}
            deltaLabel="vs yesterday"
            trend={trends.orders}
            variant={ordersVariantValue}
          />
          <KpiTile
            label="Average Ticket"
            value={php(averageTicket)}
            hint={totals.orderCount > 0 ? `${integer(totals.orderCount)} orders` : "No orders"}
            deltaPct={avgDelta}
            deltaLabel="vs yesterday"
            trend={trends.avg}
          />
          <KpiTile
            label="Cancellations"
            value={integer(todayCancellations)}
            hint={cancellationsHintText ?? `Last week ${integer(sameWeekTotals.cancellations)}`}
            deltaPct={cancellationsDelta}
            deltaLabel="vs yesterday"
            trend={trends.cancellations}
            variant={cancellationsVariantValue}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PaymentMixDonut rows={paymentRows} />
          <TopItemsList rows={productRows} limit={10} />
        </div>

        <OrGapPanel gaps={orGaps} />

        <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Hourly Sales</h2>
          <p className="mt-3 text-sm text-[#705d48]">Coming in next update.</p>
        </div>
      </div>
    );
  }

  function renderReconcileTab() {
    if (!closing) {
      return (
        <div className="rounded-lg border border-[#ebe9e6] bg-white p-5 text-sm text-[#705d48]">
          Loading drawer close for {filters.start}.
        </div>
      );
    }

    return (
      <div className="space-y-4 pb-32 md:pb-0">
        {reconcileMessage && (
          <div className="rounded-md border border-[#ebe9e6] bg-[#faf8f6] px-4 py-3 text-sm text-[#0d0f13]">
            {reconcileMessage}
          </div>
        )}
        <ReconcileForm
          closing={closing}
          payouts={payouts}
          busy={reconcileBusy}
          onChange={handleReconcileChange}
          onSubmit={handleReconcileSubmit}
          onApprove={handleReconcileApprove}
          onAddPayout={handleAddPayout}
          onRemovePayout={handleRemovePayout}
        />
        <ReconcileHistory rows={recentClosings} />
      </div>
    );
  }

  function renderAuditTab() {
    return (
      <div className="space-y-4">
        <OrGapPanel gaps={orGaps} />
        <DiscrepancyList rows={discrepancies} />
      </div>
    );
  }

  function renderExportTab() {
    const views: Array<{ key: ExportView; label: string }> = [
      { key: "summary", label: "Summary" },
      { key: "products", label: "Products" },
      { key: "tables", label: "Tables" },
      { key: "orders", label: "Orders" },
    ];
    const filenameBase = buildFilenameBase(filters);

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[#ebe9e6] bg-white p-5">
          <h2 className="text-lg font-bold text-[#0d0f13]">Print Z-Reading</h2>
          <p className="mt-2 text-sm text-[#705d48]">
            Use thermal mode for an 80mm receipt printer. Plain A4 prints from any office printer.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-[#0d0f13]">
              <input
                type="checkbox"
                checked={thermalMode}
                onChange={(event) => setThermalMode(event.target.checked)}
              />
              Thermal (80mm)
            </label>
            <button
              type="button"
              onClick={handlePrintZReading}
              className="min-h-11 rounded-md bg-[#ac312d] px-4 text-sm font-bold uppercase tracking-wide text-white"
            >
              Print Z-Reading
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[#ebe9e6] bg-white p-5">
          <h2 className="text-lg font-bold text-[#0d0f13]">CSV Export</h2>
          <p className="mt-2 text-sm text-[#705d48]">Same column layout as the legacy Daily Report exports.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {views.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => handleExport(view.key)}
                disabled={loading}
                className="min-h-11 rounded-md bg-[#0d0f13] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ebe9e6] bg-white p-5">
          <h2 className="text-lg font-bold text-[#0d0f13]">BIR Pack</h2>
          <p className="mt-2 text-sm text-[#705d48]">
            One file with six labelled sections: summary, payment mix, products, tables, drawer close, payouts.
          </p>
          <div className="mt-4">
            <BirPackButton
              summary={summaryRows}
              productRows={productRows}
              tableRows={tableRows}
              paymentMix={paymentRows}
              closing={closing}
              payouts={payouts}
              scopeLabel={scopeLabel}
              rangeLabel={rangeLabel(filters.start, filters.end)}
              filenameBase={filenameBase}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    if (filters.tab === "trends") {
      return placeholderCard("Trends", [
        "Multi day chart and comparison views land in the next update.",
        "For now, use the Today tab and switch the date range to see the change.",
      ]);
    }

    if (filters.tab === "reconcile") return renderReconcileTab();
    if (filters.tab === "audit") return renderAuditTab();
    if (filters.tab === "export") return renderExportTab();
    return renderTodayTab();
  }

  return (
    <AdminLayout>
      <DataCenterShell
        filters={filters}
        onChangeFilters={changeFilters}
        loading={loading}
        scopeLabel={scopeLabel}
        onPrint={() => window.print()}
        onExportCsv={() => handleExport("summary")}
        onRefresh={loadData}
      >
        {renderActiveTab()}
      </DataCenterShell>

      <div className="data-center-print" aria-hidden>
        <ZReadingPrint
          scope={scopeLabel}
          rangeLabel={rangeLabel(filters.start, filters.end)}
          generatedAt={generatedAt}
          business={{
            name: settings?.business_name ?? "SAIKO RAMEN & SUSHI",
            tin: settings?.business_tin ?? null,
            address: settings?.business_address ?? null,
          }}
          summary={summaryRows}
          paymentMix={paymentRows}
          productRows={productRows}
          tableRows={tableRows}
          closing={closing}
          payouts={payouts}
          thermalMode={thermalMode}
        />
      </div>
      <style>{`
        .data-center-print { display: none; }
        @media print {
          body > * { visibility: hidden !important; }
          .data-center-print, .data-center-print * { visibility: visible !important; }
          .data-center-print { position: absolute; left: 0; top: 0; right: 0; display: block !important; }
        }
      `}</style>
    </AdminLayout>
  );
}
