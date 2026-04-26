import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { Phone, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderWithItems {
  id: string;
  order_number: string;
  tracking_token?: string | null;
  customer_name: string;
  customer_phone: string;
  pickup_label: string;
  pickup_time: string;
  is_pre_order: boolean;
  notes: string | null;
  status: OrderStatus;
  total_amount: number | string;
  promo_code?: string | null;
  subtotal?: number | string | null;
  discount_amount?: number | string | null;
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

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function buildReadyMessage(order: OrderWithItems): string {
  const lines = order.order_items.map(
    (item) => `- ${item.item_name} x${Number(item.quantity)} (${currencyPhp(Number(item.line_total))})`,
  );
  return [
    `Hi ${order.customer_name}, your order is ready for pickup.`,
    `Order: ${order.order_number}`,
    `Pickup: ${order.pickup_label}`,
    lines.length ? `Items:\n${lines.join("\n")}` : "",
    `Total: ${currencyPhp(Number(order.total_amount))}`,
    order.notes ? `Notes: ${order.notes}` : "",
    "Thank you! - Saiko Ramen & Sushi",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function AdminOrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [readyModalOpen, setReadyModalOpen] = useState(false);
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
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function copyTrackingUrl() {
    if (!order?.tracking_token) return;
    const url = `${window.location.origin}/track/${encodeURIComponent(order.tracking_token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Tracking URL copied.");
    } catch {
      setNotice("Could not copy tracking URL.");
    }
  }

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

    if (nextStatus !== "ready") {
      setNotice(`Order marked as ${nextStatus}.`);
    }

    setSavingStatus(null);
    await fetchOrder();
  }

  async function copyReadyMessage() {
    if (!order) return;
    const message = buildReadyMessage(order);
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Ready message copied.");
    } catch {
      setNotice("Could not copy ready message.");
    }
  }

  async function copyCustomerPhone() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(normalizePhone(order.customer_phone));
      setNotice("Customer phone copied.");
    } catch {
      setNotice("Could not copy customer phone.");
    }
  }

  async function confirmReadyManual() {
    if (!order) return;
    setSavingStatus("ready");
    setError(null);

    const { error: updateError } = await supabase.from("orders").update({ status: "ready" }).eq("id", id);
    if (updateError) {
      setSavingStatus(null);
      setError(updateError.message);
      return;
    }

    const message = buildReadyMessage(order);
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // ignore clipboard failure
    }

    setNotice("Order marked ready. Message copied. Please call or text customer manually.");
    setReadyModalOpen(false);
    setSavingStatus(null);
    await fetchOrder();
  }

  const total = useMemo(() => Number(order?.total_amount ?? 0), [order]);
  const discountAmount = useMemo(() => Number(order?.discount_amount ?? 0), [order]);
  const subtotal = useMemo(
    () => Number(order?.subtotal ?? (Number(order?.total_amount ?? 0) + Number(order?.discount_amount ?? 0))),
    [order],
  );

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
              <a href={`tel:${normalizePhone(order.customer_phone)}`} className="text-sm text-[#705d48] hover:text-[#ac312d]">
                {order.customer_phone}
              </a>
              <p className="text-sm text-[#705d48] mt-1">{order.pickup_label}</p>
              {order.tracking_token ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-[#705d48]">Tracking URL ready</p>
                  <button
                    type="button"
                    onClick={copyTrackingUrl}
                    className="px-2 py-1 rounded-md border border-[#d8d2cb] text-xs font-semibold text-[#0d0f13]"
                  >
                    Copy Link
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#ac312d] mt-2">Tracking token missing for this order.</p>
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
              <div className="mt-3 space-y-1 text-right">
                {order.promo_code && (
                  <>
                    <p className="text-sm text-[#705d48]">Subtotal: {currencyPhp(subtotal)}</p>
                    <p className="text-sm text-[#705d48]">
                      Promo: {order.promo_code} (-{currencyPhp(discountAmount)})
                    </p>
                  </>
                )}
                <p className="text-lg font-bold text-[#0d0f13]">Total: {currencyPhp(total)}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h2 className="font-semibold text-[#0d0f13] mb-3">Update Status</h2>
              <div className="rounded-lg border border-[#e4ddd5] bg-[#f8f4ef] p-3 sm:p-4 mb-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#0d0f13]">Ready for Pickup</p>
                  <p className="text-xs text-[#705d48] mt-1">
                    Review details in popup, then mark ready and contact customer manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReadyModalOpen(true)}
                  disabled={order.status === "ready" || savingStatus !== null}
                  className="mt-3 sm:mt-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#ac312d] text-white text-sm font-semibold disabled:opacity-50 min-w-[230px]"
                >
                  <Smartphone size={15} />
                  Open Ready Flow
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Mark Preparing", value: "preparing" as OrderStatus },
                  { label: "Mark Completed", value: "completed" as OrderStatus },
                  { label: "Cancel Order", value: "cancelled" as OrderStatus },
                ].map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    onClick={() => updateStatus(action.value)}
                    disabled={order.status === action.value || savingStatus !== null}
                    className="px-3 py-2 rounded-md border border-[#0d0f13] text-[#0d0f13] bg-white text-sm font-semibold disabled:opacity-50"
                  >
                    {savingStatus === action.value ? "Saving..." : action.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#705d48] mt-2">
                Desktop flow: copy phone and message from popup, then call or text from your own device/app.
              </p>
              <Link href={`/admin/orders/${order.id}/print`} className="inline-block mt-4 text-sm font-semibold text-[#c08643]">
                Print Pickup Slip
              </Link>
            </div>

            {readyModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-4">
                <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe9e6]">
                    <h3 className="text-lg font-semibold text-[#0d0f13]">Ready Confirmation</h3>
                    <button
                      type="button"
                      onClick={() => setReadyModalOpen(false)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#d8d2cb]"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="px-4 py-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:items-start">
                      <div>
                        <p className="text-sm text-[#705d48]">
                          Customer: <span className="font-semibold text-[#0d0f13]">{order.customer_name}</span>
                        </p>
                        <p className="text-sm text-[#705d48] mt-1">
                          Phone: <span className="font-semibold text-[#0d0f13]">{order.customer_phone}</span>
                        </p>
                      </div>
                      <a
                        href={`tel:${normalizePhone(order.customer_phone)}`}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[#0d0f13] text-[#0d0f13] text-sm font-semibold"
                      >
                        <Phone size={14} />
                        Call Customer
                      </a>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-[#705d48] mb-2">Ready Message Preview</p>
                      <textarea
                        readOnly
                        value={buildReadyMessage(order)}
                        className="w-full h-44 rounded-md border border-[#d8d2cb] bg-[#faf8f5] px-3 py-2 text-sm text-[#0d0f13] resize-none"
                      />
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-[#ebe9e6] flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReadyModalOpen(false)}
                      className="px-3 py-2 rounded-md border border-[#d8d2cb] text-[#0d0f13] text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={copyCustomerPhone}
                      className="px-3 py-2 rounded-md border border-[#0d0f13] text-[#0d0f13] text-sm font-semibold"
                    >
                      Copy Phone
                    </button>
                    <button
                      type="button"
                      onClick={copyReadyMessage}
                      className="px-3 py-2 rounded-md border border-[#0d0f13] text-[#0d0f13] text-sm font-semibold"
                    >
                      Copy Message
                    </button>
                    <button
                      type="button"
                      onClick={confirmReadyManual}
                      disabled={savingStatus === "ready"}
                      className="px-4 py-2 rounded-md bg-[#ac312d] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {savingStatus === "ready" ? "Saving..." : "Mark Ready"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </AdminLayout>
  );
}
