import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useOfflineSync } from "@/lib/offlineSync";
import { useOnlineStatus } from "@/lib/offlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { pendingCount, isSyncing, lastError, syncNow } = useOfflineSync();
  const [showSynced, setShowSynced] = useState(false);
  const previousPending = useRef(pendingCount);

  useEffect(() => {
    if (online && previousPending.current > 0 && pendingCount === 0 && !lastError) {
      setShowSynced(true);
      const timer = window.setTimeout(() => setShowSynced(false), 3000);
      previousPending.current = pendingCount;
      return () => window.clearTimeout(timer);
    }

    previousPending.current = pendingCount;
  }, [lastError, online, pendingCount]);

  if (online && pendingCount === 0 && !lastError && !showSynced) return null;

  const isError = !!lastError;
  const isSuccess = !isError && showSynced && pendingCount === 0;
  const Icon = isError ? AlertTriangle : online ? Wifi : WifiOff;
  const message = isError
    ? lastError
    : isSuccess
      ? "All orders synced"
      : !online && pendingCount > 0
        ? `Offline - ${pendingCount} order(s) queued, will sync automatically`
        : !online
          ? "Offline"
          : `Syncing ${pendingCount} pending order(s)...`;

  const backgroundClass = isError
    ? "bg-[#ac312d]"
    : isSuccess
      ? "bg-[#2d7a3e]"
      : !online
        ? "bg-[#e88627]"
        : "bg-[#0d0f13]";

  return (
    <div className={`sticky top-0 z-[60] w-full ${backgroundClass} text-white`}>
      <div className="mx-auto flex min-h-9 w-full max-w-[1800px] items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold sm:px-4 lg:px-5">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{message}</span>
        </span>
        {isError && (
          <button
            type="button"
            onClick={syncNow}
            disabled={isSyncing}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/60 px-2 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
