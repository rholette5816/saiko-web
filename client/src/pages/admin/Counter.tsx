import { AdminLayout } from "@/components/AdminLayout";
import { CounterReceipt } from "@/components/CounterReceipt";
import { RoundTicket } from "@/components/RoundTicket";
import { useBusinessSettings } from "@/lib/businessSettings";
import { useActiveCashier } from "@/lib/cashier";
import { fetchMenuCategories, type MenuCategory } from "@/lib/menuItems";
import { composeOrderTicketNotes, getTicketStatus, parseOrderTicketNotes } from "@/lib/orderTickets";
import { paymentMethodOptions, paymentMethodShortLabel, type PaymentMethod } from "@/lib/paymentMethods";
import { type BusinessSettings, supabase } from "@/lib/supabase";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TicketKind = "kitchen" | "bar";
type CounterServiceType = "dine-in" | "takeout";
type DiscountType = "none" | "senior" | "pwd" | "employee" | "friends" | "custom";

const DISCOUNT_PRESETS: Record<DiscountType, { label: string; defaultPct: number; requiresId: boolean }> = {
  none: { label: "None", defaultPct: 0, requiresId: false },
  senior: { label: "Senior Citizen", defaultPct: 20, requiresId: true },
  pwd: { label: "PWD", defaultPct: 20, requiresId: true },
  employee: { label: "Employee", defaultPct: 10, requiresId: false },
  friends: { label: "Friends", defaultPct: 15, requiresId: false },
  custom: { label: "Custom", defaultPct: 0, requiresId: false },
};

interface CounterMenuItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  categoryId: string;
}

interface CounterOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  categoryId: string;
}

interface CompletedOrder {
  orderId: string;
  orderNumber: string;
  orNumber: string | null;
  items: CounterOrderItem[];
  subtotal: number;
  total: number;
  payment: string;
  received: number;
  change: number;
  customer: string;
  notes: string;
  ticketNotes: string | null;
  createdAt: Date;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  discountType: DiscountType;
  discountPct: number;
  discountAmount: number;
  discountIdNumber: string | null;
  discountHolderName: string | null;
  serviceType: CounterServiceType;
  kitchenTicketPrintedAt: Date | null;
  kitchenTicketPrintCount: number;
  barTicketPrintedAt: Date | null;
  barTicketPrintCount: number;
}

interface CounterTicketPayload {
  orderNumber: string;
  orNumber: string | null;
  items: { name: string; quantity: number }[];
  notes: string;
  customer: string;
  serviceType: CounterServiceType;
  createdAt: Date;
}
interface PlaceCounterOrderRow {
  order_id: string;
  order_number: string;
  or_number: string | null;
  vatable_sales: number | string;
  vat_amount: number | string;
  vat_exempt_sales: number | string;
  senior_pwd_discount: number | string;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  id: "default",
  business_name: "SAIKO RAMEN & SUSHI",
  business_tin: null,
  business_address: null,
  business_contact: null,
  vat_registered: false,
  vat_rate: 12,
  or_prefix: "SAIKO-OR",
  or_next_number: 1,
  receipt_footer: null,
  is_bir_accredited: false,
  updated_at: "",
};

