import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { Clock3, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

interface TrackingItem {
  name: string;
  qty: number;
}

interface TrackingPayload {
  order_number: string;
  status: OrderStatus;
  pickup: string;
  customer_name: string;
  total: number;
  items: TrackingItem[];
  created_at: string;
  updated_at: string;
}

const steps: Array<{ key: Exclude<OrderStatus, "cancelled">; label: string; mobileLabel: string }> = [
  { key: "pending", label: "Order Received", mobileLabel: "Received" },
  { key: "preparing", label: "Preparing", mobileLabel: "Preparing" },
  { key: "ready", label: "Ready for Pickup", mobileLabel: "Ready" },
  { key: "completed", label: "Picked Up", mobileLabel: "Picked Up" },
];

const statusLabels: Record<OrderStatus, string> = {
  pending: "Order Received",
  preparing: "Preparing",
  ready: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusPill: Record<OrderStatus, string> = {
  pending: "bg-[#705d48] text-white",
  preparing: "bg-[#e88627] text-[#0d0f13]",
  ready: "bg-[#c08643] text-[#0d0f13]",
  completed: "bg-[#0d0f13] text-white",
  cancelled: "bg-[#ac312d] text-white",
};

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

function statusIndex(status: OrderStatus): number {
  if (status === "pending") return 0;
  if (status === "preparing") return 1;
  if (status === "ready") return 2;
  if (status === "completed") return 3;
  return -1;
}

export default function TrackOrder({ token }: { token: string }) {
  const [data, setData] = useState<TrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchTracking(silent = false) {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError(null);

    const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
    if (!baseUrl) {
      setError("Tracking service is not configured.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await fetch(
        `${baseUrl}/functions/v1/get-order-tracking?token=${encodeURIComponent(token)}`,
      );
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setError(String(body.error ?? "Unable to load tracking details."));
        setData(null);
      } else {
        setData(body as unknown as TrackingPayload);
        setLastUpdated(new Date());
      }
    } catch {
      setError("Unable to load tracking details.");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    document.title = "Track Order - Saiko Ramen & Sushi";
    fetchTracking();
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => fetchTracking(true), 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  const currentStep = useMemo(() => (data ? statusIndex(data.status) : 0), [data]);
  const progressPercent = useMemo(() => {
    if (!data || data.status === "cancelled") return 0;
    return (currentStep / (steps.length - 1)) * 100;
  }, [data, currentStep]);

  return (
    <div className="min-h-screen bg-[#ebe9e6]">
      <TopNav />

      <div className="container py-10 md:py-14 max-w-3xl">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="font-poppins font-bold text-2xl md:text-3xl text-[#0d0f13] uppercase">Track Order</h1>
            <button
              type="button"
              onClick={() => fetchTracking(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#d8d2cb] text-sm font-semibold text-[#0d0f13]"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading && <p className="text-sm text-[#705d48]">Loading tracking details...</p>}
          {error && <p className="text-sm text-[#ac312d]">{error}</p>}

          {!loading && !error && data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <p className="text-lg font-semibold text-[#0d0f13]">Order #{data.order_number}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusPill[data.status]}`}>
                  {statusLabels[data.status]}
                </span>
              </div>

              {data.status === "cancelled" ? (
                <div className="rounded-lg border border-[#ac312d]/30 bg-[#ac312d]/10 p-4 text-sm text-[#ac312d] font-semibold">
                  This order was cancelled. Please contact the store for assistance.
                </div>
              ) : (
                <div className="mb-6">
                  <div className="relative h-2 rounded-full bg-[#ebe9e6]">
                    <div
                      className="absolute left-0 top-0 h-2 rounded-full bg-[#ac312d] transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 sm:gap-2">
                    {steps.map((step, index) => {
                      const done = currentStep >= index;
                      return (
                        <div key={step.key} className="text-center">
                          <div
                            className={`mx-auto mb-1 sm:mb-2 h-5 w-5 sm:h-7 sm:w-7 rounded-full border-2 ${
                              done ? "bg-[#ac312d] border-[#ac312d]" : "bg-white border-[#d8d2cb]"
                            }`}
                          />
                          <p className={`text-[10px] sm:text-xs font-semibold leading-tight ${done ? "text-[#0d0f13]" : "text-[#705d48]"}`}>
                            <span className="sm:hidden">{step.mobileLabel}</span>
                            <span className="hidden sm:inline">{step.label}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-lg border border-[#ebe9e6] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#705d48]">Pickup</p>
                  <p className="text-sm font-semibold text-[#0d0f13] mt-1">{data.pickup}</p>
                </div>
                <div className="rounded-lg border border-[#ebe9e6] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#705d48]">Total</p>
                  <p className="text-sm font-semibold text-[#0d0f13] mt-1">{currencyPhp(Number(data.total))}</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#ebe9e6] p-3 mb-4">
                <p className="text-xs uppercase tracking-wide text-[#705d48] mb-2">Items</p>
                <ul className="space-y-1">
                  {data.items.map((item) => (
                    <li key={`${item.name}-${item.qty}`} className="text-sm text-[#0d0f13]">
                      {item.qty} x {item.name}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-[#705d48] inline-flex items-center gap-1">
                <Clock3 size={13} />
                Last updated {lastUpdated ? lastUpdated.toLocaleTimeString("en-PH") : "-"}
              </p>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-[#ebe9e6]">
            <a href="tel:09178658587" className="text-sm font-semibold text-[#c08643]">
              Need help? Call Saiko at 0917 865 8587
            </a>
            <div className="mt-2">
              <Link href="/menu" className="text-sm text-[#705d48] hover:text-[#ac312d]">
                Back to Menu
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
