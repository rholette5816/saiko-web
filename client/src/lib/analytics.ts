import type { OrderItemRow, OrderRow } from "@/lib/supabase";

const STATUS_ORDER: Array<OrderRow["status"]> = ["pending", "preparing", "ready", "completed", "cancelled"];
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeKpis(orders: OrderRow[]) {
  const totalCount = orders.length;
  const cancelledCount = orders.filter((order) => order.status === "cancelled").length;
  const grossSales = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const completedSales = orders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  const cancellationRate = totalCount === 0 ? 0 : cancelledCount / totalCount;
  const denominator = totalCount - cancelledCount;
  const averageOrderValue = denominator <= 0 ? 0 : grossSales / denominator;

  return {
    totalCount,
    grossSales,
    completedSales,
    cancelledCount,
    cancellationRate,
    averageOrderValue,
  };
}

function getManilaYmd(date: Date): string {
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

function manilaYmdToUtcStart(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0));
}

function formatManilaDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function groupRevenueByDay(orders: OrderRow[], rangeStart: Date, rangeEnd: Date) {
  const firstYmd = getManilaYmd(rangeStart);
  const firstDayUtc = manilaYmdToUtcStart(firstYmd);
  const totals = new Map<string, number>();

  for (const order of orders) {
    if (order.status !== "completed") continue;
    const dayKey = getManilaYmd(new Date(order.created_at));
    totals.set(dayKey, (totals.get(dayKey) ?? 0) + Number(order.total_amount));
  }

  const rows: Array<{ day: string; revenue: number }> = [];
  for (let cursor = new Date(firstDayUtc); cursor < rangeEnd; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const ymd = getManilaYmd(cursor);
    rows.push({
      day: formatManilaDayLabel(cursor),
      revenue: Number((totals.get(ymd) ?? 0).toFixed(2)),
    });
  }
  return rows;
}

export function countByStatus(orders: OrderRow[]) {
  const counts = new Map<OrderRow["status"], number>();
  for (const order of orders) {
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  }
  return STATUS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export function computeItemPerformance(
  orderItems: OrderItemRow[],
  orderStatusById: Map<string, OrderRow["status"]>,
) {
  const grouped = new Map<string, { itemId: string; itemName: string; soldQty: number; revenue: number }>();

  for (const item of orderItems) {
    if (orderStatusById.get(item.order_id) !== "completed") continue;
    const key = `${item.item_id}::${item.item_name}`;
    const current = grouped.get(key) ?? {
      itemId: item.item_id,
      itemName: item.item_name,
      soldQty: 0,
      revenue: 0,
    };
    current.soldQty += Number(item.quantity);
    current.revenue += Number(item.line_total);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
}
