import { supabase } from "@/lib/supabase";

export interface BacklogLineItem {
  item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface BacklogPayload {
  business_date: string;
  payment_method: string;
  channel?: string;
  total_amount: number;
  subtotal?: number;
  vatable_sales?: number;
  vat_amount?: number;
  vat_exempt_sales?: number;
  senior_pwd_discount?: number;
  senior_pwd_name?: string;
  senior_pwd_id?: string;
  customer_name?: string;
  customer_phone?: string;
  table_number?: string;
  notes?: string;
  reason: string;
  items?: BacklogLineItem[];
}

export interface BacklogEntryRow {
  id: string;
  order_number: string;
  business_date: string;
  channel: string;
  payment_method: string;
  total_amount: number;
  item_count: number;
  backlogged_by: string | null;
  backlogged_at: string | null;
  backlog_reason: string | null;
  is_undoable: boolean;
}

type Raw = Record<string, unknown>;

function num(value: unknown): number {
  return Number(value ?? 0);
}

function text(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapEntry(raw: Raw): BacklogEntryRow {
  return {
    id: String(raw.id ?? ""),
    order_number: String(raw.order_number ?? ""),
    business_date: String(raw.business_date ?? ""),
    channel: String(raw.channel ?? "counter"),
    payment_method: String(raw.payment_method ?? "cash"),
    total_amount: num(raw.total_amount),
    item_count: num(raw.item_count),
    backlogged_by: text(raw.backlogged_by),
    backlogged_at: text(raw.backlogged_at),
    backlog_reason: text(raw.backlog_reason),
    is_undoable: Boolean(raw.is_undoable),
  };
}

export async function recordBacklogOrder(payload: BacklogPayload): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("record_backlog_order", { p_payload: payload });
  if (error) {
    console.error("[backlog] recordBacklogOrder:", error);
    return { id: null, error: error.message };
  }
  return { id: typeof data === "string" ? data : null, error: null };
}

export async function deleteBacklogOrder(id: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc("delete_backlog_order", { p_order_id: id });
  if (error) {
    console.error("[backlog] deleteBacklogOrder:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

export async function listRecentBacklog(limit = 20): Promise<BacklogEntryRow[]> {
  const { data, error } = await supabase.rpc("list_recent_backlog", { p_limit: limit });
  if (error) {
    console.error("[backlog] listRecentBacklog:", error);
    return [];
  }
  const rows = Array.isArray(data) ? (data as Raw[]) : [];
  return rows.map(mapEntry);
}
