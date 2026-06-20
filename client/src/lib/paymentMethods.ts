export type PaymentMethod = "cash" | "gcash" | "bpi";
export type PaymentLabel = "Cash" | "GCash" | "Bank Transfer BPI" | "Online";

export const paymentMethodOptions: Array<{ value: PaymentMethod; label: string; shortLabel: string }> = [
  { value: "cash", label: "Cash", shortLabel: "CASH" },
  { value: "gcash", label: "GCash", shortLabel: "GCASH" },
  { value: "bpi", label: "Bank Transfer BPI", shortLabel: "BPI TRANSFER" },
];

export const PAYMENT_LABEL_ORDER: PaymentLabel[] = ["Cash", "GCash", "Bank Transfer BPI", "Online"];

function normalizePaymentValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isBpiPayment(value: unknown): boolean {
  const method = normalizePaymentValue(value);
  return method === "bpi" || method === "card" || method === "bank_transfer" || method === "bank_transfer_bpi";
}

export function resolvePaymentLabel(value: unknown): PaymentLabel {
  const method = normalizePaymentValue(value);
  if (method === "cash") return "Cash";
  if (method === "gcash") return "GCash";
  if (isBpiPayment(method)) return "Bank Transfer BPI";
  return "Online";
}

export function paymentMethodShortLabel(value: unknown): string {
  const label = resolvePaymentLabel(value);
  if (label === "Bank Transfer BPI") return "BPI TRANSFER";
  return label.toUpperCase();
}
