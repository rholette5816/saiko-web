import { type ProductSalesRow } from "@/lib/dataCenter";

interface TopItemsListProps {
  rows: ProductSalesRow[];
  limit?: number;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

export function TopItemsList({ rows, limit = 10 }: TopItemsListProps) {
  const grouped = new Map<string, { id: string; name: string; qty: number; revenue: number }>();

  for (const row of rows) {
    const current = grouped.get(row.item_id) ?? { id: row.item_id, name: row.item_name, qty: 0, revenue: 0 };
    current.qty += Number(row.qty_sold || 0);
    current.revenue += Number(row.revenue || 0);
    grouped.set(row.item_id, current);
  }

  const topRows = Array.from(grouped.values())
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, limit);

  return (
    <div className="rounded-lg border border-[#ebe9e6] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Top Items</h2>
      {topRows.length === 0 ? (
        <p className="mt-3 text-sm text-[#705d48]">No sold items in this scope.</p>
      ) : (
        <div className="mt-3 divide-y divide-[#ebe9e6]">
          {topRows.map((row) => (
            <div key={row.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-[#0d0f13]">
                <span className="block truncate font-semibold">{row.name}</span>
                <span className="text-xs text-[#705d48]">{row.qty} sold</span>
              </span>
              <span className="shrink-0 font-bold text-[#0d0f13]">{php(row.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
