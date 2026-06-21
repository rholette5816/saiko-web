import type { CashClosingRow } from "@/lib/cashDrawer";

interface ReconcileHistoryProps {
  rows: CashClosingRow[];
  onSelect?: (row: CashClosingRow) => void;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function totalVariance(row: CashClosingRow): number {
  return row.cash_variance + row.gcash_variance + row.card_variance;
}

function statusLabel(row: CashClosingRow): string {
  if (row.status === "approved") return "Approved";
  if (row.status === "submitted") return "Submitted";
  return "Draft";
}

function accentClass(row: CashClosingRow): string {
  const total = Math.abs(totalVariance(row));
  if (total > 100) return "border-l-4 border-l-[#ac312d]";
  if (total > 0.005) return "border-l-4 border-l-[#e88627]";
  return "";
}

function varianceClass(value: number): string {
  if (Math.abs(value) < 0.005) return "text-[#0d0f13]";
  if (value < 0) return "text-[#ac312d]";
  return "text-[#c08643]";
}

function statusPill(row: CashClosingRow): string {
  if (row.status === "approved") return "bg-[#0d0f13] text-white";
  if (row.status === "submitted") return "bg-[#e88627] text-[#0d0f13]";
  return "bg-[#c08643] text-[#0d0f13]";
}

export function ReconcileHistory({ rows, onSelect }: ReconcileHistoryProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#ebe9e6] bg-white p-5 text-sm text-[#705d48]">
        No drawer closings yet. Submit today to start the history.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ebe9e6] bg-white">
      <div className="border-b border-[#ebe9e6] px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Recent Closings</h3>
      </div>

      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ebe9e6] text-left text-[#705d48]">
              <th className="px-4 py-2 font-bold uppercase tracking-wide text-xs">Date</th>
              <th className="px-4 py-2 font-bold uppercase tracking-wide text-xs">Status</th>
              <th className="px-4 py-2 text-right font-bold uppercase tracking-wide text-xs">Cash</th>
              <th className="px-4 py-2 text-right font-bold uppercase tracking-wide text-xs">GCash</th>
              <th className="px-4 py-2 text-right font-bold uppercase tracking-wide text-xs">BPI</th>
              <th className="px-4 py-2 text-right font-bold uppercase tracking-wide text-xs">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = totalVariance(row);
              const interactive = typeof onSelect === "function";
              return (
                <tr
                  key={row.id}
                  className={`${accentClass(row)} border-b border-[#f5f3f0] ${interactive ? "cursor-pointer hover:bg-[#faf8f6]" : ""}`}
                  onClick={interactive ? () => onSelect?.(row) : undefined}
                >
                  <td className="px-4 py-3 text-[#0d0f13]">{row.business_date}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${statusPill(row)}`}>
                      {statusLabel(row)}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${varianceClass(row.cash_variance)}`}>{php(row.cash_variance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${varianceClass(row.gcash_variance)}`}>{php(row.gcash_variance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${varianceClass(row.card_variance)}`}>{php(row.card_variance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${varianceClass(total)}`}>{php(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden divide-y divide-[#f5f3f0]">
        {rows.map((row) => {
          const total = totalVariance(row);
          const interactive = typeof onSelect === "function";
          return (
            <li key={row.id} className={`${accentClass(row)} px-4 py-3 ${interactive ? "cursor-pointer" : ""}`} onClick={interactive ? () => onSelect?.(row) : undefined}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#0d0f13]">{row.business_date}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${statusPill(row)}`}>
                  {statusLabel(row)}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-[#705d48]">Cash</dt>
                <dd className={`text-right font-bold ${varianceClass(row.cash_variance)}`}>{php(row.cash_variance)}</dd>
                <dt className="text-[#705d48]">GCash</dt>
                <dd className={`text-right font-bold ${varianceClass(row.gcash_variance)}`}>{php(row.gcash_variance)}</dd>
                <dt className="text-[#705d48]">BPI</dt>
                <dd className={`text-right font-bold ${varianceClass(row.card_variance)}`}>{php(row.card_variance)}</dd>
                <dt className="text-[#705d48]">Total</dt>
                <dd className={`text-right font-bold ${varianceClass(total)}`}>{php(total)}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
