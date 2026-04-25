import { AdminLayout } from "@/components/AdminLayout";
import { Switch } from "@/components/ui/switch";
import { computeItemPerformance } from "@/lib/analytics";
import { type DateRange, type DateRangeKey, getCustomRange, getRange } from "@/lib/dateRanges";
import { menuData } from "@/lib/menuData";
import { supabase, type ItemOverrideRow, type OrderItemRow, type OrderRow } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type OverrideState = { is_available: boolean; is_best_seller: boolean };
type RangeOption = Exclude<DateRangeKey, "custom">;

const rangeOptions: Array<{ key: RangeOption; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
];

interface MenuRow {
  itemId: string;
  itemName: string;
  category: string;
  price: number;
}

interface OrderWithItems extends OrderRow {
  order_items?: OrderItemRow[];
}

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

export default function AdminProducts() {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("thisMonth");
  const [range, setRange] = useState<DateRange>(getRange("thisMonth"));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [overrides, setOverrides] = useState<Map<string, OverrideState>>(new Map());
  const [savingByItem, setSavingByItem] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuRows = useMemo<MenuRow[]>(
    () =>
      menuData.flatMap((category) =>
        category.items.map((item) => ({
          itemId: item.id,
          itemName: item.name,
          category: category.name,
          price: item.price,
        })),
      ),
    [],
  );

  useEffect(() => {
    let active = true;
    async function fetchData() {
      setLoading(true);
      setError(null);

      const ordersQuery = supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: false });

      const overridesQuery = supabase
        .from("item_overrides")
        .select("item_id, is_available, is_best_seller, updated_at");

      const [{ data: ordersData, error: ordersError }, { data: overridesData, error: overridesError }] =
        await Promise.all([ordersQuery, overridesQuery]);

      if (!active) return;
      if (ordersError || overridesError) {
        setError(ordersError?.message ?? overridesError?.message ?? "Failed to load products data");
        setOrders([]);
        setOverrides(new Map());
        setLoading(false);
        return;
      }

      const overrideMap = new Map<string, OverrideState>();
      for (const row of (overridesData ?? []) as ItemOverrideRow[]) {
        overrideMap.set(row.item_id, {
          is_available: row.is_available,
          is_best_seller: row.is_best_seller,
        });
      }

      setOrders((ordersData ?? []) as OrderWithItems[]);
      setOverrides(overrideMap);
      setLoading(false);
    }

    fetchData();
    return () => {
      active = false;
    };
  }, [range.startIso, range.endIso]);

  const itemPerformance = useMemo(() => {
    const statusMap = new Map<string, OrderRow["status"]>();
    const items: OrderItemRow[] = [];
    for (const order of orders) {
      statusMap.set(order.id, order.status);
      for (const item of order.order_items ?? []) {
        items.push(item);
      }
    }
    return computeItemPerformance(items, statusMap);
  }, [orders]);

  const perfMap = useMemo(
    () =>
      new Map(
        itemPerformance.map((row) => [
          row.itemId,
          { soldQty: row.soldQty, revenue: row.revenue, itemName: row.itemName },
        ]),
      ),
    [itemPerformance],
  );

  const topPerformers = itemPerformance.slice(0, 3);

  async function saveOverride(itemId: string, next: OverrideState) {
    const previous = overrides.get(itemId) ?? { is_available: true, is_best_seller: false };
    setOverrides((prev) => {
      const copy = new Map(prev);
      copy.set(itemId, next);
      return copy;
    });
    setSavingByItem((prev) => ({ ...prev, [itemId]: true }));
    setRowError((prev) => ({ ...prev, [itemId]: "" }));

    const { error: upsertError } = await supabase
      .from("item_overrides")
      .upsert(
        {
          item_id: itemId,
          is_available: next.is_available,
          is_best_seller: next.is_best_seller,
        },
        { onConflict: "item_id" },
      );

    if (upsertError) {
      setOverrides((prev) => {
        const copy = new Map(prev);
        copy.set(itemId, previous);
        return copy;
      });
      setRowError((prev) => ({ ...prev, [itemId]: upsertError.message }));
    }

    setSavingByItem((prev) => ({ ...prev, [itemId]: false }));
  }

  function changeRange(next: RangeOption) {
    setRangeKey(next);
    setRange(getRange(next));
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    setRangeKey("custom");
    setRange(getCustomRange(customStart, customEnd));
  }

  return (
    <AdminLayout>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0d0f13]">Products</h1>
          <p className="text-sm text-[#705d48]">Availability and best-seller controls.</p>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => changeRange(option.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  rangeKey === option.key ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRangeKey("custom")}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                rangeKey === "custom" ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
              }`}
            >
              Custom
            </button>
          </div>

          {rangeKey === "custom" && (
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-xs text-[#705d48]">
                Start
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="block mt-1 border border-[#d8d2cb] rounded-md px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-[#705d48]">
                End
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="block mt-1 border border-[#d8d2cb] rounded-md px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={applyCustomRange}
                className="px-3 py-2 rounded-md bg-[#c08643] text-[#0d0f13] text-sm font-semibold"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[#705d48] uppercase tracking-wide mb-3">Top Performers</h2>
          {loading ? (
            <p className="text-sm text-[#705d48]">Loading top performers...</p>
          ) : topPerformers.length === 0 ? (
            <p className="text-sm text-[#705d48]">No completed orders in this range yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topPerformers.map((row) => (
                <div key={row.itemId} className="rounded-md border border-[#ebe9e6] p-3">
                  <p className="font-semibold text-[#0d0f13] text-sm">{row.itemName}</p>
                  <p className="text-xs text-[#705d48] mt-1">{row.soldQty} sold</p>
                  <p className="text-sm font-bold text-[#ac312d] mt-1">{currencyPhp(row.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-4">
          {loading && <p className="text-sm text-[#705d48]">Loading products...</p>}
          {error && <p className="text-sm text-[#ac312d]">{error}</p>}
          {!loading && !error && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#705d48] border-b border-[#ebe9e6]">
                      <th className="py-2">Item</th>
                      <th className="py-2">Category</th>
                      <th className="py-2">Base Price</th>
                      <th className="py-2">Sold Qty</th>
                      <th className="py-2">Revenue</th>
                      <th className="py-2">Available</th>
                      <th className="py-2">Best Seller</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuRows.map((row) => {
                      const override = overrides.get(row.itemId) ?? { is_available: true, is_best_seller: false };
                      const perf = perfMap.get(row.itemId);
                      const saving = !!savingByItem[row.itemId];
                      return (
                        <tr key={row.itemId} className="border-b border-[#f1ede9]">
                          <td className="py-2 font-semibold text-[#0d0f13]">{row.itemName}</td>
                          <td className="py-2 text-[#705d48]">{row.category}</td>
                          <td className="py-2">{currencyPhp(row.price)}</td>
                          <td className="py-2">{perf?.soldQty ?? 0}</td>
                          <td className="py-2">{currencyPhp(perf?.revenue ?? 0)}</td>
                          <td className="py-2">
                            <Switch
                              checked={override.is_available}
                              onCheckedChange={(checked) =>
                                saveOverride(row.itemId, { ...override, is_available: checked })
                              }
                              disabled={saving}
                            />
                          </td>
                          <td className="py-2">
                            <Switch
                              checked={override.is_best_seller}
                              onCheckedChange={(checked) =>
                                saveOverride(row.itemId, { ...override, is_best_seller: checked })
                              }
                              disabled={saving}
                            />
                            {saving && <span className="ml-2 text-xs text-[#705d48]">Saving...</span>}
                            {rowError[row.itemId] && <p className="text-xs text-[#ac312d] mt-1">{rowError[row.itemId]}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {menuRows.map((row) => {
                  const override = overrides.get(row.itemId) ?? { is_available: true, is_best_seller: false };
                  const perf = perfMap.get(row.itemId);
                  const saving = !!savingByItem[row.itemId];
                  return (
                    <div key={row.itemId} className="border border-[#ebe9e6] rounded-md p-3">
                      <p className="font-semibold text-[#0d0f13]">{row.itemName}</p>
                      <p className="text-xs text-[#705d48] mt-1">{row.category}</p>
                      <p className="text-sm mt-2">{currencyPhp(row.price)}</p>
                      <p className="text-xs text-[#705d48] mt-1">
                        Sold: {perf?.soldQty ?? 0} · Revenue: {currencyPhp(perf?.revenue ?? 0)}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-[#0d0f13]">Available</span>
                        <Switch
                          checked={override.is_available}
                          onCheckedChange={(checked) => saveOverride(row.itemId, { ...override, is_available: checked })}
                          disabled={saving}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-[#0d0f13]">Best Seller</span>
                        <Switch
                          checked={override.is_best_seller}
                          onCheckedChange={(checked) =>
                            saveOverride(row.itemId, { ...override, is_best_seller: checked })
                          }
                          disabled={saving}
                        />
                      </div>
                      {saving && <p className="text-xs text-[#705d48] mt-2">Saving...</p>}
                      {rowError[row.itemId] && <p className="text-xs text-[#ac312d] mt-2">{rowError[row.itemId]}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
