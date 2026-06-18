import { AdminLayout } from "@/components/AdminLayout";
import { Switch } from "@/components/ui/switch";
import { computeItemPerformance } from "@/lib/analytics";
import { type DateRange, type DateRangeKey, getCustomRange, getRange } from "@/lib/dateRanges";
import type { MenuBadge } from "@/lib/menuItems";
import { supabase, type OrderItemRow, type OrderRow } from "@/lib/supabase";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProductForm, { type ProductFormItem } from "./ProductForm";

type RangeOption = Exclude<DateRangeKey, "custom">;
type ToggleState = { is_available: boolean; is_best_seller: boolean };

const rangeOptions: Array<{ key: RangeOption; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
];

interface MenuCategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  price: number | string;
  description: string | null;
  image: string | null;
  badge: MenuBadge | null;
  sort_order: number;
  is_available: boolean;
  is_best_seller: boolean;
}

interface MenuRow {
  itemId: string;
  itemName: string;
  categoryId: string;
  category: string;
  price: number;
  description: string | null;
  image: string | null;
  badge: MenuBadge | null;
  sortOrder: number;
  categorySortOrder: number;
  is_available: boolean;
  is_best_seller: boolean;
}

interface OrderWithItems extends OrderRow {
  order_items?: OrderItemRow[];
}

interface FormState {
  mode: "create" | "edit";
  item?: ProductFormItem;
}

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

function toFormItem(row: MenuRow): ProductFormItem {
  return {
    id: row.itemId,
    name: row.itemName,
    price: row.price,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    imageValue: row.image,
    badge: row.badge ?? undefined,
    categoryId: row.categoryId,
    is_available: row.is_available,
    sort_order: row.sortOrder,
  };
}

