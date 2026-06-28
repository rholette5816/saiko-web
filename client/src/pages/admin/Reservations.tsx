import { AdminLayout } from "@/components/AdminLayout";
import { getTable, TABLES } from "@/lib/tables";
import { supabase, type TableReservationRow } from "@/lib/supabase";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

type StatusFilter = "pending" | "confirmed" | "completed" | "declined" | "cancelled" | "all";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

function statusBadgeClass(status: TableReservationRow["status"]): string {
  switch (status) {
    case "confirmed":
      return "bg-[#2d7a3e]/10 text-[#2d7a3e]";
    case "completed":
      return "bg-[#0d0f13]/10 text-[#0d0f13]";
    case "declined":
      return "bg-[#ac312d]/10 text-[#ac312d]";
    case "cancelled":
      return "bg-[#705d48]/10 text-[#705d48]";
    default:
      return "bg-[#c08643]/10 text-[#c08643]";
  }
}

export default function AdminReservations() {
  const [reservations, setReservations] = useState<TableReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignTableId, setAssignTableId] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadReservations();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadReservations() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("table_reservations")
      .select("*")
      .order("reservation_date", { ascending: true })
      .order("reservation_time", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setReservations([]);
      setLoading(false);
      return;
    }

    setReservations((data ?? []) as TableReservationRow[]);
    setLoading(false);
  }

  function beginAssign(reservation: TableReservationRow) {
    setAssigningId(reservation.id);
    setAssignTableId(reservation.preferred_table_id ?? "");
  }

  function cancelAssign() {
    setAssigningId(null);
    setAssignTableId("");
  }

  async function handleConfirm(reservation: TableReservationRow) {
    if (!assignTableId) {
      setError("Choose a table to assign before confirming.");
      return;
    }

    setSavingId(reservation.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("table_reservations")
      .update({
        status: "confirmed",
        assigned_table_id: assignTableId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);

    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice(`Reservation for ${reservation.guest_name} confirmed.`);
    setAssigningId(null);
    setAssignTableId("");
    await loadReservations();
  }

  async function handleMarkCompleted(reservation: TableReservationRow) {
    setSavingId(reservation.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("table_reservations")
      .update({ status: "completed" })
      .eq("id", reservation.id);

    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice(`Reservation for ${reservation.guest_name} marked as seated.`);
    await loadReservations();
  }

  async function handleDecline(reservation: TableReservationRow) {
    setSavingId(reservation.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("table_reservations")
      .update({ status: "declined" })
      .eq("id", reservation.id);

    setSavingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice(`Reservation for ${reservation.guest_name} declined.`);
    await loadReservations();
  }

  const filteredReservations =
    filter === "all" ? reservations : reservations.filter((reservation) => reservation.status === filter);

  return (
    <AdminLayout>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0d0f13]">Reservations</h1>
          <p className="text-sm text-[#705d48]">Review table reservation requests from the website.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                filter === option.value
                  ? "bg-[#0d0f13] text-white"
                  : "border border-[#d8d2cb] text-[#0d0f13]"
              }`}
            >
              {option.label}
              {option.value !== "all" && (
                <span className="ml-1.5 opacity-70">
                  {reservations.filter((r) => r.status === option.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {notice && <div className="bg-white rounded-lg p-3 text-sm text-[#2d7a3e]">{notice}</div>}
        {error && <div className="bg-white rounded-lg p-3 text-sm text-[#ac312d]">{error}</div>}

        <div className="bg-white rounded-lg p-4">
          {loading && <p className="text-sm text-[#705d48]">Loading reservations...</p>}

          {!loading && filteredReservations.length === 0 && (
            <p className="py-10 text-center text-sm text-[#705d48]">No {filter !== "all" ? filter : ""} reservations.</p>
          )}

          {!loading && filteredReservations.length > 0 && (
            <div className="space-y-3">
              {filteredReservations.map((reservation) => {
                const preferredTable = reservation.preferred_table_id ? getTable(reservation.preferred_table_id) : null;
                const assignedTable = reservation.assigned_table_id ? getTable(reservation.assigned_table_id) : null;
                const isAssigning = assigningId === reservation.id;
                const isSaving = savingId === reservation.id;

                return (
                  <div key={reservation.id} className="rounded-lg border border-[#ebe9e6] p-3 md:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[#0d0f13]">{reservation.guest_name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(reservation.status)}`}>
                            {reservation.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#705d48]">{reservation.guest_phone}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-[#0d0f13]">
                          {formatDate(reservation.reservation_date)} at {formatTime(reservation.reservation_time)}
                        </p>
                        <p className="text-[#705d48]">{reservation.party_size} pax</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#705d48]">
                      <span>
                        Preferred table:{" "}
                        <span className="font-semibold text-[#0d0f13]">
                          {preferredTable ? `Table ${preferredTable.number} (${preferredTable.capacity})` : "No preference"}
                        </span>
                      </span>
                      {assignedTable && (
                        <span>
                          Assigned table: <span className="font-semibold text-[#0d0f13]">Table {assignedTable.number}</span>
                        </span>
                      )}
                    </div>

                    {reservation.notes && (
                      <p className="mt-2 rounded-md bg-[#f6f2ed] px-2.5 py-1.5 text-xs text-[#0d0f13]">{reservation.notes}</p>
                    )}

                    {reservation.status === "pending" && (
                      <div className="mt-3 border-t border-[#ebe9e6] pt-3">
                        {isAssigning ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={assignTableId}
                              onChange={(e) => setAssignTableId(e.target.value)}
                              className="h-9 rounded-md border border-[#d8d2cb] bg-white px-2 text-sm font-semibold text-[#0d0f13]"
                            >
                              <option value="">Choose table...</option>
                              {TABLES.map((table) => (
                                <option key={table.id} value={table.id}>
                                  Table {table.number} ({table.capacity})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleConfirm(reservation)}
                              disabled={isSaving}
                              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2d7a3e] px-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
                            >
                              <Check size={13} />
                              {isSaving ? "Saving..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelAssign}
                              disabled={isSaving}
                              className="inline-flex h-9 items-center rounded-md border border-[#d8d2cb] px-3 text-xs font-bold uppercase tracking-wide text-[#0d0f13]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => beginAssign(reservation)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2d7a3e] px-3 text-xs font-bold uppercase tracking-wide text-white"
                            >
                              <Check size={13} />
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecline(reservation)}
                              disabled={isSaving}
                              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#ac312d] px-3 text-xs font-bold uppercase tracking-wide text-[#ac312d] disabled:opacity-60"
                            >
                              <X size={13} />
                              {isSaving ? "Saving..." : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {reservation.status === "confirmed" && (
                      <div className="mt-3 border-t border-[#ebe9e6] pt-3">
                        <button
                          type="button"
                          onClick={() => handleMarkCompleted(reservation)}
                          disabled={isSaving}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0d0f13] px-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
                        >
                          <Check size={13} />
                          {isSaving ? "Saving..." : "Mark Seated"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
