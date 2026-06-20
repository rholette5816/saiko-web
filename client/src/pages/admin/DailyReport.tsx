import { AdminLayout } from "@/components/AdminLayout";
import { useBusinessSettings } from "@/lib/businessSettings";
import { useActiveCashier } from "@/lib/cashier";
import { exportRowsToCsv, type CsvCell } from "@/lib/csvExport";
import {
  fetchDailySummary,
  fetchOrGaps,
  fetchPaymentMix,
  fetchProductSales,
  fetchTableSales,
  type ChannelFilter,
  type DailySummaryRow,
  type OrGapRow,
  type PaymentMixRow,
  type ProductSalesRow,
  type TableSalesRow,
} from "@/lib/dataCenter";
import { getCustomRange } from "@/lib/dateRanges";
import { PAYMENT_LABEL_ORDER, resolvePaymentLabel as resolvePaymentValueLabel, type PaymentLabel } from "@/lib/paymentMethods";
import { type OrderItemRow, type OrderRow, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";

type PaymentFilter = "all" | PaymentLabel;
type ReportView = "summary" | "products" | "tables" | "orders";
type StatusFilter = "completed" | "cancelled" | "all";
type OrderWithItems = OrderRow & { order_items?: OrderItemRow[] };

interface ItemSummaryRow {
  key: string;
  itemId: string;
  name: string;
  qty: number;
  orderCount: number;
  revenue: number;
}

interface TableSummaryRow {
  tableNumber: string;
  orderCount: number;
  itemCount: number;
  revenue: number;
  orFirst: string | null;
  orLast: string | null;
  cash: number;
  gcash: number;
  card: number;
  online: number;
}

const channelLabels: Record<ChannelFilter, string> = {
  counter: "Counter only",
  both: "Both channels",
  web: "Web only",
};

const paymentOrder: PaymentLabel[] = [...PAYMENT_LABEL_ORDER];

const statusFilterOptions: Array<{ key: StatusFilter; label: string }> = [
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All status" },
];

const statusColors: Record<OrderRow["status"], string> = {
  pending: "bg-[#705d48] text-white",
  preparing: "bg-[#e88627] text-[#0d0f13]",
  ready: "bg-[#c08643] text-[#0d0f13]",
  completed: "bg-[#0d0f13] text-white",
  cancelled: "bg-[#ac312d] text-white",
};

const reportViewOptions: Array<{ key: ReportView; label: string }> = [
  { key: "summary", label: "Summary" },
  { key: "products", label: "Products" },
  { key: "tables", label: "Tables" },
  { key: "orders", label: "Orders" },
];

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

function normalizeDateRange(startYmd: string, endYmd: string): { startYmd: string; endYmd: string } {
  if (startYmd <= endYmd) return { startYmd, endYmd };
  return { startYmd: endYmd, endYmd: startYmd };
}

function manilaRangeBoundaries(startYmd: string, endYmd: string): { startIso: string; endIso: string } {
  const normalized = normalizeDateRange(startYmd, endYmd);
  const range = getCustomRange(normalized.startYmd, normalized.endYmd);
  return { startIso: range.startIso, endIso: range.endIso };
}

function php(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function amountForCsv(value: number): string {
  return Number(value || 0).toFixed(2);
}

function resolvePaymentLabel(order: OrderRow): PaymentLabel {
  return resolvePaymentValueLabel(order.payment_method);
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function productKey(item: OrderItemRow): string {
  return `${item.item_id}::${item.item_name}`;
}

function matchesProductValue(itemId: string, itemName: string, selectedProduct: string): boolean {
  return selectedProduct === "all" || itemId === selectedProduct || `${itemId}::${itemName}` === selectedProduct;
}

function matchesProductRow(row: ProductSalesRow, selectedProduct: string): boolean {
  return matchesProductValue(row.item_id, row.item_name, selectedProduct);
}

function tableValue(order: OrderRow): string {
  const table = String(order.table_number ?? "").trim();
  if (table) return table;
  return order.channel === "web" ? "Web" : "Counter";
}

function displayTableValue(value: string): string {
  if (value === "Counter" || value === "Web") return value;
  return `Table ${value}`;
}

function formatCreated(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function filenamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

function matchesProduct(item: OrderItemRow, selectedProduct: string): boolean {
  return matchesProductValue(item.item_id, item.item_name, selectedProduct);
}

function getFilteredItems(order: OrderWithItems, selectedProduct: string): OrderItemRow[] {
  return (order.order_items ?? [])
    .map((item) => ({ ...item, order_id: order.id }))
    .filter((item) => matchesProduct(item, selectedProduct));
}

function orderHasProduct(order: OrderWithItems, selectedProduct: string): boolean {
  if (selectedProduct === "all") return true;
  return (order.order_items ?? []).some((item) => productKey(item) === selectedProduct);
}

function joinItems(order: OrderWithItems, selectedProduct: string): string {
  const items = getFilteredItems(order, selectedProduct);
  if (!items.length) return "";
  return items.map((item) => `${Number(item.quantity)} x ${item.item_name}`).join("; ");
}

function orderDiscountTotal(order: OrderRow): number {
  return toNumber(order.discount_amount) + toNumber(order.senior_pwd_discount);
}

export default function AdminDailyReport() {
  const { activeCashier } = useActiveCashier();
  const { settings } = useBusinessSettings();

  const [startDate, setStartDate] = useState(() => formatYmdInManila(new Date()));
  const [endDate, setEndDate] = useState(() => formatYmdInManila(new Date()));
  const [channel, setChannel] = useState<ChannelFilter>("counter");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("completed");
  const [productFilter, setProductFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [reportView, setReportView] = useState<ReportView>("summary");
  const [ordersWithItems, setOrdersWithItems] = useState<OrderWithItems[]>([]);
  const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
  const [productRowsRpc, setProductRowsRpc] = useState<ProductSalesRow[]>([]);
  const [tableRowsRpc, setTableRowsRpc] = useState<TableSalesRow[]>([]);
  const [orGaps, setOrGaps] = useState<OrGapRow[]>([]);
  const [paymentMixRpc, setPaymentMixRpc] = useState<PaymentMixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thermalMode, setThermalMode] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    const normalized = normalizeDateRange(startDate, endDate);
    const start = normalized.startYmd;
    const end = normalized.endYmd;

    const ordersPromise =
      reportView === "orders"
        ? (async () => {
            const { startIso, endIso } = manilaRangeBoundaries(startDate, endDate);

            let query = supabase
              .from("orders")
              .select("*, order_items(*)")
              .gte("created_at", startIso)
              .lt("created_at", endIso)
              .order("created_at", { ascending: true });

            if (channel === "counter") query = query.eq("channel", "counter");
            if (channel === "web") query = query.eq("channel", "web");

            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            return (data ?? []) as OrderWithItems[];
          })()
        : Promise.resolve([] as OrderWithItems[]);

    try {
      const [nextSummaryRows, nextProductRows, nextTableRows, nextOrGaps, nextPaymentMix, nextOrdersWithItems] =
        await Promise.all([
          fetchDailySummary({ start, end, channel, status: statusFilter }),
          fetchProductSales({ start, end, channel }),
          fetchTableSales({ start, end, channel }),
          fetchOrGaps({ start, end }),
          fetchPaymentMix({ start, end, channel }),
          ordersPromise,
        ]);

      setSummaryRows(nextSummaryRows);
      setProductRowsRpc(nextProductRows);
      setTableRowsRpc(nextTableRows);
      setOrGaps(nextOrGaps);
      setPaymentMixRpc(nextPaymentMix);
      setOrdersWithItems(nextOrdersWithItems);
      setGeneratedAt(new Date());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load report.");
      setOrdersWithItems([]);
      setSummaryRows([]);
      setProductRowsRpc([]);
      setTableRowsRpc([]);
      setOrGaps([]);
      setPaymentMixRpc([]);
    } finally {
      setLoading(false);
    }
  }, [channel, endDate, reportView, startDate, statusFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const normalizedDateRange = useMemo(
    () => normalizeDateRange(startDate, endDate),
    [endDate, startDate],
  );
  const reportDateLabel =
    normalizedDateRange.startYmd === normalizedDateRange.endYmd
      ? normalizedDateRange.startYmd
      : `${normalizedDateRange.startYmd} to ${normalizedDateRange.endYmd}`;
  const reportDateFilePart =
    normalizedDateRange.startYmd === normalizedDateRange.endYmd
      ? normalizedDateRange.startYmd
      : `${normalizedDateRange.startYmd}-to-${normalizedDateRange.endYmd}`;

  const productOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>();
    for (const order of ordersWithItems) {
      for (const item of order.order_items ?? []) {
        const key = productKey(item);
        if (!map.has(key)) map.set(key, { key, name: item.item_name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [ordersWithItems]);

  const tableOptions = useMemo(() => {
    const values = new Set<string>();
    for (const order of ordersWithItems) values.add(tableValue(order));
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [ordersWithItems]);

  const paymentOptions = useMemo(() => {
    const values = new Set<PaymentLabel>();
    for (const order of ordersWithItems) values.add(resolvePaymentLabel(order));
    return paymentOrder.filter((label) => values.has(label));
  }, [ordersWithItems]);

  const selectedProductName = useMemo(() => {
    if (productFilter === "all") return "All products";
    return productOptions.find((option) => option.key === productFilter)?.name ?? "Selected product";
  }, [productFilter, productOptions]);

  const filteredOrders = useMemo(() => {
    const query = normalizeText(searchTerm);

    return ordersWithItems.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (tableFilter !== "all" && tableValue(order) !== tableFilter) return false;
      if (paymentFilter !== "all" && resolvePaymentLabel(order) !== paymentFilter) return false;
      if (!orderHasProduct(order, productFilter)) return false;

      if (query) {
        const itemNames = (order.order_items ?? []).map((item) => item.item_name).join(" ");
        const haystack = normalizeText([
          order.order_number,
          order.or_number,
          order.customer_name,
          order.customer_phone,
          order.pickup_label,
          order.table_number,
          order.payment_method,
          itemNames,
        ].join(" "));
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [ordersWithItems, paymentFilter, productFilter, searchTerm, statusFilter, tableFilter]);

  const completedOrders = useMemo(
    () => filteredOrders.filter((order) => order.status === "completed"),
    [filteredOrders],
  );

  const filteredOrderItems = useMemo(
    () => completedOrders.flatMap((order) => getFilteredItems(order, productFilter)),
    [completedOrders, productFilter],
  );

  const grossSales = useMemo(
    () => completedOrders.reduce((sum, order) => sum + toNumber(order.total_amount), 0),
    [completedOrders],
  );
  const promoDiscount = useMemo(
    () =>
      completedOrders.reduce((sum, order) => {
        if (!order.promo_code) return sum;
        return sum + toNumber(order.discount_amount);
      }, 0),
    [completedOrders],
  );
  const seniorPwdDiscount = useMemo(
    () => completedOrders.reduce((sum, order) => sum + toNumber(order.senior_pwd_discount), 0),
    [completedOrders],
  );
  const netSales = useMemo(
    () => grossSales - promoDiscount - seniorPwdDiscount,
    [grossSales, promoDiscount, seniorPwdDiscount],
  );
  const productRevenue = useMemo(
    () => filteredOrderItems.reduce((sum, item) => sum + toNumber(item.line_total), 0),
    [filteredOrderItems],
  );

  const vatableSales = useMemo(
    () => completedOrders.reduce((sum, order) => sum + toNumber(order.vatable_sales), 0),
    [completedOrders],
  );
  const vatAmount = useMemo(
    () => completedOrders.reduce((sum, order) => sum + toNumber(order.vat_amount), 0),
    [completedOrders],
  );
  const vatExemptSales = useMemo(
    () => completedOrders.reduce((sum, order) => sum + toNumber(order.vat_exempt_sales), 0),
    [completedOrders],
  );

  const orRange = useMemo(() => {
    const withOr = completedOrders.filter((order) => !!order.or_number);
    if (!withOr.length) {
      return { first: null as string | null, last: null as string | null, count: 0 };
    }
    return {
      first: withOr[0].or_number ?? null,
      last: withOr[withOr.length - 1].or_number ?? null,
      count: withOr.length,
    };
  }, [completedOrders]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<PaymentLabel, { count: number; amount: number }>();
    for (const order of completedOrders) {
      const label = resolvePaymentLabel(order);
      const current = map.get(label) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += toNumber(order.total_amount);
      map.set(label, current);
    }

    return paymentOrder
      .filter((label) => map.has(label))
      .map((label) => ({ label, count: map.get(label)?.count ?? 0, amount: map.get(label)?.amount ?? 0 }));
  }, [completedOrders]);

  const statusBreakdown = useMemo(() => {
    const orderStatuses: OrderRow["status"][] = ["pending", "preparing", "ready", "completed", "cancelled"];
    const map = new Map<OrderRow["status"], { count: number; amount: number }>();
    for (const order of filteredOrders) {
      const current = map.get(order.status) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += toNumber(order.total_amount);
      map.set(order.status, current);
    }
    return orderStatuses
      .filter((status) => map.has(status))
      .map((status) => ({ status, count: map.get(status)?.count ?? 0, amount: map.get(status)?.amount ?? 0 }));
  }, [filteredOrders]);

  const productRows = useMemo(() => {
    const grouped = new Map<string, ItemSummaryRow & { orderIds: Set<string> }>();
    for (const order of completedOrders) {
      for (const item of getFilteredItems(order, productFilter)) {
        const key = productKey(item);
        const current = grouped.get(key) ?? {
          key,
          itemId: item.item_id,
          name: item.item_name,
          qty: 0,
          orderCount: 0,
          revenue: 0,
          orderIds: new Set<string>(),
        };
        current.qty += toNumber(item.quantity);
        current.revenue += toNumber(item.line_total);
        current.orderIds.add(order.id);
        grouped.set(key, current);
      }
    }

    return Array.from(grouped.values())
      .map((row) => ({
        key: row.key,
        itemId: row.itemId,
        name: row.name,
        qty: row.qty,
        orderCount: row.orderIds.size,
        revenue: row.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  }, [completedOrders, productFilter]);

  const topItems = useMemo(() => productRows.slice(0, 10), [productRows]);

  const tableRows = useMemo(() => {
    const grouped = new Map<string, TableSummaryRow & { orValues: Array<{ orNumber: string; createdAt: string }> }>();
    for (const order of completedOrders) {
      const key = tableValue(order);
      const current = grouped.get(key) ?? {
        tableNumber: key,
        orderCount: 0,
        itemCount: 0,
        revenue: 0,
        orFirst: null,
        orLast: null,
        cash: 0,
        gcash: 0,
        card: 0,
        online: 0,
        orValues: [],
      };
      const amount = toNumber(order.total_amount);
      current.orderCount += 1;
      current.itemCount += getFilteredItems(order, productFilter).reduce((sum, item) => sum + toNumber(item.quantity), 0);
      current.revenue += amount;
      if (order.or_number) current.orValues.push({ orNumber: order.or_number, createdAt: order.created_at });

      const payment = resolvePaymentLabel(order);
      if (payment === "Cash") current.cash += amount;
      if (payment === "GCash") current.gcash += amount;
      if (payment === "Bank Transfer BPI") current.card += amount;
      if (payment === "Online") current.online += amount;
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((row) => {
        const sortedOr = row.orValues.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return {
          tableNumber: row.tableNumber,
          orderCount: row.orderCount,
          itemCount: row.itemCount,
          revenue: row.revenue,
          orFirst: sortedOr[0]?.orNumber ?? null,
          orLast: sortedOr[sortedOr.length - 1]?.orNumber ?? null,
          cash: row.cash,
          gcash: row.gcash,
          card: row.card,
          online: row.online,
        };
      })
      .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
  }, [completedOrders, productFilter]);

  const activeFilterLabel = useMemo(() => {
    const labels = [channelLabels[channel]];
    labels.push(statusFilter === "all" ? "All status" : statusFilter);
    if (productFilter !== "all") labels.push(selectedProductName);
    if (tableFilter !== "all") labels.push(displayTableValue(tableFilter));
    if (paymentFilter !== "all") labels.push(paymentFilter);
    if (searchTerm.trim()) labels.push(`Search: ${searchTerm.trim()}`);
    return labels.join(" / ");
  }, [channel, paymentFilter, productFilter, searchTerm, selectedProductName, statusFilter, tableFilter]);

  const cancelledCount = useMemo(
    () => filteredOrders.filter((order) => order.status === "cancelled").length,
    [filteredOrders],
  );

  function clearFilters() {
    setStatusFilter("completed");
    setProductFilter("all");
    setTableFilter("all");
    setPaymentFilter("all");
    setSearchTerm("");
  }

  function handleExportCsv() {
    const filename = `saiko-daily-${reportDateFilePart}-${filenamePart(channel)}-${filenamePart(reportView)}.csv`;

    if (reportView === "summary") {
      const rows: CsvCell[][] = [
        ["Business", settings?.business_name ?? "SAIKO RAMEN & SUSHI"],
        ["Date Range", reportDateLabel],
        ["Generated", generatedAt?.toLocaleString("en-PH", { timeZone: "Asia/Manila" }) ?? ""],
        ["Cashier", activeCashier],
        ["Scope", activeFilterLabel],
        ["Loaded Orders", ordersWithItems.length],
        ["Filtered Orders", filteredOrders.length],
        ["Completed Orders", completedOrders.length],
        ["Cancelled Orders", cancelledCount],
        ["First OR", orRange.first ?? ""],
        ["Last OR", orRange.last ?? ""],
        ["OR Count", orRange.count],
        ["Gross Sales", amountForCsv(grossSales)],
        ["Promo Discounts", amountForCsv(promoDiscount)],
        ["Senior/PWD Discounts", amountForCsv(seniorPwdDiscount)],
        ["Net Sales", amountForCsv(netSales)],
        ["Product Revenue", amountForCsv(productRevenue)],
        ["VAT-able Sales", amountForCsv(vatableSales)],
        ["VAT", amountForCsv(vatAmount)],
        ["VAT-exempt Sales", amountForCsv(vatExemptSales)],
      ];
      for (const row of paymentBreakdown) rows.push([`Payment ${row.label}`, `${row.count} orders / ${amountForCsv(row.amount)}`]);
      for (const row of topItems) rows.push([`Top Product ${topItems.indexOf(row) + 1}`, `${row.name} / ${row.qty} qty / ${amountForCsv(row.revenue)}`]);
      exportRowsToCsv(["Metric", "Value"], rows, filename);
      return;
    }

    if (reportView === "products") {
      exportRowsToCsv(
        ["Product", "Item ID", "Qty Sold", "Completed Orders", "Revenue"],
        productRows.map((row) => [row.name, row.itemId, row.qty, row.orderCount, amountForCsv(row.revenue)]),
        filename,
      );
      return;
    }

    if (reportView === "tables") {
      exportRowsToCsv(
        ["Table", "Completed Orders", "Items", "Revenue", "First OR", "Last OR", "Cash", "GCash", "Bank Transfer BPI", "Online"],
        tableRows.map((row) => [
          displayTableValue(row.tableNumber),
          row.orderCount,
          row.itemCount,
          amountForCsv(row.revenue),
          row.orFirst ?? "",
          row.orLast ?? "",
          amountForCsv(row.cash),
          amountForCsv(row.gcash),
          amountForCsv(row.card),
          amountForCsv(row.online),
        ]),
        filename,
      );
      return;
    }

    exportRowsToCsv(
      [
        "Order Number",
        "OR Number",
        "Table",
        "Customer",
        "Phone",
        "Channel",
        "Payment",
        "Items",
        "Subtotal",
        "Discount",
        "VAT",
        "Total",
        "Status",
        "Created",
      ],
      filteredOrders.map((order) => [
        order.order_number,
        order.or_number ?? "",
        displayTableValue(tableValue(order)),
        order.customer_name,
        order.customer_phone,
        order.channel ?? "",
        resolvePaymentLabel(order),
        joinItems(order, productFilter),
        amountForCsv(toNumber(order.subtotal ?? order.total_amount)),
        amountForCsv(orderDiscountTotal(order)),
        amountForCsv(toNumber(order.vat_amount)),
        amountForCsv(toNumber(order.total_amount)),
        order.status,
        formatCreated(order.created_at),
      ]),
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
          <p className="text-sm text-[#705d48]">Z-reading summary for the selected date range, cashier, and accounting reconciliation.</p>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-4 print-hide">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_auto] gap-3 lg:items-end">
            <label className="text-xs font-semibold text-[#705d48]">
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="block mt-1 w-full border border-[#d8d2cb] rounded-md px-2 py-2 text-sm text-[#0d0f13]"
              />
            </label>
            <label className="text-xs font-semibold text-[#705d48]">
              End Date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="block mt-1 w-full border border-[#d8d2cb] rounded-md px-2 py-2 text-sm text-[#0d0f13]"
              />
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(["counter", "both", "web"] as ChannelFilter[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setChannel(option)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                      channel === option ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                    }`}
                  >
                    {channelLabels[option]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStatusFilter(option.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                      statusFilter === option.key ? "bg-[#c08643] text-[#0d0f13]" : "bg-[#ebe9e6] text-[#0d0f13]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={loadReport}
                className="px-4 py-2 rounded-md bg-[#ac312d] text-white text-sm font-semibold"
              >
                Generate
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
                disabled={loading || !!error}
                className="px-4 py-2 rounded-md border border-[#0d0f13] text-[#0d0f13] text-sm font-semibold disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className="text-xs font-semibold text-[#705d48]">
              Product
              <select
                value={productFilter}
                onChange={(event) => setProductFilter(event.target.value)}
                className="block mt-1 w-full border border-[#d8d2cb] rounded-md px-2 py-2 text-sm text-[#0d0f13]"
              >
                <option value="all">All products</option>
                {productFilter !== "all" && !productOptions.some((option) => option.key === productFilter) && (
                  <option value={productFilter}>Selected product</option>
                )}
                {productOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-[#705d48]">
              Table
              <select
                value={tableFilter}
                onChange={(event) => setTableFilter(event.target.value)}
                className="block mt-1 w-full border border-[#d8d2cb] rounded-md px-2 py-2 text-sm text-[#0d0f13]"
              >
                <option value="all">All tables</option>
                {tableOptions.map((option) => (
                  <option key={option} value={option}>
                    {displayTableValue(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-[#705d48]">
              Payment
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
                className="block mt-1 w-full border border-[#d8d2cb] rounded-md px-2 py-2 text-sm text-[#0d0f13]"
              >
                <option value="all">All payment</option>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-[#705d48] xl:col-span-2">
              Order Search
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Order, OR, table, customer, product"
                className="block mt-1 w-full border border-[#d8d2cb] rounded-md px-2 py-2 text-sm text-[#0d0f13]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {reportViewOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setReportView(option.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  reportView === option.key ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white border border-[#d8d2cb] text-[#0d0f13]"
            >
              Clear Filters
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="rounded-md bg-[#faf8f6] px-3 py-2">
              <p className="text-xs uppercase text-[#705d48]">Loaded</p>
              <p className="font-bold text-[#0d0f13]">{ordersWithItems.length}</p>
            </div>
            <div className="rounded-md bg-[#faf8f6] px-3 py-2">
              <p className="text-xs uppercase text-[#705d48]">Filtered</p>
              <p className="font-bold text-[#0d0f13]">{filteredOrders.length}</p>
            </div>
            <div className="rounded-md bg-[#faf8f6] px-3 py-2">
              <p className="text-xs uppercase text-[#705d48]">Completed</p>
              <p className="font-bold text-[#0d0f13]">{completedOrders.length}</p>
            </div>
            <div className="rounded-md bg-[#faf8f6] px-3 py-2">
              <p className="text-xs uppercase text-[#705d48]">Net Sales</p>
              <p className="font-bold text-[#0d0f13]">{php(netSales)}</p>
            </div>
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
              <p className="text-sm text-[#705d48]">Date Range: {reportDateLabel}</p>
              <p className="text-sm text-[#705d48]">
                Generated: {generatedAt?.toLocaleString("en-PH", { timeZone: "Asia/Manila" }) ?? "N/A"}
              </p>
              <p className="text-sm text-[#705d48]">Cashier: {activeCashier}</p>
              <p className="text-sm text-[#705d48]">Scope: {activeFilterLabel}</p>
            </header>

            {reportView === "summary" && (
              <>
                <section className="mt-5 space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">OR Range</h3>
                  {orRange.count === 0 ? (
                    <p className="text-sm text-[#705d48]">No completed orders in this scope.</p>
                  ) : (
                    <div className="text-sm text-[#0d0f13] space-y-1">
                      <p>First OR: {orRange.first}</p>
                      <p>Last OR: {orRange.last}</p>
                      <p>OR Count: {orRange.count}</p>
                    </div>
                  )}
                </section>

                {orGaps.length > 0 && (
                  <section className="mt-5 rounded-md bg-[#faf8f6] p-3 border-l-4 border-l-[#ac312d]">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d0f13]">
                      OR Gaps <span className="text-[#ac312d]">({orGaps.length})</span>
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-[#0d0f13]">
                      {orGaps.slice(0, 10).map((gap) => (
                        <li key={`${gap.prev_or}-${gap.or_number}-${gap.next_or}`}>
                          {gap.or_number} missing between {gap.prev_or} and {gap.next_or}
                        </li>
                      ))}
                      {orGaps.length > 10 && (
                        <li className="text-[#705d48]">and {orGaps.length - 10} more</li>
                      )}
                    </ul>
                  </section>
                )}

                <section className="mt-5 space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Sales Totals</h3>
                  <div className="flex justify-between text-sm">
                    <span>Gross Sales</span>
                    <span>{php(grossSales)}</span>
                  </div>
                  {productFilter !== "all" && (
                    <div className="flex justify-between text-sm">
                      <span>Product Revenue</span>
                      <span>{php(productRevenue)}</span>
                    </div>
                  )}
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
                    <span>Filtered</span>
                    <span>{filteredOrders.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Completed</span>
                    <span>{completedOrders.length}</span>
                  </div>
                  {cancelledCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Cancelled</span>
                      <span>{cancelledCount}</span>
                    </div>
                  )}
                  {statusBreakdown.map((row) => (
                    <div key={row.status} className="flex justify-between text-sm text-[#705d48]">
                      <span>{row.status}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                </section>

                <section className="mt-5 space-y-1.5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Top 10 Items</h3>
                  {topItems.length === 0 ? (
                    <p className="text-sm text-[#705d48]">No sold items for this scope.</p>
                  ) : (
                    <div className="space-y-1">
                      {topItems.map((item) => (
                        <div key={item.key} className="flex justify-between gap-3 text-sm">
                          <span>
                            {item.name} ({item.qty})
                          </span>
                          <span>{php(item.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {reportView === "products" && (
              <section className="mt-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Product Sales</h3>
                {productRows.length === 0 ? (
                  <p className="text-sm text-[#705d48]">No sold products in this scope.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[#705d48] border-b border-[#ebe9e6]">
                          <th className="py-2 pr-3">Product</th>
                          <th className="py-2 pr-3 text-right">Qty</th>
                          <th className="py-2 pr-3 text-right">Orders</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productRows.map((row) => (
                          <tr key={row.key} className="border-b border-[#f1ede9]">
                            <td className="py-2 pr-3 font-semibold text-[#0d0f13]">{row.name}</td>
                            <td className="py-2 pr-3 text-right">{row.qty}</td>
                            <td className="py-2 pr-3 text-right">{row.orderCount}</td>
                            <td className="py-2 text-right font-semibold">{php(row.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {reportView === "tables" && (
              <section className="mt-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Table Sales</h3>
                {tableRows.length === 0 ? (
                  <p className="text-sm text-[#705d48]">No completed table sales in this scope.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[#705d48] border-b border-[#ebe9e6]">
                          <th className="py-2 pr-3">Table</th>
                          <th className="py-2 pr-3 text-right">Orders</th>
                          <th className="py-2 pr-3 text-right">Items</th>
                          <th className="py-2 pr-3">OR Range</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => (
                          <tr key={row.tableNumber} className="border-b border-[#f1ede9]">
                            <td className="py-2 pr-3 font-semibold text-[#0d0f13]">{displayTableValue(row.tableNumber)}</td>
                            <td className="py-2 pr-3 text-right">{row.orderCount}</td>
                            <td className="py-2 pr-3 text-right">{row.itemCount}</td>
                            <td className="py-2 pr-3 text-xs text-[#705d48]">
                              {row.orFirst || row.orLast ? `${row.orFirst ?? ""} to ${row.orLast ?? ""}` : "N/A"}
                            </td>
                            <td className="py-2 text-right font-semibold">{php(row.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {reportView === "orders" && (
              <section className="mt-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Order Details</h3>
                {filteredOrders.length === 0 ? (
                  <p className="text-sm text-[#705d48]">No orders in this scope.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[#705d48] border-b border-[#ebe9e6]">
                          <th className="py-2 pr-3">Order</th>
                          <th className="py-2 pr-3">Table</th>
                          <th className="py-2 pr-3">Items</th>
                          <th className="py-2 pr-3">Payment</th>
                          <th className="py-2 pr-3 text-right">Discount</th>
                          <th className="py-2 pr-3 text-right">Total</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="border-b border-[#f1ede9] align-top">
                            <td className="py-2 pr-3">
                              <p className="font-semibold text-[#0d0f13]">{order.order_number}</p>
                              <p className="text-xs text-[#705d48]">OR: {order.or_number ?? "N/A"}</p>
                              <p className="text-xs text-[#705d48]">{formatCreated(order.created_at)}</p>
                            </td>
                            <td className="py-2 pr-3">{displayTableValue(tableValue(order))}</td>
                            <td className="py-2 pr-3 min-w-[220px] max-w-[360px]">{joinItems(order, productFilter) || "N/A"}</td>
                            <td className="py-2 pr-3">{resolvePaymentLabel(order)}</td>
                            <td className="py-2 pr-3 text-right">{php(orderDiscountTotal(order))}</td>
                            <td className="py-2 pr-3 text-right font-semibold">{php(toNumber(order.total_amount))}</td>
                            <td className="py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

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
