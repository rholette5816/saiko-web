import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderWithItems {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_label: string;
  pickup_time: string;
  is_pre_order: boolean;
  notes: string | null;
  status: OrderStatus;
  total_amount: number | string;
  messenger_psid?: string | null;
  ready_notified_at?: string | null;
  created_at: string;
  order_items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number | string;
    line_total: number | string;
  }>;
}

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-[#705d48] text-white",
  preparing: "bg-[#e88627] text-[#0d0f13]",
  ready: "bg-[#c08643] text-[#0d0f13]",
  completed: "bg-[#0d0f13] text-white",
  cancelled: "bg-[#ac312d] text-white",
};

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

async function readEdgeFunctionError(err: unknown): Promise<string> {
  const fallback = err instanceof Error ? err.message : "Unknown error";
  const ctx = (err as { context?: unknown })?.context;
  if (!ctx || typeof (ctx as Response).json !== "function") return fallback;
  const res = ctx as Response;
  try {
    const body = await res.clone().json();
    if (body && typeof body === "object" && "error" in body && body.error) {
      const detail = (body as { error: unknown; detail?: unknown }).detail;
      return detail
        ? `${String(body.error)} (${typeof detail === "string" ? detail : JSON.stringify(detail)})`
        : String(body.error);
    }
    return JSON.stringify(body);
  } catch {
    try {
      return (await res.clone().text()) || fallback;
    } catch {
      return fallback;
    }
  }
}

export default function AdminOrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function fetchOrder() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) {
      setError(fetchError.message);
      setOrder(null);
    } else {
      setOrder((data as OrderWithItems | null) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchOrder();
  }, [id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function updateStatus(nextStatus: OrderStatus) {
    if (!order) return;
    setSavingStatus(nextStatus);
    setError(null);
    const { error: updateError } = await supabase.from("orders").update({ status: nextStatus }).eq("id", id);
    if (updateError) {
      setSavingStatus(null);
      setError(updateError.message);
      return;
    }

    if (nextStatus === "ready") {
      const { error: notifyError } = await supabase.functions.invoke("notify-order-ready", {
        body: { ref: order.order_number },
      });
      if (notifyError) {
        const detail = await readEdgeFunctionError(notifyError);
        setError(`Order marked ready, but notify failed: ${detail}`);
      } else {
        setNotice("Order marked as ready and customer notification sent.");
      }
    } else {
      setNotice(`Order marked as ${nextStatus}.`);
    }

    setSavingStatus(null);
    await fetchOrder();
  }

  const total = useMemo(() => Number(order?.total_amount ?? 0), [order]);

  return (
    <AdminLayout>
      <section className="space-y-4">
        <Link href="/admin/orders" className="text-sm font-semibold text-[#c08643]">
          Back to Orders
        </Link>

        {loading && <div className="bg-white rounded-lg p-5 text-sm text-[#705d48]">Loading order...</div>}
        {error && <div className="bg-white rounded-lg p-5 text-sm text-[#ac312d]">Failed to load: {error}</div>}
        {!loading && !error && !order && <div className="bg-white rounded-lg p-5 text-sm text-[#705d48]">Order not found.</div>}

        {!loading && !error && order && (
          <>
            <div className="bg-white rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h1 className="text-2xl font-bold text-[#0d0f13]">Order #{order.order_number}</h1>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColors[order.status]}`}>
                  {order.status}
                </span>
              </div>
              {notice && <p className="mt-2 text-sm text-[#2d7a3e]">{notice}</p>}
            </div>

            <div className="bg-white rounded-lg p-4">
              <h2 className="font-semibold text-[#0d0f13] mb-2">Customer Info</h2>
              <p className="text-sm text-[#0d0f13]">{order.customer_name}</p>
              <p className="text-sm text-[#705d48]">{order.customer_phone}</p>
              <p className="text-sm text-[#705d48] mt-1">{order.pickup_label}</p>
              <p className="text-xs text-[#705d48] mt-1">
                Messenger link: {order.messenger_psid ? "Linked" : "Not linked yet"}
              </p>
              {order.ready_notified_at && (
                <p className="text-xs text-[#2d7a3e] mt-1">
                  Ready alert sent: {new Date(order.ready_notified_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </p>
              )}
              {order.is_pre_order && (
                <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-[#ac312d]/10 text-[#ac312d] font-semibold">
                  Pre-order
                </span>
              )}
              {order.notes && <p className="text-sm text-[#705d48] mt-2">Notes: {order.notes}</p>}
            </div>

            <div className="bg-white rounded-lg p-4">
              <h2 className="font-semibold text-[#0d0f13] mb-3">Items</h2>
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm border-b border-[#f1ede9] pb-2">
                    <div>
                      <p className="font-medium text-[#0d0f13]">{item.item_name}</p>
                      <p className="text-xs text-[#705d48]">
                        {item.quantity} x {currencyPhp(Number(item.unit_price))}
                      </p>
                    </div>
                    <p className="font-semibold text-[#0d0f13]">{currencyPhp(Number(item.line_total))}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-lg font-bold text-[#0d0f13]">Total: {currencyPhp(total)}</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h2 className="font-semibold text-[#0d0f13] mb-3">Update Status</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Mark Preparing", value: "preparing" as OrderStatus },
                  { label: "Mark Ready", value: "ready" as OrderStatus },
                  { label: "Mark Completed", value: "completed" as OrderStatus },
                  { label: "Cancel Order", value: "cancelled" as OrderStatus },
                ].map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    onClick={() => updateStatus(action.value)}
                    disabled={order.status === action.value || savingStatus !== null}
                    className="px-3 py-2 rounded-md bg-[#0d0f13] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {savingStatus === action.value ? "Saving..." : action.label}
                  </button>
                ))}
              </div>
              <Link href={`/admin/orders/${order.id}/print`} className="inline-block mt-4 text-sm font-semibold text-[#c08643]">
                Print Pickup Slip
              </Link>
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
