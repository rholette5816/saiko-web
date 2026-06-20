import { exportRowsToCsv, type CsvCell } from "@/lib/csvExport";
import {
  type DailySummaryRow,
  type ProductSalesRow,
  type TableSalesRow,
} from "@/lib/dataCenter";
import { resolvePaymentLabel, type PaymentLabel } from "@/lib/paymentMethods";
import { type OrderItemRow, type OrderRow } from "@/lib/supabase";
import { type DataCenterFilters } from "@/lib/dataCenterUrl";

export type ExportView = "summary" | "products" | "tables" | "orders";

interface ExportArgs {
  view: ExportView;
  filters: DataCenterFilters;
  summary: DailySummaryRow[];
  products: ProductSalesRow[];
  tables: TableSalesRow[];
  orders?: OrderRow[];
  businessName: string;
  generatedAt: Date;
  scopeLabel: string;
  cashierName: string;
}

type OrderWithItems = OrderRow & { order_items?: OrderItemRow[] };

interface ItemSummaryRow {
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

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function amountForCsv(value: number): string {
  return Number(value || 0).toFixed(2);
}

function filenamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}

function rangeFilePart(filters: DataCenterFilters): string {
  return filters.start === filters.end ? filters.start : `${filters.start}-to-${filters.end}`;
}

