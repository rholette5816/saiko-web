import { AdminLayout } from "@/components/AdminLayout";
import { DataCenterShell } from "@/components/dataCenter/DataCenterShell";
import { KpiTile } from "@/components/dataCenter/KpiTile";
import { OrGapPanel } from "@/components/dataCenter/OrGapPanel";
import { PaymentMixDonut } from "@/components/dataCenter/PaymentMixDonut";
import { TopItemsList } from "@/components/dataCenter/TopItemsList";
import { useBusinessSettings } from "@/lib/businessSettings";
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
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState(new Date());

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
    setGeneratedAt(new Date());
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  function renderTodayTab() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <KpiTile
            label="Net Sales"
            value={php(totals.netSales)}
            hint={`Last week ${php(sameWeekTotals.netSales)}`}
            deltaPct={netDelta}
            deltaLabel="vs yesterday"
            trend={trends.net}
          />
          <KpiTile
            label="Orders"
            value={integer(totals.orderCount)}
            hint={`Last week ${integer(sameWeekTotals.orderCount)}`}
            deltaPct={ordersDelta}
            deltaLabel="vs yesterday"
            trend={trends.orders}
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
            value={integer(totals.cancellations)}
            hint={`Last week ${integer(sameWeekTotals.cancellations)}`}
            deltaPct={cancellationsDelta}
            deltaLabel="vs yesterday"
            trend={trends.cancellations}
            variant={(cancellationsDelta ?? 0) > 0 || totals.cancellations > 0 ? "warning" : "default"}
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

  function renderExportTab() {
    const views: Array<{ key: ExportView; label: string }> = [
      { key: "summary", label: "Summary" },
      { key: "products", label: "Products" },
      { key: "tables", label: "Tables" },
      { key: "orders", label: "Orders" },
    ];

    return (
      <div className="rounded-lg border border-[#ebe9e6] bg-white p-5">
        <h2 className="text-lg font-bold text-[#0d0f13]">Export</h2>
        <p className="mt-2 text-sm text-[#705d48]">Download the current scope with the same Daily Report CSV columns.</p>
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
    );
  }

  function renderActiveTab() {
    if (filters.tab === "trends") {
      return placeholderCard("Trends", [
        "Multi day chart and comparison views land in the next update.",
        "For now, use the Today tab and switch the date range to see the change.",
      ]);
    }

    if (filters.tab === "reconcile") {
      return placeholderCard("Reconciliation", ["Drawer close, GCash actual, and card terminal variance land in Run 3."]);
    }

    if (filters.tab === "audit") {
      return (
        <div className="space-y-4">
          <OrGapPanel gaps={orGaps} />
          {placeholderCard("Audit", ["Discrepancy checks (missing OR, VAT mismatches, holders missing) land in Run 3."])}
        </div>
      );
    }

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
    </AdminLayout>
  );
}
