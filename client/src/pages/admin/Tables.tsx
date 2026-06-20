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

  function handleRefresh() {
    setRefreshing(true);
    void loadTables();
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
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => navigate(`/admin/tables/${table.id}`)}
                className={`min-h-[136px] rounded-lg border p-3 text-left transition-colors ${
                  isOpen
                    ? "border-[#2d7a3e]/40 bg-[#2d7a3e]/10 hover:border-[#2d7a3e]"
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
                      isOpen ? "bg-[#2d7a3e] text-white" : "bg-white text-[#705d48]"
                    }`}
                  >
                    {isOpen ? "Open" : "Empty"}
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
