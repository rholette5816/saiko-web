import { AdminLayout } from "@/components/AdminLayout";
import { CounterReceipt } from "@/components/CounterReceipt";
import { useAuth } from "@/lib/auth";
import { useBusinessSettings } from "@/lib/businessSettings";
import { menuData } from "@/lib/menuData";
import { type BusinessSettings, supabase } from "@/lib/supabase";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PaymentMethod = "cash" | "gcash" | "card";

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
}

interface CompletedOrder {
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
  createdAt: Date;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  seniorPwdDiscount: number;
  seniorPwdId: string | null;
  seniorPwdName: string | null;
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

export default function AdminCounter() {
  const { session } = useAuth();
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
  const [isSeniorPwd, setIsSeniorPwd] = useState(false);
  const [seniorId, setSeniorId] = useState("");
  const [seniorName, setSeniorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<CompletedOrder | null>(null);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<CompletedOrder | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const categories = useMemo(
    () => [
      { id: "all", name: "All", emoji: "All" },
      ...menuData.map((category) => ({ id: category.id, name: category.name, emoji: category.emoji })),
    ],
    [],
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
    [],
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
    const seniorDiscount = isSeniorPwd ? round2(subtotal * 0.2) : 0;
    if (isSeniorPwd) {
      const vatExemptSales = round2(subtotal - seniorDiscount);
      return {
        seniorDiscount,
        vatableSales: 0,
        vatAmount: 0,
        vatExemptSales,
        total: vatExemptSales,
      };
    }

    if (resolvedSettings.vat_registered) {
      const vatAmount = round2((subtotal * resolvedSettings.vat_rate) / (100 + resolvedSettings.vat_rate));
      const vatableSales = round2(subtotal - vatAmount);
      return {
        seniorDiscount: 0,
        vatableSales,
        vatAmount,
        vatExemptSales: 0,
        total: subtotal,
      };
    }

    return {
      seniorDiscount: 0,
      vatableSales: 0,
      vatAmount: 0,
      vatExemptSales: 0,
      total: subtotal,
    };
  }, [isSeniorPwd, resolvedSettings.vat_rate, resolvedSettings.vat_registered, subtotal]);

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

  function addToOrder(item: { id: string; name: string; price: number; image?: string }) {
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
    setIsSeniorPwd(false);
    setSeniorId("");
    setSeniorName("");
    setError(null);
  }

  async function handleSubmit() {
    if (!orderItems.length || submitting) return;
    setSubmitting(true);
    setError(null);

    const received = paymentMethod === "cash" ? Number(cashReceived || 0) : pricing.total;

    if (isSeniorPwd && (!seniorId.trim() || !seniorName.trim())) {
      setError("Senior/PWD ID Number and Full Name are required.");
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
      p_senior_pwd: isSeniorPwd,
      p_senior_pwd_id: isSeniorPwd ? seniorId.trim() : null,
      p_senior_pwd_name: isSeniorPwd ? seniorName.trim() : null,
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
      createdAt: new Date(),
      vatableSales: Number(row?.vatable_sales ?? pricing.vatableSales),
      vatAmount: Number(row?.vat_amount ?? pricing.vatAmount),
      vatExemptSales: Number(row?.vat_exempt_sales ?? pricing.vatExemptSales),
      seniorPwdDiscount: Number(row?.senior_pwd_discount ?? pricing.seniorDiscount),
      seniorPwdId: isSeniorPwd ? seniorId.trim() : null,
      seniorPwdName: isSeniorPwd ? seniorName.trim() : null,
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

        <div className="mt-2 max-h-[26vh] md:max-h-[27vh] overflow-y-auto space-y-2 pr-1">
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

          <div className="rounded-lg border border-[#d8d2cb] p-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isSeniorPwd}
                onChange={(event) => setIsSeniorPwd(event.target.checked)}
              />
              <span className="text-sm font-semibold text-[#0d0f13]">Senior Citizen / PWD</span>
            </label>
            <p className="mt-1 text-xs text-[#705d48]">Senior/PWD discount applies to the entire order.</p>

            {isSeniorPwd && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">ID Number</label>
                  <input
                    type="text"
                    value={seniorId}
                    onChange={(event) => setSeniorId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                    placeholder="Required"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Full Name</label>
                  <input
                    type="text"
                    value={seniorName}
                    onChange={(event) => setSeniorName(event.target.value)}
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
              {(["cash", "gcash", "card"] as PaymentMethod[]).map((method) => (
                <label
                  key={method}
                  className={`rounded-lg border px-2 py-2 text-center text-sm font-semibold cursor-pointer ${
                    paymentMethod === method
                      ? "border-[#ac312d] bg-[#ac312d] text-white"
                      : "border-[#d8d2cb] text-[#0d0f13]"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`payment-${isMobile ? "mobile" : "desktop"}`}
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  {method.toUpperCase()}
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

          {pricing.seniorDiscount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[#705d48]">Senior/PWD (-20%)</span>
              <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(pricing.seniorDiscount)}</span>
            </div>
          )}

          {!isSeniorPwd && resolvedSettings.vat_registered && (
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

          {isSeniorPwd && (
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
            <span className="text-[#705d48]">Payment ({paymentMethod.toUpperCase()})</span>
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
            onClick={handleSubmit}
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
      <section className="space-y-3 md:h-[calc(100vh-10.5rem)] md:overflow-hidden">
        <style>{`
          .print-receipt-root { display: none; }
          @media print {
            .counter-screen { display: none !important; }
            .print-receipt-root { display: block !important; }
          }
        `}</style>

        <div className="counter-screen md:h-full md:flex md:flex-col">
          <div className="mb-2">
            <h1 className="text-2xl font-bold text-[#0d0f13]">Counter Mode</h1>
            <p className="text-sm text-[#705d48]">Walk-in order entry, VAT/Senior handling, and receipt printing.</p>
          </div>

          {settingsLoading && (
            <div className="mb-3 rounded-lg border border-[#d8d2cb] bg-white p-3 text-sm text-[#705d48]">
              Loading business settings...
            </div>
          )}

          {lastCompletedOrder && (
            <div className="mb-3 rounded-lg border border-[#2d7a3e]/25 bg-[#2d7a3e]/10 p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#1d5e2e]">
                Order #{lastCompletedOrder.orderNumber} completed. Receipt printed.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPrintingOrder(lastCompletedOrder)}
                  className="px-3 py-1.5 rounded-md bg-[#0d0f13] text-white text-xs font-semibold"
                >
                  Print Again
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
          )}

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(380px,1fr)] gap-3 md:flex-1 md:min-h-0">
            <div className="bg-white rounded-xl border border-[#d8d2cb] p-3 md:p-4 md:h-full md:min-h-0 md:flex md:flex-col">
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

              <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:flex-1 md:min-h-0 overflow-y-auto pr-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToOrder(item)}
                    className="bg-white border border-[#ebe9e6] rounded-lg p-2.5 text-left min-h-[108px] md:min-h-[100px] hover:border-[#c08643] transition-colors"
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
              seniorPwdDiscount={printingOrder.seniorPwdDiscount}
              seniorPwdId={printingOrder.seniorPwdId}
              seniorPwdName={printingOrder.seniorPwdName}
              settings={resolvedSettings}
              cashier={session?.user?.email ?? "admin"}
            />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
