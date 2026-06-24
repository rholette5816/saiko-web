import { AdminLayout } from "@/components/AdminLayout";
import {
  deleteBacklogOrder,
  listRecentBacklog,
  recordBacklogOrder,
  type BacklogEntryRow,
  type BacklogLineItem,
} from "@/lib/backlog";
import { fetchMenuCategories, type MenuCategory, type MenuItem } from "@/lib/menuItems";
import { paymentMethodOptions, type PaymentMethod } from "@/lib/paymentMethods";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type BacklogMode = "quick" | "itemized";

interface ItemizedRow {
  key: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function todayYmdManila(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shiftYmdDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatRelative(value: string | null): string {
  if (!value) return "N/A";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

export default function AdminBacklog() {
  const today = useMemo(todayYmdManila, []);
  const minDate = useMemo(() => shiftYmdDays(today, -30), [today]);

  const [mode, setMode] = useState<BacklogMode>("quick");
  const [businessDate, setBusinessDate] = useState(() => shiftYmdDays(today, -1));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [quickTotal, setQuickTotal] = useState("");

  const [items, setItems] = useState<ItemizedRow[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [recent, setRecent] = useState<BacklogEntryRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmPayload, setConfirmPayload] = useState<{ summary: string; submit: () => Promise<void> } | null>(null);

  const refreshRecent = useCallback(async () => {
    setRecentLoading(true);
    const rows = await listRecentBacklog(20);
    setRecent(rows);
    setRecentLoading(false);
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (mode !== "itemized") return;
    if (menuCategories.length > 0) return;
    setMenuLoading(true);
    setMenuError(null);
    fetchMenuCategories("admin")
      .then((categories) => setMenuCategories(categories))
      .catch((error) => setMenuError(error instanceof Error ? error.message : "Unable to load menu"))
      .finally(() => setMenuLoading(false));
  }, [mode, menuCategories.length]);

  const itemizedSubtotal = useMemo(
    () => items.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0),
    [items],
  );

  const allMenuItems = useMemo(() => {
    const list: { id: string; label: string; price: number }[] = [];
    for (const category of menuCategories) {
      for (const item of category.items) {
        list.push({ id: item.id, label: `${category.name} / ${item.name}`, price: item.price });
      }
    }
    return list;
  }, [menuCategories]);

  function resetForms() {
    setQuickTotal("");
    setItems([]);
    setReason("");
    setNotes("");
  }

  function addItemRow(menuItem?: MenuItem) {
    setItems((current) => [
      ...current,
      {
        key: newKey(),
        itemId: menuItem?.id ?? "backlog",
        itemName: menuItem?.name ?? "",
        unitPrice: menuItem?.price ?? 0,
        quantity: 1,
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<ItemizedRow>) {
    setItems((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function selectItemFromMenu(key: string, menuId: string) {
    const menuItem = allMenuItems.find((entry) => entry.id === menuId);
    if (!menuItem) return;
    updateItem(key, { itemId: menuItem.id, itemName: menuItem.label.split(" / ").pop() ?? menuItem.label, unitPrice: menuItem.price });
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((row) => row.key !== key));
  }

  function showStatus(kind: "ok" | "error", text: string) {
    setStatusMessage({ kind, text });
  }

  async function submitQuick() {
    const total = Number(quickTotal);
    if (!Number.isFinite(total) || total <= 0) {
      showStatus("error", "Enter a total greater than 0.");
      return;
    }
    if (!reason.trim()) {
      showStatus("error", "Reason is required.");
      return;
    }

    const submit = async () => {
      setBusy(true);
      const result = await recordBacklogOrder({
        business_date: businessDate,
        payment_method: paymentMethod,
        total_amount: total,
        subtotal: total,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      setBusy(false);
      if (result.error) {
        showStatus("error", result.error);
        return;
      }
      showStatus("ok", `Recorded ${php(total)} for ${businessDate}.`);
      resetForms();
      void refreshRecent();
    };

    setConfirmPayload({
      summary: `Recording ${php(total)} as ${paymentMethod.toUpperCase()} on ${businessDate}.`,
      submit,
    });
  }

  async function submitItemized() {
    if (items.length === 0) {
      showStatus("error", "Add at least one line item.");
      return;
    }
    if (items.some((row) => !row.itemName.trim() || row.quantity <= 0 || row.unitPrice < 0)) {
      showStatus("error", "Every item needs a name, qty > 0 and unit price >= 0.");
      return;
    }
    if (!reason.trim()) {
      showStatus("error", "Reason is required.");
      return;
    }

    const lineItems: BacklogLineItem[] = items.map((row) => ({
      item_id: row.itemId || "backlog",
      item_name: row.itemName.trim(),
      unit_price: Number(row.unitPrice) || 0,
      quantity: Number(row.quantity) || 0,
      line_total: (Number(row.unitPrice) || 0) * (Number(row.quantity) || 0),
    }));
    const total = lineItems.reduce((sum, row) => sum + row.line_total, 0);

    const submit = async () => {
      setBusy(true);
      const result = await recordBacklogOrder({
        business_date: businessDate,
        payment_method: paymentMethod,
        total_amount: total,
        subtotal: total,
        items: lineItems,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      setBusy(false);
      if (result.error) {
        showStatus("error", result.error);
        return;
      }
      showStatus("ok", `Recorded ${lineItems.length} item(s), ${php(total)} on ${businessDate}.`);
      resetForms();
      void refreshRecent();
    };

    setConfirmPayload({
      summary: `Recording ${lineItems.length} item(s), ${php(total)} as ${paymentMethod.toUpperCase()} on ${businessDate}.`,
      submit,
    });
  }

  async function handleUndo(row: BacklogEntryRow) {
    if (!row.is_undoable) return;
    const confirmed = window.confirm(`Undo backlog ${row.order_number} (${php(row.total_amount)})? This permanently removes the entry.`);
    if (!confirmed) return;
    setBusy(true);
    const result = await deleteBacklogOrder(row.id);
    setBusy(false);
    if (result.error) {
      showStatus("error", result.error);
      return;
    }
    showStatus("ok", `Removed backlog ${row.order_number}.`);
    void refreshRecent();
  }

  return (
    <AdminLayout>
      <section className="space-y-4 pb-10">
        <header>
          <h1 className="text-2xl font-bold text-[#0d0f13]">Backlog</h1>
          <p className="text-sm text-[#705d48]">Backfill orders that happened before they were captured. Internal only.</p>
        </header>

        <aside className="rounded-lg border border-l-4 border-[#ebe9e6] border-l-[#e88627] bg-[#faf8f6] p-4 text-sm text-[#0d0f13]">
          <p className="font-bold uppercase tracking-wide text-xs text-[#705d48]">Audit notice</p>
          <p className="mt-1">
            Backlogged orders carry no OR number and are flagged internal only. Use the regular Counter or Tables flow for real-time receipts.
          </p>
          <p className="mt-1">Backlog locked once the drawer for that day is approved. Max backdating window is 30 days.</p>
        </aside>

        {statusMessage && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              statusMessage.kind === "ok"
                ? "border-[#ebe9e6] bg-white text-[#0d0f13]"
                : "border-[#ac312d]/20 bg-[#ac312d]/10 text-[#ac312d] font-semibold"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("quick")}
            className={`min-h-11 rounded-full px-4 text-sm font-bold uppercase tracking-wide ${
              mode === "quick" ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
            }`}
          >
            Quick Entry
          </button>
          <button
            type="button"
            onClick={() => setMode("itemized")}
            className={`min-h-11 rounded-full px-4 text-sm font-bold uppercase tracking-wide ${
              mode === "itemized" ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
            }`}
          >
            Itemized
          </button>
        </div>

        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (mode === "quick") void submitQuick();
            else void submitItemized();
          }}
          className="space-y-4 rounded-lg border border-[#ebe9e6] bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Business date</span>
              <input
                type="date"
                value={businessDate}
                min={minDate}
                max={today}
                onChange={(event) => setBusinessDate(event.target.value)}
                disabled={busy}
                className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Payment</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                disabled={busy}
                className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
              >
                {paymentMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Reason (required)</span>
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                placeholder="Why is this being backlogged?"
                className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
              />
            </label>
          </div>

          {mode === "quick" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Total amount</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={quickTotal}
                  onChange={(event) => setQuickTotal(event.target.value)}
                  disabled={busy}
                  placeholder="0.00"
                  className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-lg font-bold text-[#0d0f13]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Notes (optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={busy}
                  className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              {menuLoading && <p className="text-sm text-[#705d48]">Loading menu...</p>}
              {menuError && <p className="text-sm text-[#ac312d]">Menu failed to load: {menuError}</p>}
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-[#705d48]">No line items yet. Use "Add line" to start.</p>
                )}
                {items.map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-2 rounded-md border border-[#ebe9e6] p-3 sm:grid-cols-[2fr_120px_100px_auto]"
                  >
                    <div>
                      <select
                        value={row.itemId}
                        onChange={(event) => selectItemFromMenu(row.key, event.target.value)}
                        disabled={busy || allMenuItems.length === 0}
                        className="block w-full min-h-11 rounded-md border border-[#d8d2cb] px-2 text-sm text-[#0d0f13]"
                      >
                        <option value={row.itemId}>{row.itemName || "Pick from menu"}</option>
                        {allMenuItems.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label} ({php(entry.price)})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(event) => updateItem(row.key, { itemName: event.target.value })}
                        disabled={busy}
                        placeholder="Item name"
                        className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-2 text-sm text-[#0d0f13]"
                      />
                    </div>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#705d48]">Unit price</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={row.unitPrice}
                        onChange={(event) => updateItem(row.key, { unitPrice: Number(event.target.value) })}
                        disabled={busy}
                        className="block w-full min-h-11 rounded-md border border-[#d8d2cb] px-2 text-sm text-[#0d0f13]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#705d48]">Qty</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        value={row.quantity}
                        onChange={(event) => updateItem(row.key, { quantity: Number(event.target.value) })}
                        disabled={busy}
                        className="block w-full min-h-11 rounded-md border border-[#d8d2cb] px-2 text-sm text-[#0d0f13]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeItem(row.key)}
                      disabled={busy}
                      aria-label="Remove line"
                      className="min-h-11 min-w-11 self-end rounded-md text-[#ac312d] disabled:opacity-40"
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => addItemRow()}
                  disabled={busy}
                  className="min-h-11 rounded-md border border-[#0d0f13] px-4 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
                >
                  Add line
                </button>
                <p className="text-base font-bold text-[#0d0f13]">Subtotal: {php(itemizedSubtotal)}</p>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Notes (optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={busy}
                  className="mt-1 block w-full min-h-11 rounded-md border border-[#d8d2cb] px-3 text-sm text-[#0d0f13]"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-md bg-[#ac312d] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Record backlog"}
            </button>
            <button
              type="button"
              onClick={resetForms}
              disabled={busy}
              className="min-h-11 rounded-md border border-[#d8d2cb] px-4 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </form>

        <section className="rounded-lg border border-[#ebe9e6] bg-white">
          <header className="border-b border-[#ebe9e6] px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#705d48]">Recent backlog</h2>
          </header>
          {recentLoading ? (
            <p className="px-4 py-4 text-sm text-[#705d48]">Loading...</p>
          ) : recent.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#705d48]">No backlog entries yet.</p>
          ) : (
            <ul className="divide-y divide-[#f5f3f0]">
              {recent.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0d0f13]">
                        {row.order_number} <span className="text-[#705d48]">/ {row.business_date}</span>
                      </p>
                      <p className="text-xs text-[#705d48]">
                        {row.payment_method.toUpperCase()} / {row.item_count} item(s) / entered {formatRelative(row.backlogged_at)}
                      </p>
                      {row.backlog_reason && <p className="mt-1 text-xs text-[#0d0f13]">Reason: {row.backlog_reason}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#0d0f13]">{php(row.total_amount)}</span>
                      {row.is_undoable && (
                        <button
                          type="button"
                          onClick={() => handleUndo(row)}
                          disabled={busy}
                          className="min-h-11 rounded-md border border-[#ac312d] px-3 text-xs font-bold uppercase tracking-wide text-[#ac312d] disabled:opacity-50"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      {confirmPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h2 className="text-lg font-bold text-[#0d0f13]">Confirm backlog</h2>
            <p className="mt-2 text-sm text-[#0d0f13]">{confirmPayload.summary}</p>
            <p className="mt-2 text-xs text-[#705d48]">This entry will be flagged internal only. You have 1 hour to undo.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPayload(null)}
                disabled={busy}
                className="min-h-11 rounded-md bg-[#ebe9e6] px-4 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const payload = confirmPayload;
                  setConfirmPayload(null);
                  await payload.submit();
                }}
                disabled={busy}
                className="min-h-11 rounded-md bg-[#ac312d] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
              >
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