function formatCreated(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function displayTableValue(value: string): string {
  if (value === "Counter" || value === "Web") return value;
  return `Table ${value}`;
}

function tableValue(order: OrderRow): string {
  const table = String(order.table_number ?? "").trim();
  if (table) return table;
  return order.channel === "web" ? "Web" : "Counter";
}

function orderDiscountTotal(order: OrderRow): number {
  return toNumber(order.discount_amount) + toNumber(order.senior_pwd_discount);
}

function joinItems(order: OrderWithItems): string {
  const items = order.order_items ?? [];
  if (!items.length) return "";
  return items.map((item) => `${Number(item.quantity)} x ${item.item_name}`).join("; ");
}

function groupProducts(rows: ProductSalesRow[], status: DataCenterFilters["status"]): ItemSummaryRow[] {
  if (status === "cancelled") return [];
  const grouped = new Map<string, ItemSummaryRow>();

  for (const row of rows) {
    const current = grouped.get(row.item_id) ?? {
      itemId: row.item_id,
      name: row.item_name,
      qty: 0,
      orderCount: 0,
      revenue: 0,
    };
    current.qty += toNumber(row.qty_sold);
    current.orderCount += toNumber(row.order_count);
    current.revenue += toNumber(row.revenue);
    grouped.set(row.item_id, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}

function groupTables(rows: TableSalesRow[], status: DataCenterFilters["status"]): TableSummaryRow[] {
  if (status === "cancelled") return [];
  const grouped = new Map<string, TableSummaryRow>();

  for (const row of rows) {
    const current = grouped.get(row.table_label) ?? {
      tableNumber: row.table_label,
      orderCount: 0,
      itemCount: 0,
      revenue: 0,
      orFirst: null,
      orLast: null,
      cash: 0,
      gcash: 0,
      card: 0,
      online: 0,
    };
    current.orderCount += toNumber(row.order_count);
    current.itemCount += toNumber(row.item_count);
    current.revenue += toNumber(row.revenue);
    current.cash += toNumber(row.cash_total);
    current.gcash += toNumber(row.gcash_total);
    current.card += toNumber(row.card_total);
    current.online += toNumber(row.online_total);
    if (!current.orFirst && row.first_or) current.orFirst = row.first_or;
    if (row.last_or) current.orLast = row.last_or;
    grouped.set(row.table_label, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
}

function paymentCounts(orders: OrderWithItems[]): Map<PaymentLabel, number> {
  const counts = new Map<PaymentLabel, number>();
  for (const order of orders) {
    if (order.status !== "completed") continue;
    const label = resolvePaymentLabel(order.payment_method);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

export function exportCurrentView({
  view,
  filters,
  summary,
  products,
  tables,
  orders,
  businessName,
  generatedAt,
  scopeLabel,
  cashierName,
}: ExportArgs): void {
  const filename = `saiko-daily-${rangeFilePart(filters)}-${filenamePart(filters.channel)}-${filenamePart(view)}.csv`;
  const orderRows = ((orders ?? []) as OrderWithItems[]).filter((order) => {
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (filters.channel !== "both" && order.channel !== filters.channel) return false;
    return true;
  });
  const completedOrders = orderRows.filter((order) => order.status === "completed");
  const completedSummary = summary.filter((row) => row.status === "completed");
  const filteredOrderCount = summary.reduce((sum, row) => sum + toNumber(row.order_count), 0);
  const completedOrderCount = orders ? completedOrders.length : completedSummary.reduce((sum, row) => sum + toNumber(row.order_count), 0);
  const cancelledCount = orders
    ? orderRows.filter((order) => order.status === "cancelled").length
    : summary.filter((row) => row.status === "cancelled").reduce((sum, row) => sum + toNumber(row.order_count), 0);
  const productRows = groupProducts(products, filters.status);
  const tableRows = groupTables(tables, filters.status);

  if (view === "summary") {
    const grossSales = completedSummary.reduce((sum, row) => sum + toNumber(row.gross_sales), 0);
    const promoDiscount = completedSummary.reduce((sum, row) => sum + toNumber(row.promo_discount), 0);
    const seniorPwdDiscount = completedSummary.reduce((sum, row) => sum + toNumber(row.senior_pwd_discount), 0);
    const netSales = completedSummary.reduce((sum, row) => sum + toNumber(row.net_sales), 0);
    const productRevenue = productRows.reduce((sum, row) => sum + row.revenue, 0);
    const vatableSales = completedSummary.reduce((sum, row) => sum + toNumber(row.vatable_sales), 0);
    const vatAmount = completedSummary.reduce((sum, row) => sum + toNumber(row.vat_amount), 0);
    const vatExemptSales = completedSummary.reduce((sum, row) => sum + toNumber(row.vat_exempt_sales), 0);
    const firstOr = completedSummary.find((row) => row.first_or)?.first_or ?? "";
    const lastOr = [...completedSummary].reverse().find((row) => row.last_or)?.last_or ?? "";
    const counts = paymentCounts(orderRows);
    const paymentBreakdown = [
      { label: "Cash" as PaymentLabel, amount: completedSummary.reduce((sum, row) => sum + toNumber(row.cash_total), 0) },
      { label: "GCash" as PaymentLabel, amount: completedSummary.reduce((sum, row) => sum + toNumber(row.gcash_total), 0) },
      { label: "Bank Transfer BPI" as PaymentLabel, amount: completedSummary.reduce((sum, row) => sum + toNumber(row.card_total), 0) },
      { label: "Online" as PaymentLabel, amount: completedSummary.reduce((sum, row) => sum + toNumber(row.online_total), 0) },
    ].filter((row) => row.amount > 0);
    const topItems = productRows.slice(0, 10);
    const rows: CsvCell[][] = [
      ["Business", businessName],
      ["Date Range", filters.start === filters.end ? filters.start : `${filters.start} to ${filters.end}`],
      ["Generated", new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(generatedAt)],
      ["Cashier", cashierName],
      ["Scope", scopeLabel],
      ["Loaded Orders", orders ? orderRows.length : filteredOrderCount],
      ["Filtered Orders", filteredOrderCount],
      ["Completed Orders", completedOrderCount],
      ["Cancelled Orders", cancelledCount],
      ["First OR", firstOr],
      ["Last OR", lastOr],
      ["OR Count", completedOrderCount],
      ["Gross Sales", amountForCsv(grossSales)],
      ["Promo Discounts", amountForCsv(promoDiscount)],
      ["Senior/PWD Discounts", amountForCsv(seniorPwdDiscount)],
      ["Net Sales", amountForCsv(netSales)],
      ["Product Revenue", amountForCsv(productRevenue)],
      ["VAT-able Sales", amountForCsv(vatableSales)],
      ["VAT", amountForCsv(vatAmount)],
      ["VAT-exempt Sales", amountForCsv(vatExemptSales)],
    ];

    for (const row of paymentBreakdown) rows.push([`Payment ${row.label}`, `${counts.get(row.label) ?? 0} orders / ${amountForCsv(row.amount)}`]);
    for (const row of topItems) rows.push([`Top Product ${topItems.indexOf(row) + 1}`, `${row.name} / ${row.qty} qty / ${amountForCsv(row.revenue)}`]);
    exportRowsToCsv(["Metric", "Value"], rows, filename);
    return;
  }

  if (view === "products") {
    exportRowsToCsv(
      ["Product", "Item ID", "Qty Sold", "Completed Orders", "Revenue"],
      productRows.map((row) => [row.name, row.itemId, row.qty, row.orderCount, amountForCsv(row.revenue)]),
      filename,
    );
    return;
  }

  if (view === "tables") {
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
    orderRows.map((order) => [
      order.order_number,
      order.or_number ?? "",
      displayTableValue(tableValue(order)),
      order.customer_name,
      order.customer_phone,
      order.channel ?? "",
      resolvePaymentLabel(order.payment_method),
      joinItems(order),
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
