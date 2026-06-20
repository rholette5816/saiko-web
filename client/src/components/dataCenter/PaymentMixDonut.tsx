import { type PaymentMixRow } from "@/lib/dataCenter";
import { PAYMENT_LABEL_ORDER, type PaymentLabel } from "@/lib/paymentMethods";

interface PaymentMixDonutProps {
  rows: PaymentMixRow[];
  size?: number;
}

const colors: Record<PaymentLabel, string> = {
  Cash: "#0d0f13",
  GCash: "#c08643",
  "Bank Transfer BPI": "#e88627",
  Online: "#705d48",
};

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

export function PaymentMixDonut({ rows, size = 160 }: PaymentMixDonutProps) {
  const grouped = new Map<PaymentLabel, { count: number; amount: number }>();
  for (const row of rows) {
    const current = grouped.get(row.payment_label) ?? { count: 0, amount: 0 };
    current.count += Number(row.order_count || 0);
    current.amount += Number(row.total_amount || 0);
    grouped.set(row.payment_label, current);
  }

  const segments = PAYMENT_LABEL_ORDER.slice(0, 4)
    .map((label) => ({
      label,
      count: grouped.get(label)?.count ?? 0,
      amount: grouped.get(label)?.amount ?? 0,
      color: colors[label],
    }))
    .filter((row) => row.count > 0 || row.amount > 0);
  const totalOrders = segments.reduce((sum, row) => sum + row.count, 0);

  if (!segments.length || totalOrders === 0) {
    return (
      <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Payment Mix</h2>
        <p className="mt-3 text-sm text-[#705d48]">No completed orders.</p>
      </div>
    );
  }

  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Payment Mix</h2>
      <div className="mt-4 flex flex-col items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Payment mix">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ebe9e6" strokeWidth={strokeWidth} />
          {segments.map((segment) => {
            const dash = (segment.count / totalOrders) * circumference;
            const circle = (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += dash;
            return circle;
          })}
          <text x="50%" y="48%" textAnchor="middle" className="fill-[#0d0f13] text-3xl font-bold">
            {totalOrders}
          </text>
          <text x="50%" y="61%" textAnchor="middle" className="fill-[#705d48] text-xs font-bold uppercase tracking-wide">
            Orders
          </text>
        </svg>
      </div>
      <div className="mt-4 space-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex min-w-0 items-center gap-2 text-[#0d0f13]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 text-right text-[#705d48]">
              {segment.count} | {php(segment.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