function currencyPhp(value: number): string {
  return `PHP ${Math.round(value * 100) / 100}`.replace(
    /(\d+(\.\d+)?)/,
    (match) => Number(match).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
function serviceLabel(type: CounterServiceType): string {
  return type === "dine-in" ? "DINE IN" : "TAKEOUT / PICKUP";
}

function formatTicketTime(value: Date): string {
  return value.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminCounter() {
  const { activeCashier } = useActiveCashier();
  const { settings, loading: settingsLoading } = useBusinessSettings();
  const resolvedSettings = settings ?? DEFAULT_SETTINGS;

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [orderItems, setOrderItems] = useState<CounterOrderItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [discountIdNumber, setDiscountIdNumber] = useState("");
  const [discountHolderName, setDiscountHolderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<CompletedOrder | null>(null);
  const [printingTicket, setPrintingTicket] = useState<CounterTicketPayload | null>(null);
  const [activeTicketKind, setActiveTicketKind] = useState<TicketKind | null>(null);
  const [printingByTicket, setPrintingByTicket] = useState<Record<TicketKind, boolean>>({ kitchen: false, bar: false });
  const [lastCompletedOrder, setLastCompletedOrder] = useState<CompletedOrder | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [menuData, setMenuData] = useState<MenuCategory[]>([]);

  useEffect(() => {
    fetchMenuCategories("admin")
      .then(setMenuData)
      .catch((menuError: Error) => setError(menuError.message));
  }, []);

  const categories = useMemo(
    () => [
      { id: "all", name: "All", emoji: "All" },
      ...menuData.map((category) => ({ id: category.id, name: category.name, emoji: category.emoji })),
    ],
    [menuData],
  );

  const allItems = useMemo<CounterMenuItem[]>(
    () =>
      menuData.flatMap((category) =>
        category.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          categoryId: category.id,
        })),
      ),
    [menuData],
  );

  const filteredItems = useMemo(() => {
    const q = normalize(search);
    if (q) {
      return allItems.filter((item) => normalize(item.name).includes(q));
    }
    if (activeCategory === "all") return allItems;
    return allItems.filter((item) => item.categoryId === activeCategory);
  }, [activeCategory, allItems, search]);

  const subtotal = useMemo(
    () => round2(orderItems.reduce((total, item) => total + item.price * item.quantity, 0)),
    [orderItems],
  );

  const pricing = useMemo(() => {
    const discountAmount = discountType !== "none" ? round2(subtotal * discountPct / 100) : 0;
    const isVatExempt = discountType === "senior" || discountType === "pwd";

    if (isVatExempt) {
      const vatExemptSales = round2(subtotal - discountAmount);
      return { discountAmount, vatableSales: 0, vatAmount: 0, vatExemptSales, total: vatExemptSales };
    }

    const base = round2(subtotal - discountAmount);

    if (resolvedSettings.vat_registered) {
      const vatAmount = round2((base * resolvedSettings.vat_rate) / (100 + resolvedSettings.vat_rate));
      const vatableSales = round2(base - vatAmount);
      return { discountAmount, vatableSales, vatAmount, vatExemptSales: 0, total: base };
    }

    return { discountAmount, vatableSales: 0, vatAmount: 0, vatExemptSales: 0, total: base };
  }, [discountType, discountPct, resolvedSettings.vat_rate, resolvedSettings.vat_registered, subtotal]);

  const receivedAmount = paymentMethod === "cash" ? Number(cashReceived || 0) : pricing.total;
  const changeDue = paymentMethod === "cash" ? Math.max(0, round2(receivedAmount - pricing.total)) : 0;

  useEffect(() => {
    if (!orderItems.length) setMobileCartOpen(false);
  }, [orderItems.length]);

  useEffect(() => {
    if (!printingOrder) return;
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 280);
    const dismissTimer = window.setTimeout(() => {
      setPrintingOrder(null);
    }, 900);
    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [printingOrder]);

  function addToOrder(item: { id: string; name: string; price: number; image?: string; categoryId: string }) {
    setOrderItems((cur) => {
      const existing = cur.find((it) => it.id === item.id);
      if (existing) {
        return cur.map((it) => (it.id === item.id ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...cur, { ...item, quantity: 1 }];
    });
  }

  function updateQuantity(itemId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      setOrderItems((cur) => cur.filter((item) => item.id !== itemId));
      return;
    }
    setOrderItems((cur) =>
      cur.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item)),
    );
  }

  function removeItem(itemId: string) {
    setOrderItems((cur) => cur.filter((item) => item.id !== itemId));
  }

  function getCounterTicketItems(items: CounterOrderItem[], kind: TicketKind) {
    return items
      .filter((item) => (kind === "bar" ? item.categoryId === "drinks" : item.categoryId !== "drinks"))
      .map((item) => ({ name: item.name, quantity: item.quantity }))
      .filter((item) => item.quantity > 0);
  }

  async function markCounterTicketPrinted(order: CompletedOrder, kind: TicketKind) {
    const printedAt = new Date();
    const nextLocalOrder =
      kind === "kitchen"
        ? {
            ...order,
            kitchenTicketPrintedAt: printedAt,
            kitchenTicketPrintCount: order.kitchenTicketPrintCount + 1,
          }
        : {
            ...order,
            barTicketPrintedAt: printedAt,
            barTicketPrintCount: order.barTicketPrintCount + 1,
          };

    setLastCompletedOrder((current) => {
      if (!current || current.orderNumber !== order.orderNumber) return current;
      return nextLocalOrder;
    });

    if (!order.orderId) return;

    const metadata = parseOrderTicketNotes(order.ticketNotes ?? order.notes);
    metadata.printStatus[kind] = {
      printedAt: printedAt.toISOString(),
      count: getTicketStatus({ notes: order.ticketNotes }, kind).count + 1,
    };
    const nextNotes = composeOrderTicketNotes(order.notes, metadata.printStatus);
    const { error: updateError } = await supabase.from("orders").update({ notes: nextNotes }).eq("id", order.orderId);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setLastCompletedOrder((current) => {
      if (!current || current.orderNumber !== order.orderNumber) return current;
      return { ...current, ticketNotes: nextNotes };
    });
    window.dispatchEvent(new CustomEvent("saiko:ticket-updated", { detail: { orderId: order.orderId, kind } }));
  }

  function printCounterTicket(order: CompletedOrder, kind: TicketKind) {
    const items = getCounterTicketItems(order.items, kind);
    if (items.length === 0) return;

    const previousTitle = document.title;
    setPrintingOrder(null);
    document.title = kind === "kitchen" ? "KITCHEN TICKET" : "BAR TICKET";
    setPrintingByTicket((current) => ({ ...current, [kind]: true }));
    setPrintingTicket({
      orderNumber: order.orderNumber,
      orNumber: order.orNumber,
      items,
      notes: order.notes,
      customer: order.customer,
      serviceType: order.serviceType,
      createdAt: order.createdAt,
    });
    setActiveTicketKind(kind);

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
        setPrintingTicket(null);
        setActiveTicketKind(null);
        setPrintingByTicket((current) => ({ ...current, [kind]: false }));
        void markCounterTicketPrinted(order, kind);
      }, 600);
    }, 300);
  }

  function renderCounterTicketAction(order: CompletedOrder, kind: TicketKind) {
    const items = getCounterTicketItems(order.items, kind);
    if (items.length === 0) return null;

    const label = kind === "kitchen" ? "Kitchen" : "Bar";
    const printedAt = kind === "kitchen" ? order.kitchenTicketPrintedAt : order.barTicketPrintedAt;
    const printCount = kind === "kitchen" ? order.kitchenTicketPrintCount : order.barTicketPrintCount;
    const isPrinting = printingByTicket[kind];
    const statusText = printedAt ? `Printed ${formatTicketTime(printedAt)}${printCount > 1 ? ` (${printCount}x)` : ""}` : "Pending";

    return (
      <div className="flex flex-col gap-1 rounded-md border border-[#d8d2cb] bg-white px-2 py-1.5">
        <span className={`text-[11px] font-bold ${printedAt ? "text-[#2d7a3e]" : "text-[#ac312d]"}`}>{statusText}</span>
        <button
          type="button"
          onClick={() => printCounterTicket(order, kind)}
          disabled={isPrinting}
          className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
            kind === "kitchen" ? "bg-[#ac312d] text-white" : "bg-[#c08643] text-white"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isPrinting ? "Printing..." : printedAt ? `Reprint ${label}` : `Submit ${label}`}
        </button>
      </div>
    );
  }

  function openServiceModal() {
    if (!orderItems.length || submitting) return;
    setError(null);
    setServiceModalOpen(true);
  }

  function resetForm(withConfirm = true) {
    if (withConfirm && orderItems.length > 0) {
      const ok = window.confirm("Clear current order?");
      if (!ok) return;
    }
    setOrderItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setCashReceived("");
    setPaymentMethod("cash");
    setDiscountType("none");
    setDiscountPct(0);
    setDiscountIdNumber("");
    setDiscountHolderName("");
    setError(null);
    setServiceModalOpen(false);
  }

  async function handleSubmit(serviceType: CounterServiceType) {
    if (!orderItems.length || submitting) return;
    setServiceModalOpen(false);
    setSubmitting(true);
    setError(null);

    const received = paymentMethod === "cash" ? Number(cashReceived || 0) : pricing.total;

    if (DISCOUNT_PRESETS[discountType].requiresId && (!discountIdNumber.trim() || !discountHolderName.trim())) {
      setError(`${DISCOUNT_PRESETS[discountType].label} discount requires ID Number and Full Name.`);
      setSubmitting(false);
      return;
    }

    if (paymentMethod === "cash" && received < pricing.total) {
      setError("Cash received is less than the total.");
      setSubmitting(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("place_counter_order", {
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim(),
      p_subtotal: subtotal,
      p_total_amount: pricing.total,
      p_payment_method: paymentMethod,
      p_amount_received: paymentMethod === "cash" ? received : pricing.total,
      p_notes: notes.trim() || null,
      p_senior_pwd: discountType === "senior" || discountType === "pwd",
      p_senior_pwd_id: DISCOUNT_PRESETS[discountType].requiresId ? discountIdNumber.trim() : null,
      p_senior_pwd_name: DISCOUNT_PRESETS[discountType].requiresId ? discountHolderName.trim() : null,
      p_items: orderItems.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        line_total: item.price * item.quantity,
      })),
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    const rows = Array.isArray(data)
      ? (data as PlaceCounterOrderRow[])
      : data
        ? [data as PlaceCounterOrderRow]
        : [];
    const row = rows[0];
    const orderNumber = row?.order_number ?? "";
    if (!orderNumber) {
      setError("Counter order was saved but order number was not returned.");
      setSubmitting(false);
      return;
    }

    const completed: CompletedOrder = {
      orderId: row?.order_id ?? "",
      orderNumber,
      orNumber: row?.or_number ?? null,
      items: orderItems,
      subtotal,
      total: pricing.total,
      payment: paymentMethod,
      received,
      change: Math.max(0, round2(received - pricing.total)),
      customer: customerName.trim() || "Walk-in",
      notes: notes.trim(),
      ticketNotes: notes.trim() || null,
      createdAt: new Date(),
      vatableSales: Number(row?.vatable_sales ?? pricing.vatableSales),
      vatAmount: Number(row?.vat_amount ?? pricing.vatAmount),
      vatExemptSales: Number(row?.vat_exempt_sales ?? pricing.vatExemptSales),
      discountType,
      discountPct,
      discountAmount: Number(row?.senior_pwd_discount ?? pricing.discountAmount),
      discountIdNumber: DISCOUNT_PRESETS[discountType].requiresId ? discountIdNumber.trim() : null,
      discountHolderName: DISCOUNT_PRESETS[discountType].requiresId ? discountHolderName.trim() : null,
      serviceType,
      kitchenTicketPrintedAt: null,
      kitchenTicketPrintCount: 0,
      barTicketPrintedAt: null,
      barTicketPrintCount: 0,
    };

    setPrintingOrder(completed);
    setLastCompletedOrder(completed);
    resetForm(false);
    setSubmitting(false);
  }

  function renderOrderPanel(isMobile: boolean) {
    return (
      <div
        className={`bg-white rounded-xl border border-[#d8d2cb] ${
          isMobile ? "p-4" : "p-3 md:h-full md:min-h-0 md:overflow-y-auto"
        }`}
      >
        <h2 className="text-base font-bold text-[#0d0f13] uppercase tracking-wide">Current Order</h2>
        <p className="text-xs text-[#705d48] mt-1">{orderItems.length} line items</p>

        <div className="mt-2 max-h-[26vh] space-y-2 overflow-y-auto pr-1 md:max-h-[32vh]">
          {orderItems.length === 0 ? (
            <p className="text-sm text-[#705d48] py-3">Tap menu items to start.</p>
          ) : (
            orderItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-[#ebe9e6] p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0d0f13]">{item.name}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#d8d2cb] text-[#705d48]"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-full border border-[#d8d2cb]">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="h-9 w-9 inline-flex items-center justify-center text-[#0d0f13]"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[32px] text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="h-9 w-9 inline-flex items-center justify-center text-[#0d0f13]"
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-sm font-bold text-[#0d0f13]">{currencyPhp(item.price * item.quantity)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className={`${isMobile ? "space-y-2" : "grid grid-cols-2 gap-2"}`}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Walk-in"
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Customer Phone</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-2.5 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Notes</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={1}
              placeholder="Optional notes"
              className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-2.5 py-2 text-sm resize-none"
            />
          </div>

          <div className="rounded-lg border border-[#d8d2cb] p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Discount</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(DISCOUNT_PRESETS) as DiscountType[]).map((type) => (
                <label
                  key={type}
                  className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold cursor-pointer ${
                    discountType === type
                      ? "border-[#c08643] bg-[#c08643] text-white"
                      : "border-[#d8d2cb] text-[#0d0f13]"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`discount-type-${isMobile ? "mobile" : "desktop"}`}
                    value={type}
                    checked={discountType === type}
                    onChange={() => {
                      setDiscountType(type);
                      setDiscountPct(DISCOUNT_PRESETS[type].defaultPct);
                      setDiscountIdNumber("");
                      setDiscountHolderName("");
                    }}
                  />
                  {DISCOUNT_PRESETS[type].label}
                </label>
              ))}
            </div>

            {discountType !== "none" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-2.5 py-2 text-sm"
                />
              </div>
            )}

            {discountType !== "none" && DISCOUNT_PRESETS[discountType].requiresId && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">ID Number</label>
                  <input
                    type="text"
                    value={discountIdNumber}
                    onChange={(e) => setDiscountIdNumber(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                    placeholder="Required"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Full Name</label>
                  <input
                    type="text"
                    value={discountHolderName}
                    onChange={(e) => setDiscountHolderName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                    placeholder="Required"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1.5">Payment Method</p>
            <div className="grid grid-cols-3 gap-1.5">
              {paymentMethodOptions.map((option) => (
                <label
                  key={option.value}
                  className={`rounded-lg border px-2 py-2 text-center text-sm font-semibold cursor-pointer ${
                    paymentMethod === option.value
                      ? "border-[#ac312d] bg-[#ac312d] text-white"
                      : "border-[#d8d2cb] text-[#0d0f13]"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`payment-${isMobile ? "mobile" : "desktop"}`}
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                  />
                  {option.shortLabel}
                </label>
              ))}
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Cash Received</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-2.5 py-2 text-sm"
              />
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-[#ebe9e6] pt-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#705d48]">Subtotal</span>
            <span className="font-semibold">{currencyPhp(subtotal)}</span>
          </div>

          {pricing.discountAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[#705d48]">{DISCOUNT_PRESETS[discountType].label} (-{discountPct}%)</span>
              <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(pricing.discountAmount)}</span>
            </div>
          )}

          {!(discountType === "senior" || discountType === "pwd") && resolvedSettings.vat_registered && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[#705d48]">VAT-able Sales</span>
                <span className="font-semibold">{currencyPhp(pricing.vatableSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#705d48]">VAT ({resolvedSettings.vat_rate}%)</span>
                <span className="font-semibold">{currencyPhp(pricing.vatAmount)}</span>
              </div>
            </>
          )}

          {(discountType === "senior" || discountType === "pwd") && (
            <div className="flex items-center justify-between">
              <span className="text-[#705d48]">VAT-Exempt Sales</span>
              <span className="font-semibold">{currencyPhp(pricing.vatExemptSales)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-base">
            <span className="font-semibold uppercase tracking-wide text-[#705d48]">Total</span>
            <span className="font-bold text-[#ac312d]">{currencyPhp(pricing.total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#705d48]">Payment ({paymentMethodShortLabel(paymentMethod)})</span>
            <span className="font-semibold">{currencyPhp(receivedAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#705d48]">Change</span>
            <span className="font-semibold">{currencyPhp(changeDue)}</span>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-[#ac312d] font-semibold">{error}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openServiceModal}
            disabled={!orderItems.length || submitting || settingsLoading}
            className="h-10 rounded-lg bg-[#ac312d] text-white font-bold uppercase tracking-wide text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit & Print"}
          </button>
          <button
            type="button"
            onClick={() => resetForm(true)}
            className="h-10 rounded-lg border border-[#0d0f13] text-[#0d0f13] font-semibold uppercase tracking-wide text-xs md:text-sm"
          >
            Cancel / Reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <section className="space-y-2 md:h-[calc(100vh-8.75rem)] md:overflow-hidden">
        <style>{`
          .print-receipt-root, .print-ticket-root { display: none; }
          @media print {
            .counter-screen { display: none !important; }
            .print-receipt-root, .print-ticket-root { display: block !important; }
          }
        `}</style>

        <div className="counter-screen md:h-full md:flex md:flex-col">
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-bold text-[#0d0f13]">Counter Mode</h1>
            <p className="text-sm text-[#705d48]">Walk-in order entry, VAT/Senior handling, and receipt printing.</p>
          </div>

          {settingsLoading && (
            <div className="mb-3 rounded-lg border border-[#d8d2cb] bg-white p-3 text-sm text-[#705d48]">
              Loading business settings...
            </div>
          )}

          {lastCompletedOrder && (
            <div className="mb-2 rounded-lg border border-[#2d7a3e]/25 bg-[#2d7a3e]/10 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#1d5e2e]">
                    Order #{lastCompletedOrder.orderNumber} completed. Receipt printed.
                  </p>
                  <p className="text-xs font-semibold text-[#705d48]">{serviceLabel(lastCompletedOrder.serviceType)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintingOrder(lastCompletedOrder)}
                    className="px-3 py-1.5 rounded-md bg-[#0d0f13] text-white text-xs font-semibold"
                  >
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastCompletedOrder(null)}
                    className="px-3 py-1.5 rounded-md border border-[#0d0f13] text-[#0d0f13] text-xs font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {renderCounterTicketAction(lastCompletedOrder, "kitchen")}
                {renderCounterTicketAction(lastCompletedOrder, "bar")}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.8fr)_minmax(400px,0.9fr)] lg:grid-cols-[minmax(0,2.1fr)_minmax(420px,0.9fr)] xl:gap-4">
            <div className="bg-white rounded-xl border border-[#d8d2cb] p-3 md:h-full md:min-h-0 md:flex md:flex-col">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap ${
                        activeCategory === category.id
                          ? "bg-[#0d0f13] text-white"
                          : "bg-[#ebe9e6] text-[#0d0f13]"
                      }`}
                    >
                      {category.emoji} {category.name}
                    </button>
                  ))}
                </div>
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#705d48]" size={16} />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search dish name..."
                    className="w-full h-11 rounded-lg border border-[#d8d2cb] bg-white pl-10 pr-3 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:min-h-0 md:flex-1 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToOrder(item)}
                    className="min-h-[104px] rounded-lg border border-[#ebe9e6] bg-white p-2.5 text-left transition-colors hover:border-[#c08643] md:min-h-[96px]"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-12 w-full rounded-md object-cover mb-1.5"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-12 w-full rounded-md bg-[#f6f2ed] mb-1.5" />
                    )}
                    <p className="text-xs md:text-sm font-semibold text-[#0d0f13] leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-xs md:text-sm font-bold text-[#ac312d] mt-1">{currencyPhp(item.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden md:block md:h-full md:min-h-0">{renderOrderPanel(false)}</div>
          </div>

          <div className="md:hidden">
            {orderItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setMobileCartOpen((prev) => !prev)}
                  className="fixed z-20 bottom-4 left-4 right-4 h-12 rounded-lg bg-[#ac312d] text-white font-bold uppercase tracking-wide text-sm shadow-lg"
                >
                  {mobileCartOpen ? "Hide Cart" : `View Cart (${orderItems.length})`}
                </button>
                {mobileCartOpen && (
                  <div className="fixed z-30 inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto p-3 bg-[#ebe9e6] border-t border-[#d8d2cb] shadow-2xl">
                    {renderOrderPanel(true)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {serviceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Choose Order Type</h2>
                  <p className="mt-1 text-sm text-[#705d48]">This label will print on the kitchen and bar tickets.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleSubmit("dine-in")}
                  className="min-h-[96px] rounded-lg border-2 border-[#ac312d] bg-[#ac312d] px-4 py-4 text-left text-white"
                >
                  <span className="block text-lg font-black uppercase tracking-wide">Dine In</span>
                  <span className="mt-1 block text-sm font-semibold">Print tickets as DINE IN.</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit("takeout")}
                  className="min-h-[96px] rounded-lg border-2 border-[#c08643] bg-white px-4 py-4 text-left text-[#0d0f13]"
                >
                  <span className="block text-lg font-black uppercase tracking-wide">Takeout / Pickup</span>
                  <span className="mt-1 block text-sm font-semibold text-[#705d48]">Print tickets as TAKEOUT / PICKUP.</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {printingTicket && activeTicketKind && (
          <div className="print-ticket-root">
            <RoundTicket
              kind={activeTicketKind}
              orderNumber={printingTicket.orderNumber}
              orNumber={printingTicket.orNumber ?? ""}
              items={printingTicket.items}
              notes={printingTicket.notes || undefined}
              customerName={printingTicket.customer}
              cashierName={activeCashier}
              serviceType={serviceLabel(printingTicket.serviceType)}
              createdAt={printingTicket.createdAt}
            />
          </div>
        )}
        {printingOrder && (
          <div className="print-receipt-root">
            <CounterReceipt
              orderNumber={printingOrder.orderNumber}
              orNumber={printingOrder.orNumber}
              items={printingOrder.items}
              subtotal={printingOrder.subtotal}
              total={printingOrder.total}
              payment={printingOrder.payment}
              received={printingOrder.received}
              change={printingOrder.change}
              customer={printingOrder.customer}
              notes={printingOrder.notes}
              createdAt={printingOrder.createdAt}
              vatableSales={printingOrder.vatableSales}
              vatAmount={printingOrder.vatAmount}
              vatExemptSales={printingOrder.vatExemptSales}
              discountType={printingOrder.discountType}
              discountPct={printingOrder.discountPct}
              discountAmount={printingOrder.discountAmount}
              discountIdNumber={printingOrder.discountIdNumber}
              discountHolderName={printingOrder.discountHolderName}
              settings={resolvedSettings}
              cashier={activeCashier}
            />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
