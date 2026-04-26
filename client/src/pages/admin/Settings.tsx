import { AdminLayout } from "@/components/AdminLayout";
import { useBusinessSettings } from "@/lib/businessSettings";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface SettingsFormState {
  business_name: string;
  business_tin: string;
  business_address: string;
  business_contact: string;
  vat_registered: boolean;
  vat_rate: string;
  or_prefix: string;
  or_next_number: string;
  receipt_footer: string;
  is_bir_accredited: boolean;
}

function toForm(settings: {
  business_name: string;
  business_tin: string | null;
  business_address: string | null;
  business_contact: string | null;
  vat_registered: boolean;
  vat_rate: number;
  or_prefix: string;
  or_next_number: number;
  receipt_footer: string | null;
  is_bir_accredited: boolean;
}): SettingsFormState {
  return {
    business_name: settings.business_name,
    business_tin: settings.business_tin ?? "",
    business_address: settings.business_address ?? "",
    business_contact: settings.business_contact ?? "",
    vat_registered: settings.vat_registered,
    vat_rate: String(settings.vat_rate ?? 12),
    or_prefix: settings.or_prefix,
    or_next_number: String(settings.or_next_number ?? 1),
    receipt_footer: settings.receipt_footer ?? "",
    is_bir_accredited: settings.is_bir_accredited,
  };
}

export default function AdminSettings() {
  const { settings, loading, refresh } = useBusinessSettings();
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm(toForm(settings));
  }, [settings]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!settings || !form) return;

    const nextOrValue = Number(form.or_next_number);
    if (!Number.isFinite(nextOrValue) || nextOrValue < 1) {
      setError("OR Next Number must be at least 1.");
      return;
    }

    if (!form.business_name.trim()) {
      setError("Business Name is required.");
      return;
    }

    const orNumberChanged = nextOrValue !== settings.or_next_number;
    if (orNumberChanged) {
      const confirmed = window.confirm(
        "Changing the OR sequence may break BIR audit trails. Are you sure?",
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: saveError } = await supabase
      .from("business_settings")
      .update({
        business_name: form.business_name.trim(),
        business_tin: form.business_tin.trim() || null,
        business_address: form.business_address.trim() || null,
        business_contact: form.business_contact.trim() || null,
        vat_registered: form.vat_registered,
        vat_rate: Number(form.vat_rate || 12),
        or_prefix: form.or_prefix.trim() || "SAIKO-OR",
        or_next_number: nextOrValue,
        receipt_footer: form.receipt_footer.trim() || null,
        is_bir_accredited: form.is_bir_accredited,
      })
      .eq("id", settings.id);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    await refresh();
    setSuccess("Settings saved.");
    setSaving(false);
  }

  return (
    <AdminLayout>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0d0f13]">Business Settings</h1>
          <p className="text-sm text-[#705d48]">TIN, address, VAT, OR sequence, and receipt configuration.</p>
        </div>

        {loading && <div className="bg-white rounded-lg p-4 text-sm text-[#705d48]">Loading settings...</div>}

        {!loading && !settings && (
          <div className="bg-white rounded-lg p-4 text-sm text-[#ac312d]">
            No business settings row found. Run migration 010 first.
          </div>
        )}

        {!loading && settings && form && (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-[#d8d2cb] p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">Business Name</label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, business_name: event.target.value } : cur))}
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">TIN</label>
                <input
                  type="text"
                  value={form.business_tin}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, business_tin: event.target.value } : cur))}
                  placeholder="123-456-789-000"
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">Address</label>
                <textarea
                  value={form.business_address}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, business_address: event.target.value } : cur))}
                  rows={3}
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">Contact</label>
                <input
                  type="text"
                  value={form.business_contact}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, business_contact: event.target.value } : cur))}
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="rounded-lg border border-[#d8d2cb] p-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.vat_registered}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, vat_registered: event.target.checked } : cur))}
                />
                <span className="text-sm font-semibold text-[#0d0f13]">VAT Registered</span>
              </label>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">VAT Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.vat_rate}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, vat_rate: event.target.value } : cur))}
                  disabled={!form.vat_registered}
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm disabled:bg-[#f4f1ed] disabled:text-[#705d48]"
                />
              </div>
              <label className="rounded-lg border border-[#d8d2cb] p-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_bir_accredited}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, is_bir_accredited: event.target.checked } : cur))}
                />
                <span className="text-sm font-semibold text-[#0d0f13]">BIR Accredited</span>
              </label>
            </div>
            <p className="text-xs text-[#705d48]">
              Only check BIR Accredited if Saiko is BIR-accredited. Defaults to provisional receipts otherwise.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">OR Prefix</label>
                <input
                  type="text"
                  value={form.or_prefix}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, or_prefix: event.target.value } : cur))}
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">OR Next Number</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.or_next_number}
                  onChange={(event) => setForm((cur) => (cur ? { ...cur, or_next_number: event.target.value } : cur))}
                  className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm"
                />
                <p className="text-xs text-[#705d48] mt-1">
                  Next OR to be issued. Change carefully if importing prior receipts.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#705d48] mb-1">Receipt Footer</label>
              <textarea
                value={form.receipt_footer}
                onChange={(event) => setForm((cur) => (cur ? { ...cur, receipt_footer: event.target.value } : cur))}
                rows={3}
                className="w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm resize-none"
                placeholder="Salamat at bumalik kayo!"
              />
            </div>

            {error && <p className="text-sm text-[#ac312d] font-semibold">{error}</p>}
            {success && <p className="text-sm text-[#2d7a3e] font-semibold">{success}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-11 px-5 rounded-lg bg-[#ac312d] text-white text-sm font-bold uppercase tracking-wide disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
      </section>
    </AdminLayout>
  );
}
