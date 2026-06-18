import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { TABLES } from "@/lib/tables";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

interface OpenOrderRow {
  id: string;
  table_number: string | null;
  total_amount: number | string | null;
  created_at: string;
}

interface TableStatus {
  roundCount: number;
  total: number;
  openedAt: string;
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

export default function AdminTables() {
  const [, navigate] = useLocation();
  const [openOrders, setOpenOrders] = useState<OpenOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTables() {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("orders")
      .select("id, table_number, total_amount, created_at")
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

  useEffect(() => {
    void loadTables();
    const channel = supabase
      .channel("tables-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "table_number=not.is.null" }, () => {
        void loadTables();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const statusByTable = useMemo(() => {
    const grouped = new Map<string, TableStatus>();
    for (const order of openOrders) {
      if (!order.table_number) continue;
      const current = grouped.get(order.table_number);
      if (!current) {
        grouped.set(order.table_number, {
          roundCount: 1,
          total: Number(order.total_amount ?? 0),
          openedAt: order.created_at,
        });
        continue;
      }

      grouped.set(order.table_number, {
        roundCount: current.roundCount + 1,
        total: current.total + Number(order.total_amount ?? 0),
        openedAt: new Date(order.created_at).getTime() < new Date(current.openedAt).getTime() ? order.created_at : current.openedAt,
      });
    }
    return grouped;
  }, [openOrders]);

  function handleRefresh() {
    setRefreshing(true);
    void loadTables();
  }

  return (
    <AdminLayout>
      <section className="space-y-4">
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {TABLES.map((table) => {
            const status = statusByTable.get(table.id);
            const isOpen = Boolean(status);
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => navigate(`/admin/tables/${table.id}`)}
                className={`min-h-[150px] rounded-lg border p-4 text-left transition-colors ${
                  isOpen
                    ? "border-[#2d7a3e]/40 bg-[#2d7a3e]/10 hover:border-[#2d7a3e]"
                    : "border-[#d8d2cb] bg-[#f6f2ed] hover:border-[#c08643]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Table</p>
                    <p className="text-4xl font-bold text-[#0d0f13]">{table.number}</p>
                    <p className="mt-1 text-sm font-semibold text-[#705d48]">{table.capacity}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                      isOpen ? "bg-[#2d7a3e] text-white" : "bg-white text-[#705d48]"
                    }`}
                  >
                    {isOpen ? "Open" : "Empty"}
                  </span>
                </div>
                {status && (
                  <div className="mt-5 rounded-md bg-white/80 px-2.5 py-2 text-xs font-semibold text-[#0d0f13]">
                    Open | {currencyPhp(status.total)} | {elapsedLabel(status.openedAt)}
                    <div className="mt-0.5 text-[#705d48]">
                      {status.roundCount} {status.roundCount === 1 ? "round" : "rounds"}
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
