import { AdminLayout } from "@/components/AdminLayout";
import { supabase, type PromoCodeRow } from "@/lib/supabase";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface PromoFormState {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  minOrderAmount: string;
  maxDiscount: string;
  validFrom: string;
  validUntil: string;
  usageLimit: string;
  isActive: boolean;
}

const emptyForm: PromoFormState = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  minOrderAmount: "",
  maxDiscount: "",
  validFrom: "",
  validUntil: "",
  usageLimit: "",
  isActive: true,
};

function currencyPhp(value: number): string {
  return `PHP ${value.toLocaleString("en-PH")}`;
}

function formatLocalDateTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function toInputDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function promoDiscountLabel(promo: PromoCodeRow): string {
  if (promo.discount_type === "percent") {
    return `${Number(promo.discount_value)}% off`;
  }
  return `${currencyPhp(Number(promo.discount_value))} off`;
}

function usageLabel(promo: PromoCodeRow): string {
  const used = Number(promo.times_used);
  if (promo.usage_limit == null) return `${used} used`;
  return `${used} / ${Number(promo.usage_limit)} used`;
}

function validityLabel(promo: PromoCodeRow): string {
  if (!promo.valid_from && !promo.valid_until) return "No schedule";
  const start = promo.valid_from ? formatLocalDateTime(promo.valid_from) : "Now";
  const end = promo.valid_until ? formatLocalDateTime(promo.valid_until) : "No end";
  return `${start} to ${end}`;
}

