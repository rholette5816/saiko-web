import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { TABLES } from "@/lib/tables";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

interface OpenOrderRow {
  id: string;
  table_number: string | null;
  linked_tables: string[] | null;
  total_amount: number | string | null;
  created_at: string;
}

interface TableStatus {
  roundCount: number;
  total: number;
  openedAt: string;
  anchorTable: string;
  mergedWith: string[];
}

interface ReservationRow {
  id: string;
  guest_name: string;
  party_size: number;
  reservation_time: string;
  assigned_table_id: string | null;
}

function currencyPhp(value: number): string {
  return `PHP ${Math.round(value).toLocaleString("en-PH")}`;
}

function elapsedLabel(openedAt: string): string {
  const created = new Date(openedAt).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatReservationTime(value: string): string {
  const [hour, minute] = value.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export default function AdminTables() {
  const [, navigate] = useLocation();
  const [openOrders, setOpenOrders] = useState<OpenOrderRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTables() {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("orders")
      .select("id, table_number, linked_tables, total_amount, created_at")
      .in("status", ["preparing", "ready"])
      .not("table_number", "is", null);

    if (loadError) {
      setError(loadError.message);
      setOpenOrders([]);
    } else {
      setOpenOrders((data ?? []) as OpenOrderRow[]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  async function loadReservations() {
    const { data, error: loadError } = await supabase
      .from("table_reservations")
      .select("id, guest_name, party_size, reservation_time, assigned_table_id")
      .eq("status", "confirmed")
      .eq("reservation_date", todayIso())
      .not("assigned_table_id", "is", null)
      .order("reservation_time", { ascending: true });

    if (!loadError) {
      setReservations((data ?? []) as ReservationRow[]);
    }
  }

  useEffect(() => {
    void loadTables();
    void loadReservations();
    const channel = supabase
      .channel("tables-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "table_number=not.is.null" }, () => {
        void loadTables();
      })
      .subscribe();
    const reservationChannel = supabase
      .channel("tables-reservations")
      .on("postgres_changes", { event: "*", schema: "public", table: "table_reservations" }, () => {
        void loadReservations();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(reservationChannel);
    };
  }, []);

  const statusByTable = useMemo(() => {
    const grouped = new Map<string, TableStatus>();
    for (const order of openOrders) {
      if (!order.table_number) continue;
      const mergedWith = (order.linked_tables ?? []).filter(Boolean);
      const status: TableStatus = {
        roundCount: 1,
        total: Number(order.total_amount ?? 0),
        openedAt: order.created_at,
        anchorTable: order.table_number,
        mergedWith,
      };
      grouped.set(order.table_number, status);
      for (const linkedTable of mergedWith) {
        grouped.set(linkedTable, status);
      }
    }
    return grouped;
  }, [openOrders]);

  const reservationByTable = useMemo(() => {
    const grouped = new Map<string, ReservationRow>();
    for (const reservation of reservations) {
      if (!reservation.assigned_table_id) continue;
      if (grouped.has(reservation.assigned_table_id)) continue;
      grouped.set(reservation.assigned_table_id, reservation);
    }
    return grouped;
  }, [reservations]);

  function handleRefresh() {
    setRefreshing(true);
    void loadTables();
    void loadReservations();
  }

  return (
    <AdminLayout>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0d0f13]">Tables</h1>
            <p className="text-sm text-[#705d48]">Dine-in table rounds and running bills.</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d8d2cb] bg-white text-[#0d0f13] disabled:opacity-60"
            title="Refresh tables"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            <span className="sr-only">Refresh</span>
          </button>
        </div>

        {loading && (
          <div className="rounded-lg border border-[#d8d2cb] bg-white p-4 text-sm text-[#705d48]">
            Loading tables...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#ac312d]/30 bg-white p-4 text-sm font-semibold text-[#ac312d]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {TABLES.map((table) => {
            const status = statusByTable.get(table.id);
            const isOpen = Boolean(status);
            const reservation = reservationByTable.get(table.id);
            const badgeText = isOpen ? "Open" : reservation ? "Reserved" : "Empty";
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => navigate(`/admin/tables/${table.id}`)}
                className={`min-h-[136px] rounded-lg border p-3 text-left transition-colors ${
                  isOpen
                    ? "border-[#2d7a3e]/40 bg-[#2d7a3e]/10 hover:border-[#2d7a3e]"
                    : reservation
                      ? "border-[#c08643]/40 bg-[#c08643]/10 hover:border-[#c08643]"
                      : "border-[#d8d2cb] bg-[#f6f2ed] hover:border-[#c08643]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Table</p>
                    <p className="text-3xl font-bold text-[#0d0f13] xl:text-4xl">{table.number}</p>
                    <p className="mt-1 text-sm font-semibold text-[#705d48]">{table.capacity}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      isOpen ? "bg-[#2d7a3e] text-white" : reservation ? "bg-[#c08643] text-white" : "bg-white text-[#705d48]"
                    }`}
                  >
                    {badgeText}
                  </span>
                </div>
                {status && (
                  <div className="mt-3 rounded-md bg-white/80 px-2.5 py-2 text-xs font-semibold text-[#0d0f13]">
                    Open | {currencyPhp(status.total)} | {elapsedLabel(status.openedAt)}
                    <div className="mt-0.5 text-[#705d48]">
                      {status.roundCount} {status.roundCount === 1 ? "round" : "rounds"}
                    </div>
                    {(status.anchorTable !== table.id || status.mergedWith.length > 0) && (
                      <div className="mt-1 text-[#c08643]">
                        {status.anchorTable !== table.id
                          ? `Merged with Table ${TABLES.find((t) => t.id === status.anchorTable)?.number ?? status.anchorTable}`
                          : `Merged with ${status.mergedWith
                              .map((id) => `Table ${TABLES.find((t) => t.id === id)?.number ?? id}`)
                              .join(", ")}`}
                      </div>
                    )}
                    {reservation && (
                      <div className="mt-1 text-[#c08643]">
                        Reserved {formatReservationTime(reservation.reservation_time)} ({reservation.guest_name})
                      </div>
                    )}
                  </div>
                )}
                {!status && reservation && (
                  <div className="mt-3 rounded-md bg-white/80 px-2.5 py-2 text-xs font-semibold text-[#0d0f13]">
                    Reserved | {formatReservationTime(reservation.reservation_time)}
                    <div className="mt-0.5 text-[#705d48]">
                      {reservation.guest_name} · Party of {reservation.party_size}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </AdminLayout>
  );
}
