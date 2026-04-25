import { AdminLayout } from "@/components/AdminLayout";
import { getRange } from "@/lib/dateRanges";
import { supabase, type OrderRow } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const ACTIVE_STATUSES = new Set(["pending", "preparing", "ready"]);
const statusColors: Record<string, string> = {
  pending: "bg-[#705d48] text-white",
  preparing: "bg-[#e88627] text-[#0d0f13]",
  ready: "bg-[#c08643] text-[#0d0f13]",
  completed: "bg-[#0d0f13] text-white",
  cancelled: "bg-[#ac312d] text-white",
};

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchToday() {
      setLoading(true);
      setError(null);
      const range = getRange("today");
      const { data, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }
      setLoading(false);
    }
    fetchToday();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalSales = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const pendingCount = orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length;
    return { orderCount: orders.length, totalSales, pendingCount };
  }, [orders]);

  return (
    <AdminLayout>
      <section className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0d0f13]">Dashboard</h1>
          <p className="text-sm text-[#705d48]">Today at a glance.</p>
        </div>

        {loading && <div className="bg-white rounded-lg p-5 text-sm text-[#705d48]">Loading dashboard...</div>}
        {error && <div className="bg-white rounded-lg p-5 text-sm text-[#ac312d]">Failed to load: {error}</div>}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Orders Today</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{stats.orderCount}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Sales Today</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{currencyPhp(stats.totalSales)}</p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48]">Pending Right Now</p>
                <p className="text-2xl font-bold text-[#0d0f13] mt-1">{stats.pendingCount}</p>
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
                <p className="text-sm text-[#705d48]">No orders yet today.</p>
              ) : (
                <ul className="space-y-2">
                  {orders.slice(0, 5).map((order) => (
                    <li key={order.id} className="border border-[#ebe9e6] rounded-md p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#0d0f13]">
                          {order.order_number}
                        </Link>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[order.status]}`}>
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
