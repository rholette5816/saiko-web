import {
  type DiscrepancyRow,
  type FindingType,
  findingDescriptions,
  findingLabels,
} from "@/lib/discrepancies";
import { useMemo, useState } from "react";
import { Link } from "wouter";

interface DiscrepancyListProps {
  rows: DiscrepancyRow[];
}

const findingOrder: FindingType[] = [
  "missing_or",
  "vat_total_mismatch",
  "senior_pwd_missing_holder",
  "billed_not_settled",
];

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

export function DiscrepancyList({ rows }: DiscrepancyListProps) {
  const [filter, setFilter] = useState<"all" | FindingType>("all");

  const counts = useMemo(() => {
    const map = new Map<FindingType, number>();
    for (const row of rows) {
      map.set(row.finding_type, (map.get(row.finding_type) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.finding_type === filter);
  }, [filter, rows]);

  const grouped = useMemo(() => {
    const map = new Map<FindingType, DiscrepancyRow[]>();
    for (const row of visible) {
      const current = map.get(row.finding_type) ?? [];
      current.push(row);
      map.set(row.finding_type, current);
    }
    return findingOrder.filter((type) => map.has(type)).map((type) => ({ type, rows: map.get(type) ?? [] }));
  }, [visible]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#ebe9e6] bg-white p-5 text-sm text-[#705d48]">
        No discrepancies found in this range. Nice.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-bold ${
            filter === "all" ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
          }`}
        >
          All ({rows.length})
        </button>
        {findingOrder.map((type) => {
          const count = counts.get(type) ?? 0;
          if (count === 0) return null;
          const active = filter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-bold ${
                active ? "bg-[#ac312d] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
              }`}
              title={findingDescriptions[type]}
            >
              {findingLabels[type]} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {grouped.map((group) => (
          <section key={group.type} className="rounded-lg border border-[#ebe9e6] bg-white">
            <header className="border-b border-[#ebe9e6] px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d0f13]">
                {findingLabels[group.type]}{" "}
                <span className="text-[#ac312d]">({group.rows.length})</span>
              </h3>
              <p className="mt-1 text-xs text-[#705d48]">{findingDescriptions[group.type]}</p>
            </header>
            <ul className="divide-y divide-[#f5f3f0]">
              {group.rows.map((row) => (
                <li key={`${row.order_id}-${row.finding_type}`} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/admin/orders/${row.order_id}`}
                      className="text-sm font-bold text-[#0d0f13] underline"
                    >
                      {row.order_number}
                    </Link>
                    <span className="text-sm font-bold text-[#0d0f13]">{php(row.total_amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#705d48]">
                    {row.business_date}
                    {row.or_number ? ` / OR ${row.or_number}` : " / No OR"}
                  </p>
                  <p className="mt-1 text-xs text-[#705d48]">{row.details}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
