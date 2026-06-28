import { supabase } from "@/lib/supabase";
import { TABLES } from "@/lib/tables";
import { X } from "lucide-react";
import { useState } from "react";

interface ReserveTableModalProps {
  open: boolean;
  onClose: () => void;
}

interface ReservationFormState {
  guestName: string;
  guestPhone: string;
  partySize: string;
  date: string;
  time: string;
  preferredTableId: string;
  notes: string;
}

const emptyForm: ReservationFormState = {
  guestName: "",
  guestPhone: "",
  partySize: "2",
  date: "",
  time: "",
  preferredTableId: "",
  notes: "",
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

interface OperatingHours {
  open: string;
  close: string;
  label: string;
}

function getOperatingHours(dateIso: string): OperatingHours {
  const day = dateIso ? new Date(`${dateIso}T00:00:00`).getDay() : null;
  const isFriToSun = day === null || day === 0 || day === 5 || day === 6;
  return isFriToSun
    ? { open: "10:00", close: "22:00", label: "10:00 AM to 10:00 PM" }
    : { open: "10:00", close: "21:00", label: "10:00 AM to 9:00 PM" };
}

export function ReserveTableModal({ open, onClose }: ReserveTableModalProps) {
  const [form, setForm] = useState<ReservationFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const operatingHours = getOperatingHours(form.date);

  if (!open) return null;

  function updateForm<K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDate(value: string) {
    setForm((prev) => {
      const hours = getOperatingHours(value);
      const time = prev.time && prev.time >= hours.open && prev.time <= hours.close ? prev.time : "";
      return { ...prev, date: value, time };
    });
  }

  function handleClose() {
    setForm(emptyForm);
    setError(null);
    setConfirmedName(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const guestName = form.guestName.trim();
    const guestPhone = form.guestPhone.trim();
    const partySize = Number(form.partySize);

    if (!guestName) {
      setError("Please enter your name.");
      return;
    }
    if (!guestPhone) {
      setError("Please enter a phone number we can reach you on.");
      return;
    }
    if (!Number.isFinite(partySize) || partySize <= 0) {
      setError("Party size must be at least 1.");
      return;
    }
    if (!form.date) {
      setError("Please choose a date.");
      return;
    }
    if (!form.time) {
      setError("Please choose a time.");
      return;
    }
    if (form.time < operatingHours.open || form.time > operatingHours.close) {
      setError(`Please choose a time between ${operatingHours.label} (our operating hours).`);
      return;
    }

    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc("create_table_reservation", {
      p_guest_name: guestName,
      p_guest_phone: guestPhone,
      p_party_size: partySize,
      p_reservation_date: form.date,
      p_reservation_time: form.time,
      p_preferred_table_id: form.preferredTableId || null,
      p_notes: form.notes.trim() || null,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setConfirmedName(guestName);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-poppins text-xl font-bold text-[#0d0f13]">
              {confirmedName ? "Request Sent" : "Reserve a Table"}
            </h2>
            {!confirmedName && (
              <p className="mt-1 text-sm text-[#705d48]">
                Tell us when you're coming. We'll confirm your table shortly.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {confirmedName ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-[#2d7a3e]/30 bg-[#2d7a3e]/10 p-4 text-sm text-[#0d0f13]">
              Thanks, {confirmedName}! Your reservation request has been received. Our team will confirm your table by
              phone or Messenger shortly.
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg bg-[#0d0f13] py-2.5 text-sm font-bold uppercase tracking-wide text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[#705d48]">
                Name
                <input
                  type="text"
                  value={form.guestName}
                  onChange={(e) => updateForm("guestName", e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm text-[#0d0f13]"
                />
              </label>
              <label className="text-sm text-[#705d48]">
                Phone Number
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => updateForm("guestPhone", e.target.value)}
                  required
                  placeholder="09XX-XXX-XXXX"
                  className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm text-[#0d0f13]"
                />
              </label>
              <label className="text-sm text-[#705d48]">
                Date
                <input
                  type="date"
                  value={form.date}
                  min={todayIso()}
                  onChange={(e) => updateDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm text-[#0d0f13]"
                />
              </label>
              <label className="text-sm text-[#705d48]">
                Time
                <input
                  type="time"
                  value={form.time}
                  min={operatingHours.open}
                  max={operatingHours.close}
                  onChange={(e) => updateForm("time", e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm text-[#0d0f13]"
                />
                <span className="mt-1 block text-xs text-[#705d48]">Hours: {operatingHours.label}</span>
              </label>
              <label className="text-sm text-[#705d48]">
                Party Size
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={form.partySize}
                  onChange={(e) => updateForm("partySize", e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm text-[#0d0f13]"
                />
              </label>
            </div>

            <div>
              <p className="text-sm text-[#705d48]">Preferred Table (optional)</p>
              <div className="mt-1 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border border-[#d8d2cb] p-2 sm:grid-cols-6">
                <button
                  type="button"
                  onClick={() => updateForm("preferredTableId", "")}
                  className={`rounded-md px-1.5 py-2 text-center text-xs font-semibold ${
                    form.preferredTableId === ""
                      ? "bg-[#c08643] text-white"
                      : "border border-[#d8d2cb] text-[#0d0f13]"
                  }`}
                >
                  No Pref
                </button>
                {TABLES.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => updateForm("preferredTableId", table.id)}
                    title={table.capacity}
                    className={`rounded-md px-1.5 py-2 text-center text-xs font-semibold ${
                      form.preferredTableId === table.id
                        ? "bg-[#c08643] text-white"
                        : "border border-[#d8d2cb] text-[#0d0f13]"
                    }`}
                  >
                    T{table.number}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm text-[#705d48]">
              Notes (optional)
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Celebrating a birthday, need a high chair, etc."
                className="mt-1 w-full resize-none rounded-lg border border-[#d8d2cb] px-3 py-2.5 text-sm text-[#0d0f13]"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-[#ac312d]/30 bg-[#ac312d]/5 px-3 py-2 text-sm font-semibold text-[#ac312d]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#ac312d] py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#8f2825] disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send Reservation Request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
