import { supabase } from "@/lib/supabase";

export type FindingType =
  | "missing_or"
  | "vat_total_mismatch"
  | "senior_pwd_missing_holder"
  | "billed_not_settled";

export interface DiscrepancyRow {
  business_date: string;
  order_id: string;
  order_number: string;
  or_number: string | null;
  total_amount: number;
  finding_type: FindingType;
  details: string;
}

export const findingLabels: Record<FindingType, string> = {
  missing_or: "Missing OR",
  vat_total_mismatch: "VAT Total Mismatch",
  senior_pwd_missing_holder: "Senior/PWD Holder Missing",
  billed_not_settled: "Billed Out Not Settled",
};

export const findingDescriptions: Record<FindingType, string> = {
  missing_or: "Completed orders without an OR number assigned.",
  vat_total_mismatch: "VATable plus VAT exempt plus senior/PWD discount does not match the order total.",
  senior_pwd_missing_holder: "Senior/PWD discount applied without a holder name or ID on file.",
  billed_not_settled: "Order ticket printed but the bill has not been settled after 24 hours.",
};

function asFindingType(value: unknown): FindingType {
  if (
    value === "missing_or" ||
    value === "vat_total_mismatch" ||
    value === "senior_pwd_missing_holder" ||
    value === "billed_not_settled"
  ) {
    return value;
  }
  return "missing_or";
}

type Raw = Record<string, unknown>;

function num(value: unknown): number {
  return Number(value ?? 0);
}

function text(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapRow(raw: Raw): DiscrepancyRow {
  return {
    business_date: String(raw.business_date ?? ""),
    order_id: String(raw.order_id ?? ""),
    order_number: String(raw.order_number ?? ""),
    or_number: text(raw.or_number),
    total_amount: num(raw.total_amount),
    finding_type: asFindingType(raw.finding_type),
    details: String(raw.details ?? ""),
  };
}

export async function fetchDiscrepancies(params: {
  start: string;
  end: string;
  type?: FindingType;
}): Promise<DiscrepancyRow[]> {
  const { data, error } = await supabase.rpc("get_discrepancies", {
    p_start: params.start,
    p_end: params.end,
    p_type: params.type ?? null,
  });
  if (error) {
    console.error("[discrepancies] fetchDiscrepancies:", error);
    return [];
  }
  const rows = Array.isArray(data) ? (data as Raw[]) : [];
  return rows.map(mapRow);
}
