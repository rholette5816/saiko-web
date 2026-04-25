import { AdminLayout } from "@/components/AdminLayout";
import { computeKpis, countByStatus, groupRevenueByDay } from "@/lib/analytics";
import { type DateRange, type DateRangeKey, getCustomRange, getRange } from "@/lib/dateRanges";
import { supabase, type OrderRow } from "@/lib/supabase";
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
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");
  const [range, setRange] = useState<DateRange>(getRange("today"));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

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

  return (
    <AdminLayout>
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0d0f13]">Dashboard</h1>
            <p className="text-sm text-[#705d48]">{range.label}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
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
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `\u20B1${value}`} />
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
                        {order.customer_name} · {currencyPhp(Number(order.total_amount))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
