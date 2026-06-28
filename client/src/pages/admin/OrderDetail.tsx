import { AdminLayout } from "@/components/AdminLayout";
import { RoundTicket } from "@/components/RoundTicket";
import { useBusinessSettings } from "@/lib/businessSettings";
import { fetchMenuCategories, type MenuCategory } from "@/lib/menuItems";
import {
  cleanOrderNotes,
  composeOrderTicketNotes,
  getRequiredTicketKinds,
  getTicketItems,
  getTicketStatus,
  parseOrderTicketNotes,
  type TicketKind,
} from "@/lib/orderTickets";
import { computeVatSplit, round2 } from "@/lib/orderTotals";
import { supabase } from "@/lib/supabase";
import { Minus, Phone, Plus, Smartphone, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderItem {
  id: string;
  item_id?: string | null;
  item_name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
}

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
  senior_pwd_discount?: number | string | null;
  or_number?: string | null;
  channel?: string | null;
  service_type?: string | null;
  takeout_charge?: number | string | null;
  created_at: string;
  order_items: OrderItem[];
}

interface EditableItem {
  item_id: string | null;
  item_name: string;
  unit_price: number;
  quantity: number;
}

function formatTicketTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
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
    cleanOrderNotes(order.notes) ? `Notes: ${cleanOrderNotes(order.notes)}` : "",
    "Thank you! - Saiko Ramen & Sushi",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function AdminOrderDetail({ id }: { id: string }) {
  const { settings: businessSettings } = useBusinessSettings();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [readyModalOpen, setReadyModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [takeoutChargeInput, setTakeoutChargeInput] = useState("");
  const [savingTakeoutCharge, setSavingTakeoutCharge] = useState(false);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [editingItems, setEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [addItemSelection, setAddItemSelection] = useState("");
  const [savingItems, setSavingItems] = useState(false);
  const [printingTicket, setPrintingTicket] = useState<{ kind: TicketKind; items: { name: string; quantity: number }[] } | null>(null);
  const [savingTicketKind, setSavingTicketKind] = useState<TicketKind | null>(null);

  useEffect(() => {
    fetchMenuCategories("admin").then(setMenuCategories).catch(() => undefined);
  }, []);

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
    setTakeoutChargeInput(order ? String(order.takeout_charge ?? "") : "");
  }, [order?.id, order?.takeout_charge]);

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

  async function applyTakeoutCharge() {
    if (!order) return;
    const charge = round2(Number(takeoutChargeInput) || 0);
    const base = round2(Number(order.total_amount || 0) - Number(order.takeout_charge || 0) + charge);
    const split = computeVatSplit(base, !!businessSettings?.vat_registered, businessSettings?.vat_rate ?? 12);

    setSavingTakeoutCharge(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        takeout_charge: charge,
        total_amount: split.total,
        vatable_sales: split.vatableSales,
        vat_amount: split.vatAmount,
        vat_exempt_sales: split.vatExemptSales,
      })
      .eq("id", id);
    setSavingTakeoutCharge(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Take-out charge updated.");
    await fetchOrder();
  }

  const allMenuItems = useMemo(
    () => menuCategories.flatMap((category) => category.items.map((item) => ({ id: item.id, name: item.name, price: item.price }))),
    [menuCategories],
  );

  function beginEditItems() {
    if (!order) return;
    setEditItems(
      order.order_items.map((item) => ({
        item_id: item.item_id ?? null,
        item_name: item.item_name,
        unit_price: Number(item.unit_price),
        quantity: Number(item.quantity),
      })),
    );
    setAddItemSelection("");
    setEditingItems(true);
  }

  function cancelEditItems() {
    setEditingItems(false);
    setEditItems([]);
  }

  function changeEditQty(index: number, delta: number) {
    setEditItems((current) =>
      current
        .map((item, i) => (i === index ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function removeEditItem(index: number) {
    setEditItems((current) => current.filter((_, i) => i !== index));
  }

  function addEditItem() {
    const menuItem = allMenuItems.find((item) => item.id === addItemSelection);
    if (!menuItem) return;
    setEditItems((current) => {
      const existing = current.find((item) => item.item_id === menuItem.id);
      if (existing) {
        return current.map((item) => (item.item_id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...current, { item_id: menuItem.id, item_name: menuItem.name, unit_price: menuItem.price, quantity: 1 }];
    });
    setAddItemSelection("");
  }

  async function saveItemEdits() {
    if (!order || !editItems.length) return;
    setSavingItems(true);
    setError(null);

    const newItemsSubtotal = round2(editItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0));
    let updatePayload: Record<string, number | string | null>;

    if (order.channel === "counter") {
      const charge = Number(order.takeout_charge ?? 0);
      const base = round2(newItemsSubtotal + charge);
      const wasSenior = Number(order.senior_pwd_discount ?? 0) > 0;
      if (wasSenior) {
        const discount = round2(base * 0.2);
        const vatExempt = round2(base - discount);
        updatePayload = {
          subtotal: base,
          total_amount: vatExempt,
          vatable_sales: 0,
          vat_amount: 0,
          vat_exempt_sales: vatExempt,
          senior_pwd_discount: discount,
        };
      } else {
        const split = computeVatSplit(base, !!businessSettings?.vat_registered, businessSettings?.vat_rate ?? 12);
        updatePayload = {
          subtotal: base,
          total_amount: split.total,
          vatable_sales: split.vatableSales,
          vat_amount: split.vatAmount,
          vat_exempt_sales: split.vatExemptSales,
        };
      }
    } else {
      const oldItemsSubtotal = round2(
        order.order_items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0),
      );
      const delta = round2(newItemsSubtotal - oldItemsSubtotal);
      updatePayload = {
        subtotal: round2(Number(order.subtotal ?? oldItemsSubtotal) + delta),
        total_amount: round2(Number(order.total_amount || 0) + delta),
      };
    }

    const metadata = parseOrderTicketNotes(order.notes);
    metadata.printStatus.kitchen.printedAt = null;
    metadata.printStatus.bar.printedAt = null;
    const staleNotes = composeOrderTicketNotes(order.notes, metadata.printStatus);

    const { error: itemsDeleteError } = await supabase.from("order_items").delete().eq("order_id", order.id);
    if (itemsDeleteError) {
      setSavingItems(false);
      setError(itemsDeleteError.message);
      return;
    }

    const { error: itemsInsertError } = await supabase.from("order_items").insert(
      editItems.map((item) => ({
        order_id: order.id,
        item_id: item.item_id,
        item_name: item.item_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: round2(item.unit_price * item.quantity),
      })),
    );
    if (itemsInsertError) {
      setSavingItems(false);
      setError(itemsInsertError.message);
      return;
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({ ...updatePayload, notes: staleNotes })
      .eq("id", order.id);

    setSavingItems(false);
    if (orderUpdateError) {
      setError(orderUpdateError.message);
      return;
    }

    setEditingItems(false);
    setNotice("Items updated. Re-send to kitchen/bar.");
    await fetchOrder();
  }

  async function markTicketSubmitted(kind: TicketKind) {
    if (!order) return;
    const metadata = parseOrderTicketNotes(order.notes);
    metadata.printStatus[kind] = {
      printedAt: new Date().toISOString(),
      count: getTicketStatus(order, kind).count + 1,
    };
    const nextNotes = composeOrderTicketNotes(order.notes, metadata.printStatus);
    const { error: updateError } = await supabase.from("orders").update({ notes: nextNotes }).eq("id", order.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await fetchOrder();
  }

  function printOrderTicket(kind: TicketKind) {
    if (!order) return;
    const routedItems = getTicketItems(order.order_items, kind).map((item) => ({
      name: item.item_name,
      quantity: Number(item.quantity ?? 0),
    }));
    if (!routedItems.length) return;

    const previousTitle = document.title;
    document.title = kind === "kitchen" ? "KITCHEN TICKET" : "BAR TICKET";
    setSavingTicketKind(kind);
    setPrintingTicket({ kind, items: routedItems });

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
        setPrintingTicket(null);
        setSavingTicketKind(null);
        void markTicketSubmitted(kind);
      }, 600);
    }, 300);
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
        <style>{`
          .print-ticket-root { display: none; }
          @media print {
            .order-detail-screen { display: none !important; }
            .print-ticket-root { display: block !important; }
          }
        `}</style>

        <div className="order-detail-screen space-y-4">
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
              {cleanOrderNotes(order.notes) && <p className="text-sm text-[#705d48] mt-2">Notes: {cleanOrderNotes(order.notes)}</p>}
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="font-semibold text-[#0d0f13]">Items</h2>
                {!editingItems && order.status !== "completed" && order.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={beginEditItems}
                    className="text-xs font-semibold text-[#c08643]"
                  >
                    Edit Items
                  </button>
                )}
              </div>

              {editingItems ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {editItems.map((item, index) => (
                      <div key={`${item.item_id ?? item.item_name}-${index}`} className="flex items-center justify-between gap-2 text-sm border-b border-[#f1ede9] pb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-[#0d0f13]">{item.item_name}</p>
                          <p className="text-xs text-[#705d48]">{currencyPhp(item.unit_price)} each</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => changeEditQty(index, -1)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center font-semibold text-[#0d0f13]">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeEditQty(index, 1)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEditItem(index)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#ac312d] text-[#ac312d]"
                            title="Remove item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!editItems.length && <p className="text-sm text-[#705d48]">No items. Add at least one below.</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={addItemSelection}
                      onChange={(event) => setAddItemSelection(event.target.value)}
                      className="flex-1 rounded-md border border-[#d8d2cb] px-2 py-1.5 text-sm"
                    >
                      <option value="">Add an item...</option>
                      {allMenuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({currencyPhp(item.price)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addEditItem}
                      disabled={!addItemSelection}
                      className="rounded-md border border-[#0d0f13] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditItems}
                      disabled={savingItems}
                      className="rounded-md border border-[#d8d2cb] px-3 py-2 text-sm font-semibold text-[#0d0f13] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveItemEdits}
                      disabled={savingItems || !editItems.length}
                      className="rounded-md bg-[#0d0f13] px-4 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                    >
                      {savingItems ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            {(() => {
              const requiredKinds = getRequiredTicketKinds(order.order_items);
              if (!requiredKinds.length) return null;
              return (
                <div className="bg-white rounded-lg p-4">
                  <h2 className="font-semibold text-[#0d0f13] mb-3">Kitchen / Bar Tickets</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {requiredKinds.map((kind) => {
                      const status = getTicketStatus(order, kind);
                      const label = kind === "kitchen" ? "Kitchen" : "Bar";
                      const isPrinting = savingTicketKind === kind;
                      const statusText = status.printedAt
                        ? `Done ${formatTicketTime(status.printedAt)}${status.count > 1 ? ` (${status.count}x)` : ""}`
                        : "Pending";
                      return (
                        <div key={kind} className="rounded-lg border border-[#d8d2cb] bg-[#faf8f6] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-[#0d0f13]">{label}</p>
                              <p className={`text-xs font-bold ${status.printedAt ? "text-[#2d7a3e]" : "text-[#ac312d]"}`}>
                                {statusText}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => printOrderTicket(kind)}
                              disabled={isPrinting}
                              className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60 ${
                                kind === "kitchen" ? "bg-[#ac312d]" : "bg-[#c08643]"
                              }`}
                            >
                              {isPrinting ? "Printing" : status.printedAt ? `Reprint ${label}` : `Submit ${label}`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {(order.channel === "web" || order.service_type === "takeout") && (
              <div className="bg-white rounded-lg p-4">
                <h2 className="font-semibold text-[#0d0f13] mb-3">Take-out Charge</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#705d48]">PHP</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={takeoutChargeInput}
                    onChange={(event) => setTakeoutChargeInput(event.target.value)}
                    placeholder="0.00"
                    className="w-28 rounded-md border border-[#d8d2cb] px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyTakeoutCharge}
                    disabled={savingTakeoutCharge}
                    className="rounded-md bg-[#0d0f13] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
                  >
                    {savingTakeoutCharge ? "Saving" : "Apply"}
                  </button>
                </div>
                {Number(order.takeout_charge ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-[#2d7a3e]">
                    Current charge: {currencyPhp(Number(order.takeout_charge))}
                  </p>
                )}
              </div>
            )}

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
        </div>

        {printingTicket && (
          <div className="print-ticket-root">
            <RoundTicket
              kind={printingTicket.kind}
              orderNumber={order?.order_number ?? ""}
              orNumber={order?.or_number ?? ""}
              items={printingTicket.items}
              notes={order ? cleanOrderNotes(order.notes) || undefined : undefined}
              customerName={order?.customer_name}
              serviceType={order?.service_type === "dine-in" ? "DINE IN" : "TAKEOUT / PICKUP"}
              createdAt={new Date()}
            />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
