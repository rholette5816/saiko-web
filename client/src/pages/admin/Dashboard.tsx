import { ReportMarkdown } from "@/components/ReportMarkdown";
import { AdminLayout } from "@/components/AdminLayout";
import { computeKpis, countByStatus, groupRevenueByDay } from "@/lib/analytics";
import { type DateRange, type DateRangeKey, getCustomRange, getRange } from "@/lib/dateRanges";
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

function currencyPhp(value: number): string {
  return `PHP ${Math.round(value).toLocaleString("en-PH")}`;
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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const onNewOrder = () => fetchOrders(true);
    window.addEventListener("saiko:new-order", onNewOrder);
    const interval = window.setInterval(() => fetchOrders(true), 15000);
    return () => {
      window.removeEventListener("saiko:new-order", onNewOrder);
      window.clearInterval(interval);
    };
  }, [fetchOrders]);

  const kpis = useMemo(() => computeKpis(orders), [orders]);
  const revenueData = useMemo(
    () => groupRevenueByDay(orders, new Date(range.startIso), new Date(range.endIso)),
    [orders, range.startIso, range.endIso],
  );
  const statusData = useMemo(() => countByStatus(orders), [orders]);

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
      if (invokeError) throw invokeError;
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Orders</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{kpis.totalCount}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Gross Sales</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{currencyPhp(kpis.grossSales)}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Completed Sales</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{currencyPhp(kpis.completedSales)}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Avg Order Value</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{currencyPhp(kpis.averageOrderValue)}</p>
              </div>
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
