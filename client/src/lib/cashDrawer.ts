import { supabase } from "@/lib/supabase";

export type ClosingStatus = "draft" | "submitted" | "approved";

export interface CashClosingRow {
  id: string;
  business_date: string;
  channel: string;
  cashier_label: string | null;
  opening_float: number;
  expected_cash: number;
  counted_cash: number;
  cash_variance: number;
  expected_gcash: number;
  actual_gcash: number;
  gcash_variance: number;
  expected_card: number;
  actual_card: number;
  card_variance: number;
  payouts_total: number;
  notes: string | null;
  status: ClosingStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface PayoutRow {
  id: string;
  closing_id: string;
  label: string;
  amount: number;
  created_at: string;
}

type Raw = Record<string, unknown>;

function num(value: unknown): number {
  return Number(value ?? 0);
}

function text(value: unknown): string | null {
  return value == null ? null : String(value);
}

function asStatus(value: unknown): ClosingStatus {
  return value === "submitted" || value === "approved" ? value : "draft";
}

function mapClosing(row: Raw | null | undefined): CashClosingRow | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    business_date: String(row.business_date ?? ""),
    channel: String(row.channel ?? "counter"),
    cashier_label: text(row.cashier_label),
    opening_float: num(row.opening_float),
    expected_cash: num(row.expected_cash),
    counted_cash: num(row.counted_cash),
    cash_variance: num(row.cash_variance),
    expected_gcash: num(row.expected_gcash),
    actual_gcash: num(row.actual_gcash),
    gcash_variance: num(row.gcash_variance),
    expected_card: num(row.expected_card),
    actual_card: num(row.actual_card),
    card_variance: num(row.card_variance),
    payouts_total: num(row.payouts_total),
    notes: text(row.notes),
    status: asStatus(row.status),
    submitted_at: text(row.submitted_at),
    submitted_by: text(row.submitted_by),
    approved_at: text(row.approved_at),
    approved_by: text(row.approved_by),
  };
}

function mapPayout(row: Raw | null | undefined): PayoutRow | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    closing_id: String(row.closing_id ?? ""),
    label: String(row.label ?? ""),
    amount: num(row.amount),
    created_at: String(row.created_at ?? ""),
  };
}

export async function startShiftClose(businessDate: string, channel = "counter"): Promise<CashClosingRow | null> {
  const { data, error } = await supabase.rpc("start_shift_close", {
    p_business_date: businessDate,
    p_channel: channel,
  });
  if (error) {
    console.error("[cashDrawer] startShiftClose:", error);
    return null;
  }
  const raw = Array.isArray(data) ? (data[0] as Raw) : (data as Raw | null);
  return mapClosing(raw);
}

export async function submitShiftClose(input: {
  id: string;
  opening_float: number;
  counted_cash: number;
  actual_gcash: number;
  actual_card: number;
  payouts_total: number;
  notes: string;
}): Promise<CashClosingRow | null> {
  const { data, error } = await supabase.rpc("submit_shift_close", {
    p_id: input.id,
    p_opening_float: input.opening_float,
    p_counted_cash: input.counted_cash,
    p_actual_gcash: input.actual_gcash,
    p_actual_card: input.actual_card,
    p_payouts_total: input.payouts_total,
    p_notes: input.notes,
  });
  if (error) {
    console.error("[cashDrawer] submitShiftClose:", error);
    return null;
  }
  const raw = Array.isArray(data) ? (data[0] as Raw) : (data as Raw | null);
  return mapClosing(raw);
}

export async function approveShiftClose(id: string): Promise<CashClosingRow | null> {
  const { data, error } = await supabase.rpc("approve_shift_close", { p_id: id });
  if (error) {
    console.error("[cashDrawer] approveShiftClose:", error);
    return null;
  }
  const raw = Array.isArray(data) ? (data[0] as Raw) : (data as Raw | null);
  return mapClosing(raw);
}

export async function addPayout(closingId: string, label: string, amount: number): Promise<PayoutRow | null> {
  const { data, error } = await supabase.rpc("add_payout", {
    p_closing_id: closingId,
    p_label: label,
    p_amount: amount,
  });
  if (error) {
    console.error("[cashDrawer] addPayout:", error);
    return null;
  }
  const raw = Array.isArray(data) ? (data[0] as Raw) : (data as Raw | null);
  return mapPayout(raw);
}

export async function removePayout(payoutId: string): Promise<boolean> {
  const { error } = await supabase.rpc("remove_payout", { p_payout_id: payoutId });
  if (error) {
    console.error("[cashDrawer] removePayout:", error);
    return false;
  }
  return true;
}

export async function listRecentClosings(limit = 14): Promise<CashClosingRow[]> {
  const { data, error } = await supabase.rpc("list_recent_closings", { p_limit: limit });
  if (error) {
    console.error("[cashDrawer] listRecentClosings:", error);
    return [];
  }
  const rows = Array.isArray(data) ? (data as Raw[]) : [];
  return rows.map(mapClosing).filter((row): row is CashClosingRow => row !== null);
}

export async function listPayouts(closingId: string): Promise<PayoutRow[]> {
  const { data, error } = await supabase
    .from("cash_drawer_payouts")
    .select("*")
    .eq("closing_id", closingId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[cashDrawer] listPayouts:", error);
    return [];
  }
  const rows = Array.isArray(data) ? (data as Raw[]) : [];
  return rows.map(mapPayout).filter((row): row is PayoutRow => row !== null);
}
