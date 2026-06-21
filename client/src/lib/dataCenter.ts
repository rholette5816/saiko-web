import { resolvePaymentLabel, type PaymentLabel } from "@/lib/paymentMethods";
import { type OrderRow, supabase } from "@/lib/supabase";

export interface DailySummaryRow {
  business_date: string;
  channel: string;
  status: OrderRow["status"];
  order_count: number;
  gross_sales: number;
  subtotal_total: number;
  promo_discount: number;
  senior_pwd_discount: number;
  net_sales: number;
  vatable_sales: number;
  vat_amount: number;
  vat_exempt_sales: number;
  cash_total: number;
  gcash_total: number;
  card_total: number;
  online_total: number;
  first_or: string | null;
  last_or: string | null;
}

export interface ProductSalesRow {
  business_date: string;
  channel: string;
  item_id: string;
  item_name: string;
  qty_sold: number;
  revenue: number;
  order_count: number;
}

export interface TableSalesRow {
  business_date: string;
  channel: string;
  table_label: string;
  order_count: number;
  item_count: number;
  revenue: number;
  cash_total: number;
  gcash_total: number;
  card_total: number;
  online_total: number;
  first_or: string | null;
  last_or: string | null;
}

export interface OrGapRow {
  or_number: string;
  prev_or: string;
  next_or: string;
}

export interface PaymentMixRow {
  payment_label: PaymentLabel;
  order_count: number;
  total_amount: number;
}

export interface HourlySalesRow {
  hour_of_day: number;
  order_count: number;
  net_sales: number;
}

export type ChannelFilter = "counter" | "web" | "both";

type RpcRow = Record<string, unknown>;

function channelParam(channel: ChannelFilter): string | null {
  return channel === "both" ? null : channel;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function toStringOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function rows(data: unknown): RpcRow[] {
  return Array.isArray(data) ? (data as RpcRow[]) : [];
}

function mapDailySummaryRow(row: RpcRow): DailySummaryRow {
  return {
    business_date: String(row.business_date),
    channel: String(row.channel),
    status: row.status as OrderRow["status"],
    order_count: toNumber(row.order_count),
    gross_sales: toNumber(row.gross_sales),
    subtotal_total: toNumber(row.subtotal_total),
    promo_discount: toNumber(row.promo_discount),
    senior_pwd_discount: toNumber(row.senior_pwd_discount),
    net_sales: toNumber(row.net_sales),
    vatable_sales: toNumber(row.vatable_sales),
    vat_amount: toNumber(row.vat_amount),
    vat_exempt_sales: toNumber(row.vat_exempt_sales),
    cash_total: toNumber(row.cash_total),
    gcash_total: toNumber(row.gcash_total),
    card_total: toNumber(row.card_total),
    online_total: toNumber(row.online_total),
    first_or: toStringOrNull(row.first_or),
    last_or: toStringOrNull(row.last_or),
  };
}

function mapProductSalesRow(row: RpcRow): ProductSalesRow {
  return {
    business_date: String(row.business_date),
    channel: String(row.channel),
    item_id: String(row.item_id),
    item_name: String(row.item_name),
    qty_sold: toNumber(row.qty_sold),
    revenue: toNumber(row.revenue),
    order_count: toNumber(row.order_count),
  };
}

function mapTableSalesRow(row: RpcRow): TableSalesRow {
  return {
    business_date: String(row.business_date),
    channel: String(row.channel),
    table_label: String(row.table_label),
    order_count: toNumber(row.order_count),
    item_count: toNumber(row.item_count),
    revenue: toNumber(row.revenue),
    cash_total: toNumber(row.cash_total),
    gcash_total: toNumber(row.gcash_total),
    card_total: toNumber(row.card_total),
    online_total: toNumber(row.online_total),
    first_or: toStringOrNull(row.first_or),
    last_or: toStringOrNull(row.last_or),
  };
}

function mapOrGapRow(row: RpcRow): OrGapRow {
  return {
    or_number: String(row.or_number),
    prev_or: String(row.prev_or),
    next_or: String(row.next_or),
  };
}

function mapPaymentMixRow(row: RpcRow): PaymentMixRow {
  return {
    payment_label: resolvePaymentLabel(row.payment_label),
    order_count: toNumber(row.order_count),
    total_amount: toNumber(row.total_amount),
  };
}

function mapHourlySalesRow(row: RpcRow): HourlySalesRow {
  return {
    hour_of_day: toNumber(row.hour_of_day),
    order_count: toNumber(row.order_count),
    net_sales: toNumber(row.net_sales),
  };
}

export async function fetchDailySummary(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
  status: "completed" | "cancelled" | "all";
}): Promise<DailySummaryRow[]> {
  const { data, error } = await supabase.rpc("get_daily_summary", {
    p_start: params.start,
    p_end: params.end,
    p_channel: channelParam(params.channel),
    p_status: params.status === "all" ? null : params.status,
  });

  if (error) {
    console.error("[dataCenter] fetchDailySummary:", error);
    return [];
  }

  return rows(data).map(mapDailySummaryRow);
}

export async function fetchProductSales(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<ProductSalesRow[]> {
  const { data, error } = await supabase.rpc("get_product_sales", {
    p_start: params.start,
    p_end: params.end,
    p_channel: channelParam(params.channel),
  });

  if (error) {
    console.error("[dataCenter] fetchProductSales:", error);
    return [];
  }

  return rows(data).map(mapProductSalesRow);
}

export async function fetchTableSales(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<TableSalesRow[]> {
  const { data, error } = await supabase.rpc("get_table_sales", {
    p_start: params.start,
    p_end: params.end,
    p_channel: channelParam(params.channel),
  });

  if (error) {
    console.error("[dataCenter] fetchTableSales:", error);
    return [];
  }

  return rows(data).map(mapTableSalesRow);
}

export async function fetchOrGaps(params: {
  start: string;
  end: string;
}): Promise<OrGapRow[]> {
  const { data, error } = await supabase.rpc("get_or_gaps", {
    p_start: params.start,
    p_end: params.end,
  });

  if (error) {
    console.error("[dataCenter] fetchOrGaps:", error);
    return [];
  }

  return rows(data).map(mapOrGapRow);
}

export async function fetchPaymentMix(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<PaymentMixRow[]> {
  const { data, error } = await supabase.rpc("get_payment_mix", {
    p_start: params.start,
    p_end: params.end,
    p_channel: channelParam(params.channel),
  });

  if (error) {
    console.error("[dataCenter] fetchPaymentMix:", error);
    return [];
  }

  return rows(data).map(mapPaymentMixRow);
}

export async function fetchHourlySales(params: {
  start: string;
  end: string;
  channel: ChannelFilter;
}): Promise<HourlySalesRow[]> {
  const { data, error } = await supabase.rpc("get_hourly_sales", {
    p_start: params.start,
    p_end: params.end,
    p_channel: channelParam(params.channel),
  });

  if (error) {
    console.error("[dataCenter] fetchHourlySales:", error);
    return [];
  }

  return rows(data).map(mapHourlySalesRow);
}
