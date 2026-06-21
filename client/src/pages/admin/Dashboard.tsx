import { ReportMarkdown } from "@/components/ReportMarkdown";
import { AdminLayout } from "@/components/AdminLayout";
import { HourlySalesChart } from "@/components/dataCenter/HourlySalesChart";
import { KpiTile } from "@/components/dataCenter/KpiTile";
import { OrGapPanel } from "@/components/dataCenter/OrGapPanel";
import { PaymentMixDonut } from "@/components/dataCenter/PaymentMixDonut";
import { TopItemsList } from "@/components/dataCenter/TopItemsList";
import { countByStatus, groupRevenueByDay } from "@/lib/analytics";
import {
  fetchDailySummary,
  fetchHourlySales,
  fetchOrGaps,
  fetchPaymentMix,
  fetchProductSales,
  type DailySummaryRow,
  type HourlySalesRow,
  type OrGapRow,
  type PaymentMixRow,
  type ProductSalesRow,
} from "@/lib/dataCenter";
import { type DateRange, type DateRangeKey, getCustomRange, getRange } from "@/lib/dateRanges";
import { rangeForPreset, shiftYmdManila } from "@/lib/manilaDate";
import { avgTicket, buildTrend, deltaPct, summarizeRows, trendAverage } from "@/lib/salesMetrics";
import { supabase, type OrderRow } from "@/lib/supabase";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "wouter";

const statusColors: Record<string, string> = {
  pending: "#705d48",
  preparing: "#e88627",
  ready: "#c08643",
  completed: "#0d0f13",
  cancelled: "#ac312d",
};

const rangeOptions: Array<{ key: Exclude<DateRangeKey, "custom">; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
];

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});

function currencyPhp(value: number): string {
  return `PHP ${Math.round(value).toLocaleString("en-PH")}`;
}

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function integer(value: number): string {
  return integerFormatter.format(Number(value || 0));
}