export default function AdminProducts() {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("thisMonth");
  const [range, setRange] = useState<DateRange>(getRange("thisMonth"));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [menuRows, setMenuRows] = useState<MenuRow[]>([]);
  const [savingByItem, setSavingByItem] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);

  async function fetchData(shouldApply: () => boolean = () => true) {
    setLoading(true);
    setError(null);

    const ordersQuery = supabase
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso)
      .order("created_at", { ascending: false });

    const categoriesQuery = supabase
      .from("menu_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });

    const itemsQuery = supabase
      .from("menu_items")
      .select("id, category_id, name, price, description, image, badge, sort_order, is_available, is_best_seller")
      .order("sort_order", { ascending: true });

    const [
      { data: ordersData, error: ordersError },
      { data: categoriesData, error: categoriesError },
      { data: itemsData, error: itemsError },
    ] = await Promise.all([ordersQuery, categoriesQuery, itemsQuery]);

    if (!shouldApply()) return;
    if (ordersError || categoriesError || itemsError) {
      setError(ordersError?.message ?? categoriesError?.message ?? itemsError?.message ?? "Failed to load products data");
      setOrders([]);
      setMenuRows([]);
      setLoading(false);
      return;
    }

    const categoryMap = new Map<string, MenuCategoryRow>();
    for (const category of (categoriesData ?? []) as MenuCategoryRow[]) {
      categoryMap.set(category.id, category);
    }

    const nextRows = ((itemsData ?? []) as MenuItemRow[])
      .map((item) => {
        const category = categoryMap.get(item.category_id);
        return {
          itemId: item.id,
          itemName: item.name,
          categoryId: item.category_id,
          category: category?.name ?? item.category_id,
          price: Number(item.price),
          description: item.description,
          image: item.image,
          badge: item.badge,
          sortOrder: item.sort_order,
          categorySortOrder: category?.sort_order ?? 999,
          is_available: item.is_available,
          is_best_seller: item.is_best_seller,
        };
      })
      .sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.sortOrder - b.sortOrder || a.itemName.localeCompare(b.itemName));

    setOrders((ordersData ?? []) as OrderWithItems[]);
    setMenuRows(nextRows);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void fetchData(() => active);
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

  async function saveMenuItemState(itemId: string, next: ToggleState) {
    const previous = menuRows.find((row) => row.itemId === itemId);
    setMenuRows((current) =>
      current.map((row) =>
        row.itemId === itemId
          ? { ...row, is_available: next.is_available, is_best_seller: next.is_best_seller }
          : row,
      ),
    );
    setSavingByItem((prev) => ({ ...prev, [itemId]: true }));
    setRowError((prev) => ({ ...prev, [itemId]: "" }));

    const { error: updateError } = await supabase
      .from("menu_items")
      .update({
        is_available: next.is_available,
        is_best_seller: next.is_best_seller,
      })
      .eq("id", itemId);

    if (updateError) {
      if (previous) {
        setMenuRows((current) => current.map((row) => (row.itemId === itemId ? previous : row)));
      }
      setRowError((prev) => ({ ...prev, [itemId]: updateError.message }));
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

  function handleSaved() {
    setFormState(null);
    void fetchData();
  }

  return (
    <AdminLayout>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0d0f13]">Products</h1>
            <p className="text-sm text-[#705d48]">Manage live menu items, availability, and best-seller controls.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormState({ mode: "create" })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ac312d] px-4 text-sm font-bold uppercase tracking-wide text-white"
          >
            <Plus size={16} />
            New Item
          </button>
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
                      <th className="py-2">Price</th>
                      <th className="py-2">Sold Qty</th>
                      <th className="py-2">Revenue</th>
                      <th className="py-2">Available</th>
                      <th className="py-2">Best Seller</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuRows.map((row) => {
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
                              checked={row.is_available}
                              onCheckedChange={(checked) =>
                                saveMenuItemState(row.itemId, { is_available: checked, is_best_seller: row.is_best_seller })
                              }
                              disabled={saving}
                            />
                          </td>
                          <td className="py-2">
                            <Switch
                              checked={row.is_best_seller}
                              onCheckedChange={(checked) =>
                                saveMenuItemState(row.itemId, { is_available: row.is_available, is_best_seller: checked })
                              }
                              disabled={saving}
                            />
                            {saving && <span className="ml-2 text-xs text-[#705d48]">Saving...</span>}
                            {rowError[row.itemId] && <p className="text-xs text-[#ac312d] mt-1">{rowError[row.itemId]}</p>}
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => setFormState({ mode: "edit", item: toFormItem(row) })}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d8d2cb] px-3 text-xs font-semibold text-[#0d0f13]"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {menuRows.map((row) => {
                  const perf = perfMap.get(row.itemId);
                  const saving = !!savingByItem[row.itemId];
                  return (
                    <div key={row.itemId} className="border border-[#ebe9e6] rounded-md p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#0d0f13]">{row.itemName}</p>
                          <p className="text-xs text-[#705d48] mt-1">{row.category}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormState({ mode: "edit", item: toFormItem(row) })}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                          title={`Edit ${row.itemName}`}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                      <p className="text-sm mt-2">{currencyPhp(row.price)}</p>
                      <p className="text-xs text-[#705d48] mt-1">
                        Sold: {perf?.soldQty ?? 0} · Revenue: {currencyPhp(perf?.revenue ?? 0)}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-[#0d0f13]">Available</span>
                        <Switch
                          checked={row.is_available}
                          onCheckedChange={(checked) =>
                            saveMenuItemState(row.itemId, { is_available: checked, is_best_seller: row.is_best_seller })
                          }
                          disabled={saving}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-[#0d0f13]">Best Seller</span>
                        <Switch
                          checked={row.is_best_seller}
                          onCheckedChange={(checked) =>
                            saveMenuItemState(row.itemId, { is_available: row.is_available, is_best_seller: checked })
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

        {formState && (
          <ProductForm
            mode={formState.mode}
            initialItem={formState.item}
            onSaved={handleSaved}
            onCancel={() => setFormState(null)}
          />
        )}
      </section>
    </AdminLayout>
  );
}
