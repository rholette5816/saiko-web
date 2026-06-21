import { type DailySummaryRow } from "@/lib/dataCenter";
import { shiftYmdManila } from "@/lib/manilaDate";

export interface SummaryTotals {
  orderCount: number;
  netSales: number;
  cancellations: number;
}

export function summarizeRows(rows: DailySummaryRow[]): SummaryTotals {
  return rows.reduce(
    (totals, row) => ({
      orderCount: totals.orderCount + Number(row.order_count || 0),
      netSales: totals.netSales + Number(row.net_sales || 0),
      cancellations: totals.cancellations + (row.status === "cancelled" ? Number(row.order_count || 0) : 0),
    }),
    { orderCount: 0, netSales: 0, cancellations: 0 },
  );
}

export function deltaPct(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export function avgTicket(totals: SummaryTotals): number {
  return totals.orderCount > 0 ? totals.netSales / totals.orderCount : 0;
}

export function buildTrend(
  rows: DailySummaryRow[],
  start: string,
  pick: (totals: SummaryTotals) => number,
): number[] {
  const byDate = new Map<string, DailySummaryRow[]>();
  for (const row of rows) {
    const current = byDate.get(row.business_date) ?? [];
    current.push(row);
    byDate.set(row.business_date, current);
  }

  return Array.from({ length: 14 }, (_unused, index) => {
    const date = shiftYmdManila(start, index);
    return pick(summarizeRows(byDate.get(date) ?? []));
  });
}

export function trendAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