function ymdUtc(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function rangeDays(start: string, end: string): number {
  return Math.max(1, Math.round((ymdUtc(end) - ymdUtc(start)) / 86400000) + 1);
}

async function safeRows<T>(promise: Promise<T[]>): Promise<T[]> {
  try {
    return await promise;
  } catch (error) {
    console.error("[Dashboard] fetch failed:", error);
    return [];
  }
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

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");
  const [range, setRange] = useState<DateRange>(getRange("today"));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [reportRange, setReportRange] = useState<{ from: string; to: string; label: string } | null>(null);
  const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
  const [priorSummaryRows, setPriorSummaryRows] = useState<DailySummaryRow[]>([]);
  const [sparklineRows, setSparklineRows] = useState<DailySummaryRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentMixRow[]>([]);
  const [productRows, setProductRows] = useState<ProductSalesRow[]>([]);
  const [orGaps, setOrGaps] = useState<OrGapRow[]>([]);
  const [hourlyRows, setHourlyRows] = useState<HourlySalesRow[]>([]);

  const dashboardYmdRange = useMemo(() => {
    if (rangeKey === "custom") {
      if (!customStart || !customEnd) return null;
      return { start: customStart, end: customEnd };
    }

    return rangeForPreset(rangeKey);
  }, [customEnd, customStart, rangeKey]);

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }
      if (!silent) setLoading(false);
    },
    [range.startIso, range.endIso],
  );

  const fetchDashboardMetrics = useCallback(async () => {
    if (!dashboardYmdRange) {
      setSummaryRows([]);
      setPriorSummaryRows([]);
      setSparklineRows([]);
      setPaymentRows([]);
      setProductRows([]);
      setOrGaps([]);
      setHourlyRows([]);
      return;
    }

    const days = rangeDays(dashboardYmdRange.start, dashboardYmdRange.end);
    const priorStart = shiftYmdManila(dashboardYmdRange.start, -days);
    const priorEnd = shiftYmdManila(dashboardYmdRange.end, -days);
    const sparkStart = shiftYmdManila(dashboardYmdRange.end, -13);

    const [
      nextSummary,
      nextPrior,
      nextSparkline,
      nextPaymentRows,
      nextProductRows,
      nextGaps,
      nextHourlyRows,
    ] = await Promise.all([
      safeRows(fetchDailySummary({ start: dashboardYmdRange.start, end: dashboardYmdRange.end, channel: "both", status: "all" })),
      safeRows(fetchDailySummary({ start: priorStart, end: priorEnd, channel: "both", status: "all" })),
      safeRows(fetchDailySummary({ start: sparkStart, end: dashboardYmdRange.end, channel: "both", status: "all" })),
      safeRows(fetchPaymentMix({ start: dashboardYmdRange.start, end: dashboardYmdRange.end, channel: "both" })),
      safeRows(fetchProductSales({ start: dashboardYmdRange.start, end: dashboardYmdRange.end, channel: "both" })),
      safeRows(fetchOrGaps({ start: dashboardYmdRange.start, end: dashboardYmdRange.end })),
      safeRows(fetchHourlySales({ start: dashboardYmdRange.start, end: dashboardYmdRange.end, channel: "both" })),
    ]);

    setSummaryRows(nextSummary);
    setPriorSummaryRows(nextPrior);
    setSparklineRows(nextSparkline);
    setPaymentRows(nextPaymentRows);
    setProductRows(nextProductRows);
    setOrGaps(nextGaps);
    setHourlyRows(nextHourlyRows);
  }, [dashboardYmdRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    void fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  useEffect(() => {
    const onNewOrder = () => fetchOrders(true);
    window.addEventListener("saiko:new-order", onNewOrder);
    const interval = window.setInterval(() => fetchOrders(true), 15000);
    return () => {
      window.removeEventListener("saiko:new-order", onNewOrder);
      window.clearInterval(interval);
    };
  }, [fetchOrders]);

  const revenueData = useMemo(
    () => groupRevenueByDay(orders, new Date(range.startIso), new Date(range.endIso)),
    [orders, range.startIso, range.endIso],
  );
  const statusData = useMemo(() => countByStatus(orders), [orders]);
  const totals = useMemo(() => summarizeRows(summaryRows), [summaryRows]);
  const priorTotals = useMemo(() => summarizeRows(priorSummaryRows), [priorSummaryRows]);
  const sparkStart = useMemo(
    () => (dashboardYmdRange ? shiftYmdManila(dashboardYmdRange.end, -13) : ""),
    [dashboardYmdRange],
  );
  const trends = useMemo(
    () => ({
      net: dashboardYmdRange ? buildTrend(sparklineRows, sparkStart, (row) => row.netSales) : [],
      orders: dashboardYmdRange ? buildTrend(sparklineRows, sparkStart, (row) => row.orderCount) : [],
      avg: dashboardYmdRange ? buildTrend(sparklineRows, sparkStart, avgTicket) : [],
      cancellations: dashboardYmdRange ? buildTrend(sparklineRows, sparkStart, (row) => row.cancellations) : [],
    }),
    [dashboardYmdRange, sparkStart, sparklineRows],
  );

  const averageTicket = avgTicket(totals);
  const priorAverageTicket = avgTicket(priorTotals);
  const netDelta = deltaPct(totals.netSales, priorTotals.netSales);
  const ordersDelta = deltaPct(totals.orderCount, priorTotals.orderCount);
  const avgDelta = deltaPct(averageTicket, priorAverageTicket);
  const cancellationsDelta = deltaPct(totals.cancellations, priorTotals.cancellations);
  const netVariant = netSalesVariant(totals.netSales, trends.net);
  const ordersVariantValue = ordersVariant(totals.orderCount, trends.orders);
  const cancellationsVariantValue = cancellationsVariant(totals.cancellations, totals.orderCount);
  const netSalesHintText = netSalesHint(totals.netSales, trends.net);
  const ordersHintText = ordersHint(totals.orderCount, trends.orders);
  const cancellationsHintText = cancellationsHint(totals.cancellations, totals.orderCount);

  function applyRange(next: Exclude<DateRangeKey, "custom">) {
    setRangeKey(next);
    setRange(getRange(next));
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    setRangeKey("custom");
    setRange(getCustomRange(customStart, customEnd));
  }

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportError(null);
    setReportMarkdown(null);

    const resolvedRange =
      rangeKey === "custom"
        ? range
        : getRange(rangeKey as Exclude<DateRangeKey, "custom">);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("generate-report", {
        body: { from: resolvedRange.startIso, to: resolvedRange.endIso, label: resolvedRange.label },
      });
      if (invokeError) {
        let detail = invokeError.message;
        const maybeContext = (invokeError as { context?: Response }).context;
        if (maybeContext instanceof Response) {
          try {
            const payload = await maybeContext.json();
            if (payload && typeof payload === "object" && "error" in payload) {
              const serverError = (payload as { error?: unknown }).error;
              if (typeof serverError === "string" && serverError.trim()) {
                detail = serverError;
              }
            }
          } catch {
            // Keep fallback message from invokeError when context is non-JSON.
          }
        }
        throw new Error(detail);
      }
      if (!data?.report) throw new Error("Report came back empty");
      setReportMarkdown(String(data.report));
      setReportRange({ from: resolvedRange.startIso, to: resolvedRange.endIso, label: resolvedRange.label });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setReportError(`Could not generate report: ${detail}`);
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <AdminLayout>
      <section className="space-y-5 admin-print-scope">
        <style>{`
          @media print {
            body { background: white !important; }
            .print-hide { display: none !important; }
            .admin-print-scope > *:not(.print-report) { display: none !important; }
            .print-report { box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
          }
        `}</style>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0d0f13]">Dashboard</h1>
            <p className="text-sm text-[#705d48]">{range.label}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-3 print-hide">
          <div className="flex flex-wrap items-center gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => applyRange(option.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  rangeKey === option.key ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRangeKey("custom")}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                rangeKey === "custom" ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
              }`}
            >
              Custom
            </button>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#ac312d] text-white text-sm font-semibold disabled:opacity-60"
            >
              {reportLoading ? (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {reportLoading ? "Generating report..." : "Generate AI Report"}
            </button>
          </div>

          {rangeKey === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-[#705d48]">
                Start
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="block mt-1 border border-[#d8d2cb] rounded-md px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-[#705d48]">
                End
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="block mt-1 border border-[#d8d2cb] rounded-md px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={applyCustomRange}
                className="px-3 py-2 rounded-md bg-[#c08643] text-[#0d0f13] text-sm font-semibold"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {reportError && (
          <div className="bg-white rounded-lg p-3 text-sm text-[#ac312d] print-hide">{reportError}</div>
        )}

        {loading && <div className="bg-white rounded-lg p-5 text-sm text-[#705d48]">Loading dashboard...</div>}
        {error && <div className="bg-white rounded-lg p-5 text-sm text-[#ac312d]">Failed to load: {error}</div>}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-white rounded-lg p-5 text-sm text-[#705d48]">No orders in this range yet.</div>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <KpiTile
                label="Net Sales"
                value={php(totals.netSales)}
                hint={netSalesHintText ?? `Prior period ${php(priorTotals.netSales)}`}
                deltaPct={netDelta}
                deltaLabel="vs prior period"
                trend={trends.net}
                variant={netVariant}
              />
              <KpiTile
                label="Orders"
                value={integer(totals.orderCount)}
                hint={ordersHintText ?? `Prior period ${integer(priorTotals.orderCount)}`}
                deltaPct={ordersDelta}
                deltaLabel="vs prior period"
                trend={trends.orders}
                variant={ordersVariantValue}
              />
              <KpiTile
                label="Average Ticket"
                value={php(averageTicket)}
                hint={totals.orderCount > 0 ? `${integer(totals.orderCount)} orders` : "No orders"}
                deltaPct={avgDelta}
                deltaLabel="vs prior period"
                trend={trends.avg}
              />
              <KpiTile
                label="Cancellations"
                value={integer(totals.cancellations)}
                hint={cancellationsHintText ?? `Prior period ${integer(priorTotals.cancellations)}`}
                deltaPct={cancellationsDelta}
                deltaLabel="vs prior period"
                trend={trends.cancellations}
                variant={cancellationsVariantValue}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h2 className="text-sm font-semibold text-[#705d48] uppercase tracking-wide mb-3">Revenue Per Day</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `PHP ${value}`} />
                      <Tooltip formatter={(value: number) => currencyPhp(value)} />
                      <Bar dataKey="revenue" fill="#ac312d" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4">
                <h2 className="text-sm font-semibold text-[#705d48] uppercase tracking-wide mb-3">Orders By Status</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={65}
                        outerRadius={95}
                        label={({ status, count }) => `${status}: ${count}`}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.status} fill={statusColors[entry.status] ?? "#705d48"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PaymentMixDonut rows={paymentRows} />
              <TopItemsList rows={productRows} limit={10} />
            </div>

            <OrGapPanel gaps={orGaps} />

            <HourlySalesChart rows={hourlyRows} />

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-[#0d0f13]">Recent Orders</h2>
                <Link href="/admin/orders" className="text-sm font-semibold text-[#c08643]">
                  View all
                </Link>
              </div>
              {orders.slice(0, 5).length === 0 ? (
                <p className="text-sm text-[#705d48]">No orders in this range yet.</p>
              ) : (
                <ul className="space-y-2">
                  {orders.slice(0, 5).map((order) => (
                    <li key={order.id} className="border border-[#ebe9e6] rounded-md p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#0d0f13]">
                          {order.order_number}
                        </Link>
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-full text-white"
                          style={{ backgroundColor: statusColors[order.status] ?? "#705d48" }}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="text-sm text-[#705d48] mt-1">
                        {order.customer_name} | {currencyPhp(Number(order.total_amount))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {reportMarkdown && (
          <section id="ai-report" className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mt-8 print-report">
            <div className="flex items-center justify-between mb-4 print-hide flex-wrap gap-3">
              <div>
                <h2 className="font-poppins font-bold text-xl uppercase tracking-wide text-[#0d0f13]">AI Report</h2>
                <p className="text-sm text-[#705d48]">
                  {reportRange?.label} | Generated{" "}
                  {new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#0d0f13] text-white text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-black transition-colors"
                >
                  Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setReportMarkdown(null)}
                  className="px-4 py-2 bg-white border border-[#0d0f13] text-[#0d0f13] text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-[#ebe9e6] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <ReportMarkdown markdown={reportMarkdown} />
          </section>
        )}
      </section>
    </AdminLayout>
  );
}
