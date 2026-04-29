import { AdminLayout } from "@/components/AdminLayout";
import { exportOrdersToCsv } from "@/lib/csvExport";
import { type DateRange, type DateRangeKey, getCustomRange, getRange } from "@/lib/dateRanges";
import { supabase, type OrderItemRow, type OrderRow } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type StatusFilter = "all" | "pending" | "preparing" | "ready" | "completed" | "cancelled";
type BulkStatusAction = "preparing" | "ready" | "completed" | "cancelled";
type OrderWithItems = OrderRow & { order_items?: OrderItemRow[] };

const dateOptions: Array<{ key: Exclude<DateRangeKey, "custom">; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
];

const statusOptions: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const statusColors: Record<Exclude<StatusFilter, "all">, string> = {
  pending: "bg-[#705d48] text-white",
  preparing: "bg-[#e88627] text-[#0d0f13]",
  ready: "bg-[#c08643] text-[#0d0f13]",
  completed: "bg-[#0d0f13] text-white",
  cancelled: "bg-[#ac312d] text-white",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

function currentDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default function AdminOrders() {
  const [, navigate] = useLocation();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateKey, setDateKey] = useState<DateRangeKey>("today");
  const [range, setRange] = useState<DateRange>(getRange("today"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError(fetchError.message);
        setOrders([]);
      } else {
        setOrders((data ?? []) as OrderWithItems[]);
      }
      if (!silent) setLoading(false);
    },
    [range.startIso, range.endIso, statusFilter],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const visibleIds = new Set(orders.map((order) => order.id));
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [orders]);

  useEffect(() => {
    const onNewOrder = () => fetchOrders(true);
    window.addEventListener("saiko:new-order", onNewOrder);
    const interval = window.setInterval(() => fetchOrders(true), 15000);
    return () => {
      window.removeEventListener("saiko:new-order", onNewOrder);
      window.clearInterval(interval);
    };
  }, [fetchOrders]);

  const totals = useMemo(() => {
    const amount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const activeCount = orders.filter((order) => ["pending", "preparing", "ready"].includes(order.status)).length;
    return { count: orders.length, amount, activeCount };
  }, [orders]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = orders.length > 0 && orders.every((order) => selectedIds.has(order.id));

  function applyRange(nextKey: Exclude<DateRangeKey, "custom">) {
    setDateKey(nextKey);
    setRange(getRange(nextKey));
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    setDateKey("custom");
    setRange(getCustomRange(customStart, customEnd));
  }

  function handleExportCsv() {
    const filename = `saiko-orders-${dateKey}-${currentDateStamp()}.csv`;
    exportOrdersToCsv(
      orders.map((order) => ({ ...order, items: order.order_items ?? [] })),
      filename,
    );
  }

  function canTransition(current: OrderRow["status"], next: BulkStatusAction): boolean {
    if (current === next) return false;
    if (current === "cancelled" || current === "completed") return false;
    if (current === "pending") return next === "preparing" || next === "cancelled";
    if (current === "preparing") return next === "ready" || next === "cancelled";
    if (current === "ready") return next === "completed" || next === "cancelled";
    return false;
  }

  function toggleSelection(orderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(orders.map((order) => order.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function applyBulkStatus(nextStatus: BulkStatusAction) {
    if (!selectedCount || bulkRunning) return;

    const confirmed = window.confirm(`Apply "${nextStatus}" to ${selectedCount} selected orders?`);
    if (!confirmed) return;

    setBulkRunning(true);
    setBulkMessage(null);

    const selectedOrders = orders.filter((order) => selectedIds.has(order.id));
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const order of selectedOrders) {
      if (!canTransition(order.status, nextStatus)) {
        skipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", order.id);

      if (updateError) failed += 1;
      else updated += 1;
    }

    setSelectedIds(new Set());
    setBulkRunning(false);

    const parts: string[] = [];
    if (updated > 0) parts.push(`${updated} updated`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (failed > 0) parts.push(`${failed} failed`);
    setBulkMessage(parts.length ? `Bulk action finished: ${parts.join(", ")}.` : "No changes made.");

    await fetchOrders(true);
  }

  return (
    <AdminLayout>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0d0f13]">Orders</h1>
          <p className="text-sm text-[#705d48]">{range.label}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-[#705d48]">Orders</p>
              <p className="text-xl font-bold text-[#0d0f13] mt-1">{totals.count}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-[#705d48]">Gross Sales</p>
              <p className="text-xl font-bold text-[#0d0f13] mt-1">{currencyPhp(totals.amount)}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs uppercase tracking-wide text-[#705d48]">Active Status</p>
              <p className="text-xl font-bold text-[#0d0f13] mt-1">{totals.activeCount}</p>
            </div>
          </div>
          <div className="flex md:items-end">
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full md:w-auto px-4 py-3 rounded-md bg-[#0d0f13] text-white text-sm font-semibold"
            >
              Export CSV
            </button>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="sticky top-2 z-10 bg-[#0d0f13] text-white rounded-lg p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{selectedCount} selected</span>
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="px-2.5 py-1.5 rounded-md bg-white/10 text-xs font-semibold"
            >
              {allVisibleSelected ? "Unselect all visible" : "Select all visible"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-2.5 py-1.5 rounded-md bg-white/10 text-xs font-semibold"
            >
              Clear
            </button>
            {[
              { value: "preparing" as BulkStatusAction, label: "Mark Preparing" },
              { value: "ready" as BulkStatusAction, label: "Mark Ready" },
              { value: "completed" as BulkStatusAction, label: "Mark Completed" },
              { value: "cancelled" as BulkStatusAction, label: "Cancel" },
            ].map((action) => (
              <button
                key={action.value}
                type="button"
                onClick={() => applyBulkStatus(action.value)}
                disabled={bulkRunning}
                className="px-3 py-1.5 rounded-md bg-[#c08643] text-[#0d0f13] text-xs font-bold disabled:opacity-60"
              >
                {action.label}
              </button>
            ))}
            {bulkRunning && <span className="text-xs text-white/90">Applying...</span>}
          </div>
        )}

        {bulkMessage && (
          <div className="bg-white rounded-lg p-3 text-sm text-[#0d0f13] border border-[#d8d2cb]">{bulkMessage}</div>
        )}

        <div className="bg-white rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {dateOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => applyRange(option.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  dateKey === option.key ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDateKey("custom")}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                dateKey === "custom" ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
              }`}
            >
              Custom
            </button>
          </div>

          {dateKey === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
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

          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  statusFilter === option.key ? "bg-[#c08643] text-[#0d0f13]" : "bg-[#ebe9e6] text-[#0d0f13]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4">
          {loading && <p className="text-sm text-[#705d48]">Loading orders...</p>}
          {error && <p className="text-sm text-[#ac312d]">Failed to load: {error}</p>}
          {!loading && !error && orders.length === 0 && (
            <p className="text-sm text-[#705d48]">No orders for this range. Try a different filter.</p>
          )}

          {!loading && !error && orders.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#705d48] border-b border-[#ebe9e6]">
                      <th className="py-2 pr-2 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="Select all visible orders"
                        />
                      </th>
                      <th className="py-2">Order #</th>
                      <th className="py-2">Customer</th>
                      <th className="py-2">Phone</th>
                      <th className="py-2">Pickup</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="border-b border-[#f1ede9] cursor-pointer hover:bg-[#faf8f6]"
                      >
                        <td className="py-2 pr-2" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelection(order.id)}
                            aria-label={`Select order ${order.order_number}`}
                          />
                        </td>
                        <td className="py-2 font-semibold text-[#0d0f13]">{order.order_number}</td>
                        <td className="py-2">{order.customer_name}</td>
                        <td className="py-2">{order.customer_phone}</td>
                        <td className="py-2">{order.pickup_label}</td>
                        <td className="py-2">{currencyPhp(Number(order.total_amount))}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-[#705d48]">{formatDate(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    className="w-full text-left border border-[#ebe9e6] rounded-md p-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <label
                        className="inline-flex items-center gap-2 text-xs text-[#705d48]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelection(order.id)}
                          aria-label={`Select order ${order.order_number}`}
                        />
                        Select
                      </label>
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-1">
                      <p className="font-semibold text-[#0d0f13]">{order.order_number}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#0d0f13] mt-1">{order.customer_name}</p>
                    <p className="text-xs text-[#705d48]">{order.customer_phone}</p>
                    <p className="text-xs text-[#705d48] mt-1">Pickup: {order.pickup_label}</p>
                    <p className="text-sm font-semibold text-[#0d0f13] mt-1">{currencyPhp(Number(order.total_amount))}</p>
                    <p className="text-xs text-[#705d48] mt-1">{formatDate(order.created_at)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
