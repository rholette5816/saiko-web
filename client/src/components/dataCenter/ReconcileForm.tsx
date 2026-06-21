import type { CashClosingRow, PayoutRow } from "@/lib/cashDrawer";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

export type ReconcileEditableField =
  | "opening_float"
  | "counted_cash"
  | "actual_gcash"
  | "actual_card"
  | "notes";

interface ReconcileFormProps {
  closing: CashClosingRow;
  payouts: PayoutRow[];
  busy: boolean;
  onChange: (field: ReconcileEditableField, value: number | string) => void;
  onSubmit: () => void;
  onApprove: () => void;
  onAddPayout: (label: string, amount: number) => void;
  onRemovePayout: (id: string) => void;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function varianceClass(value: number): string {
  if (Math.abs(value) < 0.005) return "text-[#0d0f13]";
  if (value < 0) return "text-[#ac312d]";
  return "text-[#c08643]";
}

function varianceLabel(value: number): string {
  if (Math.abs(value) < 0.005) return php(0);
  const sign = value > 0 ? "+" : "-";
  return `${sign}${php(Math.abs(value))}`;
}

function statusPill(status: CashClosingRow["status"]): { className: string; label: string } {
  if (status === "approved") return { className: "bg-[#0d0f13] text-white", label: "Approved" };
  if (status === "submitted") return { className: "bg-[#e88627] text-[#0d0f13]", label: "Submitted" };
  return { className: "bg-[#c08643] text-[#0d0f13]", label: "Draft" };
}

interface VarianceCardProps {
  label: string;
  expected: number;
  actual: number;
  variance: number;
  field: ReconcileEditableField;
  busy: boolean;
  disabled: boolean;
  onChange: ReconcileFormProps["onChange"];
}

function VarianceCard({ label, expected, actual, variance, field, busy, disabled, onChange }: VarianceCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#ebe9e6] bg-white p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#705d48]">{label}</h3>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#705d48]">Expected</p>
        <p className="text-base font-bold text-[#0d0f13]">{php(expected)}</p>
      </div>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#705d48]">Actual</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          disabled={busy || disabled}
          value={Number.isFinite(actual) ? actual : 0}
          onChange={(event) => onChange(field, Number(event.target.value))}
          className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-base text-[#0d0f13]"
        />
      </label>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#705d48]">Variance</p>
        <p className={`text-lg font-bold ${varianceClass(variance)}`}>{varianceLabel(variance)}</p>
      </div>
    </div>
  );
}

export function ReconcileForm({
  closing,
  payouts,
  busy,
  onChange,
  onSubmit,
  onApprove,
  onAddPayout,
  onRemovePayout,
}: ReconcileFormProps) {
  const pill = statusPill(closing.status);
  const isApproved = closing.status === "approved";
  const submitDisabled =
    busy ||
    isApproved ||
    (closing.counted_cash === 0 && closing.actual_gcash === 0 && closing.actual_card === 0);
  const approveDisabled = busy || closing.status !== "submitted";

  const [payoutLabel, setPayoutLabel] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");

  function handleAddPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(payoutAmount);
    if (!payoutLabel.trim() || !Number.isFinite(amount) || amount <= 0) return;
    onAddPayout(payoutLabel.trim(), amount);
    setPayoutLabel("");
    setPayoutAmount("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0d0f13]">Drawer Close</h2>
            <p className="text-sm text-[#705d48]">
              {closing.business_date} / {closing.channel}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${pill.className}`}>
            {pill.label}
          </span>
        </div>
        <div className="mt-3 hidden flex-wrap gap-2 md:flex">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="min-h-11 rounded-md bg-[#ac312d] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {closing.status === "submitted" ? "Update Submission" : "Submit Close"}
          </button>
          {closing.status === "submitted" && (
            <button
              type="button"
              onClick={onApprove}
              disabled={approveDisabled}
              className="min-h-11 rounded-md border border-[#0d0f13] px-4 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
            >
              Approve
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <VarianceCard
          label="Cash"
          expected={closing.expected_cash}
          actual={closing.counted_cash}
          variance={closing.cash_variance}
          field="counted_cash"
          busy={busy}
          disabled={isApproved}
          onChange={onChange}
        />
        <VarianceCard
          label="GCash"
          expected={closing.expected_gcash}
          actual={closing.actual_gcash}
          variance={closing.gcash_variance}
          field="actual_gcash"
          busy={busy}
          disabled={isApproved}
          onChange={onChange}
        />
        <VarianceCard
          label="Bank Transfer BPI"
          expected={closing.expected_card}
          actual={closing.actual_card}
          variance={closing.card_variance}
          field="actual_card"
          busy={busy}
          disabled={isApproved}
          onChange={onChange}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Opening Float</h3>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            disabled={busy || isApproved}
            value={Number.isFinite(closing.opening_float) ? closing.opening_float : 0}
            onChange={(event) => onChange("opening_float", Number(event.target.value))}
            className="mt-2 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-base text-[#0d0f13]"
          />
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-[#705d48]">Notes</h3>
          <textarea
            value={closing.notes ?? ""}
            disabled={busy || isApproved}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={4}
            className="mt-2 block w-full rounded-md border border-[#d8d2cb] p-3 text-sm text-[#0d0f13]"
            placeholder="Anything the manager should know"
          />
        </div>

        <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Payouts</h3>
            <span className="text-sm font-bold text-[#0d0f13]">{php(closing.payouts_total)}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {payouts.length === 0 && <li className="text-sm text-[#705d48]">No payouts logged.</li>}
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-2 rounded-md bg-[#faf8f6] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#0d0f13]">{payout.label}</p>
                  <p className="text-xs text-[#705d48]">{php(payout.amount)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemovePayout(payout.id)}
                  disabled={busy || isApproved}
                  aria-label={`Remove payout ${payout.label}`}
                  className="min-h-11 min-w-11 rounded-md text-[#ac312d] disabled:opacity-40"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {!isApproved && (
            <form onSubmit={handleAddPayout} className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <input
                type="text"
                value={payoutLabel}
                onChange={(event) => setPayoutLabel(event.target.value)}
                placeholder="Label"
                className="min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={payoutAmount}
                onChange={(event) => setPayoutAmount(event.target.value)}
                placeholder="Amount"
                className="min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
              />
              <button
                type="submit"
                disabled={busy || !payoutLabel.trim() || !Number(payoutAmount)}
                className="min-h-11 rounded-md bg-[#0d0f13] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="md:hidden">
        <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-30 flex flex-wrap gap-2 border-t border-[#ebe9e6] bg-white px-4 py-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="flex-1 min-h-11 rounded-md bg-[#ac312d] px-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {closing.status === "submitted" ? "Update" : "Submit"}
          </button>
          {closing.status === "submitted" && (
            <button
              type="button"
              onClick={onApprove}
              disabled={approveDisabled}
              className="flex-1 min-h-11 rounded-md border border-[#0d0f13] px-3 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
            >
              Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
