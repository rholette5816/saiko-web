import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/lib/auth";
import { useBusinessSettings } from "@/lib/businessSettings";
import { exportOrdersToCsv } from "@/lib/csvExport";
import { getCustomRange } from "@/lib/dateRanges";
import { type OrderItemRow, type OrderRow, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

type ChannelFilter = "counter" | "both" | "web";
type PaymentLabel = "Cash" | "GCash" | "Card" | "Online";
type OrderWithItems = OrderRow & { order_items?: OrderItemRow[] };

interface ItemSummaryRow {
  name: string;
  qty: number;
  revenue: number;
}

function formatYmdInManila(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function manilaDayBoundaries(ymd: string): { startIso: string; endIso: string } {
  const range = getCustomRange(ymd, ymd);
  return { startIso: range.startIso, endIso: range.endIso };
}

function php(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolvePaymentLabel(order: OrderRow): PaymentLabel {
  const method = String(order.payment_method ?? "").trim().toLowerCase();
  if (method === "cash") return "Cash";
  if (method === "gcash") return "GCash";
  if (method === "card") return "Card";
  return "Online";
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export default function AdminDailyReport() {
  const { session } = useAuth();
  const { settings } = useBusinessSettings();

  const [date, setDate] = useState(() => formatYmdInManila(new Date()));
  const [channel, setChannel] = useState<ChannelFilter>("counter");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [ordersWithItems, setOrdersWithItems] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [thermalMode, setThermalMode] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    setDate(formatYmdInManila(new Date()));
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { startIso, endIso } = manilaDayBoundaries(date);

    let completedQuery = supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("status", "completed")
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    if (channel === "counter") completedQuery = completedQuery.eq("channel", "counter");
    if (channel === "web") completedQuery = completedQuery.eq("channel", "web");

    const { data, error: fetchError } = await completedQuery;
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    let cancelledQuery = supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    if (channel === "counter") cancelledQuery = cancelledQuery.eq("channel", "counter");
    if (channel === "web") cancelledQuery = cancelledQuery.eq("channel", "web");

    const { count, error: cancelError } = await cancelledQuery;
    if (cancelError) {
      setError(cancelError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as OrderWithItems[];
    setOrdersWithItems(rows);
    setOrders(rows.map((row) => ({ ...row, order_items: undefined } as OrderRow)));
    setOrderItems(
      rows.flatMap((row) =>
        (row.order_items ?? []).map((item) => ({
          ...item,
          order_id: row.id,
        })),
      ),
    );
    setCancelledCount(Number(count ?? 0));
    setGeneratedAt(new Date());
    setLoading(false);
  }, [channel, date]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const grossSales = useMemo(
    () => orders.reduce((sum, order) => sum + toNumber(order.total_amount), 0),
    [orders],
  );
  const promoDiscount = useMemo(
    () =>
      orders.reduce((sum, order) => {
        if (!order.promo_code) return sum;
        return sum + toNumber(order.discount_amount);
      }, 0),
    [orders],
  );
  const seniorPwdDiscount = useMemo(
    () => orders.reduce((sum, order) => sum + toNumber(order.senior_pwd_discount), 0),
    [orders],
  );
  const netSales = useMemo(
    () => grossSales - promoDiscount - seniorPwdDiscount,
    [grossSales, promoDiscount, seniorPwdDiscount],
  );

  const vatableSales = useMemo(
    () => orders.reduce((sum, order) => sum + toNumber(order.vatable_sales), 0),
    [orders],
  );
  const vatAmount = useMemo(
    () => orders.reduce((sum, order) => sum + toNumber(order.vat_amount), 0),
    [orders],
  );
  const vatExemptSales = useMemo(
    () => orders.reduce((sum, order) => sum + toNumber(order.vat_exempt_sales), 0),
    [orders],
  );

  const orRange = useMemo(() => {
    const withOr = orders
      .filter((order) => !!order.or_number)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (!withOr.length) {
      return { first: null as string | null, last: null as string | null, count: 0 };
    }
    return {
      first: withOr[0].or_number ?? null,
      last: withOr[withOr.length - 1].or_number ?? null,
      count: withOr.length,
    };
  }, [orders]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<PaymentLabel, { count: number; amount: number }>();
    for (const order of orders) {
      const label = resolvePaymentLabel(order);
      const current = map.get(label) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += toNumber(order.total_amount);
      map.set(label, current);
    }

    const orderMap: PaymentLabel[] = ["Cash", "GCash", "Card", "Online"];
    return orderMap
      .filter((label) => map.has(label))
      .map((label) => ({ label, count: map.get(label)?.count ?? 0, amount: map.get(label)?.amount ?? 0 }));
  }, [orders]);

  const topItems = useMemo(() => {
    const grouped = new Map<string, ItemSummaryRow>();
    for (const item of orderItems) {
      const key = `${item.item_id}::${item.item_name}`;
      const current = grouped.get(key) ?? {
        name: item.item_name,
        qty: 0,
        revenue: 0,
      };
      current.qty += toNumber(item.quantity);
      current.revenue += toNumber(item.line_total);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orderItems]);

  function handleExportCsv() {
    const filename = `saiko-daily-${date}-${channel}.csv`;
    exportOrdersToCsv(
      ordersWithItems.map((order) => ({
        ...order,
        items: order.order_items ?? [],
      })),
      filename,
    );
  }

  return (
    <AdminLayout>
      <section className="space-y-4 admin-print-scope">
        <style>{`
          @media print {
            @page { size: ${thermalMode ? "80mm auto" : "A4"}; margin: ${thermalMode ? "0" : "1.5cm"}; }
            body { background: white !important; }
            .print-hide { display: none !important; }
            .admin-print-scope > *:not(.daily-report-print) { display: none !important; }
            .daily-report-print { box-shadow: none !important; padding: ${thermalMode ? "0.5rem" : "0"} !important; }
          }
        `}</style>

        <div className="print-hide">
          <h1 className="text-2xl font-bold text-[#0d0f13]">Daily Report</h1>
          <p className="text-sm text-[#705d48]">End-of-day Z-reading summary for cashier and accounting reconciliation.</p>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-3 print-hide">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[#705d48]">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="block mt-1 border border-[#d8d2cb] rounded-md px-2 py-1.5 text-sm"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "counter", label: "Counter only" },
                { key: "both", label: "Both" },
                { key: "web", label: "Web only" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setChannel(option.key as ChannelFilter)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                    channel === option.key ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadReport}
              className="px-4 py-2 rounded-md bg-[#ac312d] text-white text-sm font-semibold"
            >
              Generate Report
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-md bg-[#0d0f13] text-white text-sm font-semibold"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!ordersWithItems.length}
              className="px-4 py-2 rounded-md border border-[#0d0f13] text-[#0d0f13] text-sm font-semibold disabled:opacity-50"
            >
              Export CSV
            </button>
            <label className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-[#0d0f13]">
              <input
                type="checkbox"
                checked={thermalMode}
                onChange={(event) => setThermalMode(event.target.checked)}
              />
              Thermal (80mm)
            </label>
          </div>

          {loading && <p className="text-sm text-[#705d48]">Loading report...</p>}
          {error && <p className="text-sm text-[#ac312d]">Failed to load report: {error}</p>}
        </div>

        {!loading && !error && (
          <article
            className={`daily-report-print bg-white rounded-lg border border-[#d8d2cb] ${
              thermalMode ? "max-w-[340px] mx-auto p-4 text-[12px]" : "p-6"
            }`}
          >
            <header className="space-y-1">
              <h2 className="text-xl font-bold text-[#0d0f13]">{settings?.business_name ?? "SAIKO RAMEN & SUSHI"}</h2>
              <p className="text-sm text-[#705d48]">TIN: {settings?.business_tin ?? "___"}</p>
              <p className="text-sm text-[#705d48]">{settings?.business_address ?? "Address not set"}</p>
              <p className="text-sm text-[#705d48]">
                {settings?.is_bir_accredited ? "Z-READING" : "PROVISIONAL Z-READING"}
              </p>
              <p className="text-sm text-[#705d48]">Date: {date}</p>
              <p className="text-sm text-[#705d48]">
                Generated:{" "}
                {generatedAt?.toLocaleString("en-PH", { timeZone: "Asia/Manila" }) ?? "N/A"}
              </p>
              <p className="text-sm text-[#705d48]">Cashier: {session?.user?.email ?? "admin"}</p>
            </header>

            <section className="mt-5 space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">OR Range</h3>
              {orRange.count === 0 ? (
                <p className="text-sm text-[#705d48]">No counter orders today.</p>
              ) : (
                <div className="text-sm text-[#0d0f13] space-y-1">
                  <p>First OR: {orRange.first}</p>
                  <p>Last OR: {orRange.last}</p>
                  <p>OR Count: {orRange.count}</p>
                </div>
              )}
            </section>

            <section className="mt-5 space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Sales Totals</h3>
              <div className="flex justify-between text-sm">
                <span>Gross Sales</span>
                <span>{php(grossSales)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Promo Discounts</span>
                  <span>-{php(promoDiscount)}</span>
                </div>
              )}
              {seniorPwdDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Senior/PWD Discounts</span>
                  <span>-{php(seniorPwdDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#0d0f13] border-t border-[#ebe9e6] pt-1.5">
                <span>Net Sales</span>
                <span>{php(netSales)}</span>
              </div>
            </section>

            {!!settings?.vat_registered && (
              <section className="mt-5 space-y-1.5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">VAT Breakdown</h3>
                <div className="flex justify-between text-sm">
                  <span>VAT-able Sales</span>
                  <span>{php(vatableSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT ({settings.vat_rate}%)</span>
                  <span>{php(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT-exempt Sales</span>
                  <span>{php(vatExemptSales)}</span>
                </div>
              </section>
            )}

            <section className="mt-5 space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Payment Method Breakdown</h3>
              {paymentBreakdown.length === 0 ? (
                <p className="text-sm text-[#705d48]">No completed orders in this scope.</p>
              ) : (
                paymentBreakdown.map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span>
                      {row.label} ({row.count})
                    </span>
                    <span>{php(row.amount)}</span>
                  </div>
                ))
              )}
            </section>

            <section className="mt-5 space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Order Count</h3>
              <div className="flex justify-between text-sm">
                <span>Completed</span>
                <span>{orders.length}</span>
              </div>
              {cancelledCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Cancelled</span>
                  <span>{cancelledCount}</span>
                </div>
              )}
            </section>

            <section className="mt-5 space-y-1.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Top 10 Items</h3>
              {topItems.length === 0 ? (
                <p className="text-sm text-[#705d48]">No sold items for this day.</p>
              ) : (
                <div className="space-y-1">
                  {topItems.map((item) => (
                    <div key={item.name} className="flex justify-between text-sm">
                      <span>
                        {item.name} ({item.qty})
                      </span>
                      <span>{php(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <footer className="mt-8 pt-3 border-t border-[#ebe9e6] space-y-2 text-sm">
              <p>Cashier signature: ____________________</p>
              <p>Manager signature: ____________________</p>
              {!settings?.is_bir_accredited && (
                <p className="text-[#705d48]">
                  This is a provisional Z-reading for internal use. Not an official BIR Z-reading until Saiko is
                  BIR-accredited.
                </p>
              )}
            </footer>
          </article>
        )}
      </section>
    </AdminLayout>
  );
}
