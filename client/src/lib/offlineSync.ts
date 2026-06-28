import { useCallback, useEffect, useRef, useState } from "react";
import { getQueue, removeFromQueue } from "@/lib/offlineQueue";
import { useOnlineStatus } from "@/lib/offlineStatus";
import { supabase } from "@/lib/supabase";

interface OfflineSyncState {
  pendingCount: number;
  isSyncing: boolean;
  lastError: string | null;
  syncNow: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to sync pending orders.";
}

export function useOfflineSync(): OfflineSyncState {
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(() => getQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueue().length);
  }, []);

  const processQueue = useCallback(async () => {
    if (syncingRef.current) return;
    if (getQueue().length === 0) {
      refreshPendingCount();
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);
    setLastError(null);

    try {
      const queue = getQueue();
      for (const entry of queue) {
        let syncsTableRound = false;
        let rpcError: { message: string } | null = null;

        if (entry.type === "counter_order") {
          const { error } = await supabase.rpc("place_counter_order", entry.payload);
          rpcError = error;
        }

        if (entry.type === "table_round") {
          const { error } = await supabase.rpc("place_table_round", entry.payload);
          rpcError = error;
          syncsTableRound = true;
        }

        if (entry.type === "table_round_edit") {
          const { error } = await supabase.rpc("update_table_round_items", entry.payload);
          rpcError = error;
          syncsTableRound = true;
        }

        if (entry.type === "table_ticket_print") {
          const { error } = await supabase.rpc("mark_table_ticket_printed", entry.payload);
          rpcError = error;
        }

        if (rpcError) {
          setLastError(rpcError.message);
          return;
        }

        removeFromQueue(entry.localId);
        if (syncsTableRound) {
          window.dispatchEvent(new CustomEvent("saiko:table-round-synced"));
        }
        refreshPendingCount();
      }
    } catch (error) {
      setLastError(errorMessage(error));
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  const syncNow = useCallback(() => {
    void processQueue();
  }, [processQueue]);

  useEffect(() => {
    refreshPendingCount();
    const interval = window.setInterval(refreshPendingCount, 2000);
    return () => window.clearInterval(interval);
  }, [refreshPendingCount]);

  useEffect(() => {
    if (online) void processQueue();
  }, [online, processQueue]);

  return { pendingCount, isSyncing, lastError, syncNow };
}
