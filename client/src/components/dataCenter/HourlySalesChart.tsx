import { type HourlySalesRow } from "@/lib/dataCenter";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface HourlySalesChartProps {
  rows: HourlySalesRow[];
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export function HourlySalesChart({ rows }: HourlySalesChartProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Hourly Sales</h2>
        <p className="mt-3 text-sm text-[#705d48]">No sales data for this range yet.</p>
      </div>
    );
  }

  const byHour = new Map(rows.map((row) => [Number(row.hour_of_day), row]));
  const chartRows = Array.from({ length: 24 }, (_unused, hour) => {
    const row = byHour.get(hour);
    return {
      hour,
      label: formatHour(hour),
      order_count: Number(row?.order_count || 0),
      net_sales: Number(row?.net_sales || 0),
    };
  });

  return (
    <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Hourly Sales</h2>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `PHP ${value}`} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === "net_sales" ? php(value) : value,
                name === "net_sales" ? "Net sales" : "Orders",
              ]}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as { hour?: number } | undefined;
                return typeof row?.hour === "number" ? formatHour(row.hour) : "Hour";
              }}
            />
            <Bar dataKey="net_sales" fill="#ac312d" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