export default function AdminPromos() {
  const [promos, setPromos] = useState<PromoCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  useEffect(() => {
    loadPromos();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadPromos() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setPromos([]);
      setLoading(false);
      return;
    }

    setPromos((data ?? []) as PromoCodeRow[]);
    setLoading(false);
  }

  function openCreateForm() {
    setEditingCode(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError(null);
  }

  function openEditForm(promo: PromoCodeRow) {
    setEditingCode(promo.code);
    setForm({
      code: promo.code,
      description: promo.description ?? "",
      discountType: promo.discount_type,
      discountValue: String(Number(promo.discount_value)),
      minOrderAmount: promo.min_order_amount == null ? "" : String(Number(promo.min_order_amount)),
      maxDiscount: promo.max_discount == null ? "" : String(Number(promo.max_discount)),
      validFrom: toInputDateTime(promo.valid_from),
      validUntil: toInputDateTime(promo.valid_until),
      usageLimit: promo.usage_limit == null ? "" : String(Number(promo.usage_limit)),
      isActive: promo.is_active,
    });
    setFormOpen(true);
    setError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingCode(null);
    setForm(emptyForm);
  }

  function updateForm<K extends keyof PromoFormState>(key: K, value: PromoFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const normalizedCode = form.code.trim().toUpperCase();
    if (!editingCode && !normalizedCode) {
      setError("Promo code is required.");
      return;
    }

    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setError("Discount value must be greater than 0.");
      return;
    }

    const minOrderAmount = form.minOrderAmount.trim() ? Number(form.minOrderAmount) : null;
    if (minOrderAmount != null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)) {
      setError("Minimum order amount must be 0 or higher.");
      return;
    }

    const maxDiscount = form.maxDiscount.trim() ? Number(form.maxDiscount) : null;
    if (maxDiscount != null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) {
      setError("Max discount must be greater than 0.");
      return;
    }

    const usageLimit = form.usageLimit.trim() ? Number(form.usageLimit) : null;
    if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
      setError("Usage limit must be a whole number greater than 0.");
      return;
    }

    const payload = {
      description: form.description.trim() || null,
      discount_type: form.discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount,
      max_discount: form.discountType === "percent" ? maxDiscount : null,
      valid_from: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      valid_until: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      usage_limit: usageLimit,
      is_active: form.isActive,
    };

    setSaving(true);

    if (editingCode) {
      const { error: updateError } = await supabase
        .from("promo_codes")
        .update(payload)
        .eq("code", editingCode);

      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }

      setNotice("Promo updated.");
      setSaving(false);
      closeForm();
      await loadPromos();
      return;
    }

    const { error: insertError } = await supabase.from("promo_codes").insert({
      code: normalizedCode,
      ...payload,
    });

    if (insertError) {
      setSaving(false);
      if (insertError.code === "23505") {
        setError("That code already exists.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    setNotice("Promo created.");
    setSaving(false);
    closeForm();
    await loadPromos();
  }

  async function handleToggleActive(promo: PromoCodeRow, nextActive: boolean) {
    const previous = promos;
    setTogglingCode(promo.code);
    setPromos((prev) => prev.map((row) => (row.code === promo.code ? { ...row, is_active: nextActive } : row)));

    const { error: updateError } = await supabase
      .from("promo_codes")
      .update({ is_active: nextActive })
      .eq("code", promo.code);

    if (updateError) {
      setPromos(previous);
      setError(updateError.message);
    }

    setTogglingCode(null);
  }

  async function handleDeletePromo(promo: PromoCodeRow) {
    if (Number(promo.times_used) > 0) {
      setNotice("Cannot delete a promo that has been used. Deactivate it instead.");
      return;
    }

    setDeletingCode(promo.code);
    const { error: deleteError } = await supabase.from("promo_codes").delete().eq("code", promo.code);

    if (deleteError) {
      setDeletingCode(null);
      setError(deleteError.message);
      return;
    }

    setNotice("Promo deleted.");
    setDeletingCode(null);
    await loadPromos();
  }

  return (
    <AdminLayout>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0d0f13]">Promos</h1>
            <p className="text-sm text-[#705d48]">Create and manage discount codes for checkout.</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#ac312d] text-white text-sm font-semibold"
          >
            <Plus size={14} />
            New Promo Code
          </button>
        </div>

        {notice && <div className="bg-white rounded-lg p-3 text-sm text-[#2d7a3e]">{notice}</div>}
        {error && <div className="bg-white rounded-lg p-3 text-sm text-[#ac312d]">{error}</div>}

        {formOpen && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-5 space-y-4 border border-[#ebe9e6]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#0d0f13]">{editingCode ? "Edit Promo" : "New Promo"}</h2>
              <button
                type="button"
                onClick={closeForm}
                className="px-3 py-1.5 rounded-md border border-[#d8d2cb] text-sm font-semibold text-[#0d0f13]"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-[#705d48]">
                Code
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => updateForm("code", e.target.value.toUpperCase())}
                  disabled={Boolean(editingCode)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13] disabled:bg-[#f5f2ee]"
                />
              </label>

              <label className="text-sm text-[#705d48]">
                Description
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13]"
                />
              </label>

              <fieldset className="text-sm text-[#705d48]">
                <legend className="mb-1">Discount Type</legend>
                <div className="flex items-center gap-4 border border-[#d8d2cb] rounded-md px-3 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="discountType"
                      checked={form.discountType === "percent"}
                      onChange={() => updateForm("discountType", "percent")}
                    />
                    Percent
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="discountType"
                      checked={form.discountType === "fixed"}
                      onChange={() => updateForm("discountType", "fixed")}
                    />
                    Fixed
                  </label>
                </div>
              </fieldset>

              <label className="text-sm text-[#705d48]">
                Discount Value
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => updateForm("discountValue", e.target.value)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13]"
                />
              </label>

              <label className="text-sm text-[#705d48]">
                Min Order Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) => updateForm("minOrderAmount", e.target.value)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13]"
                />
              </label>

              <label className="text-sm text-[#705d48]">
                Max Discount (percent only)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maxDiscount}
                  onChange={(e) => updateForm("maxDiscount", e.target.value)}
                  disabled={form.discountType !== "percent"}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13] disabled:bg-[#f5f2ee]"
                />
              </label>

              <label className="text-sm text-[#705d48]">
                Valid From
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => updateForm("validFrom", e.target.value)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13]"
                />
              </label>

              <label className="text-sm text-[#705d48]">
                Valid Until
                <input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => updateForm("validUntil", e.target.value)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13]"
                />
              </label>

              <label className="text-sm text-[#705d48]">
                Usage Limit
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.usageLimit}
                  onChange={(e) => updateForm("usageLimit", e.target.value)}
                  className="mt-1 w-full border border-[#d8d2cb] rounded-md px-3 py-2 text-sm text-[#0d0f13]"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-[#705d48] mt-6">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateForm("isActive", e.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md bg-[#0d0f13] text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : editingCode ? "Save Changes" : "Create Promo"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-lg p-4">
          {loading && <p className="text-sm text-[#705d48]">Loading promos...</p>}
          {!loading && promos.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-[#705d48] mb-3">No promo codes yet. Create your first one.</p>
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#ac312d] text-white text-sm font-semibold"
              >
                <Plus size={14} />
                New Promo Code
              </button>
            </div>
          )}

          {!loading && promos.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#705d48] border-b border-[#ebe9e6]">
                      <th className="py-2 pr-2">Code</th>
                      <th className="py-2 pr-2">Discount</th>
                      <th className="py-2 pr-2">Validity</th>
                      <th className="py-2 pr-2">Usage</th>
                      <th className="py-2 pr-2">Active</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map((promo) => (
                      <tr key={promo.code} className="border-b border-[#f1ede9]">
                        <td className="py-3 pr-2">
                          <p className="font-bold uppercase text-[#0d0f13]">{promo.code}</p>
                          {promo.description && <p className="text-xs text-[#705d48] mt-1">{promo.description}</p>}
                        </td>
                        <td className="py-3 pr-2">{promoDiscountLabel(promo)}</td>
                        <td className="py-3 pr-2 text-[#705d48]">{validityLabel(promo)}</td>
                        <td className="py-3 pr-2 text-[#705d48]">{usageLabel(promo)}</td>
                        <td className="py-3 pr-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={promo.is_active}
                              disabled={togglingCode === promo.code}
                              onChange={(e) => handleToggleActive(promo, e.target.checked)}
                            />
                            <span>{promo.is_active ? "On" : "Off"}</span>
                          </label>
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(promo)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePromo(promo)}
                              disabled={Number(promo.times_used) > 0 || deletingCode === promo.code}
                              title={
                                Number(promo.times_used) > 0
                                  ? "Cannot delete a promo that has been used. Deactivate it instead."
                                  : "Delete promo"
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#d8d2cb] text-[#ac312d] disabled:opacity-40"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {promos.map((promo) => (
                  <div key={promo.code} className="rounded-md border border-[#ebe9e6] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold uppercase text-[#0d0f13]">{promo.code}</p>
                        {promo.description && <p className="text-xs text-[#705d48] mt-1">{promo.description}</p>}
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-[#705d48]">
                        <input
                          type="checkbox"
                          checked={promo.is_active}
                          disabled={togglingCode === promo.code}
                          onChange={(e) => handleToggleActive(promo, e.target.checked)}
                        />
                        Active
                      </label>
                    </div>
                    <p className="text-sm text-[#0d0f13] mt-2">{promoDiscountLabel(promo)}</p>
                    <p className="text-xs text-[#705d48] mt-1">{validityLabel(promo)}</p>
                    <p className="text-xs text-[#705d48] mt-1">{usageLabel(promo)}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(promo)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#d8d2cb] text-[#0d0f13] text-xs"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(promo)}
                        disabled={Number(promo.times_used) > 0 || deletingCode === promo.code}
                        title={
                          Number(promo.times_used) > 0
                            ? "Cannot delete a promo that has been used. Deactivate it instead."
                            : "Delete promo"
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#d8d2cb] text-[#ac312d] text-xs disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
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
