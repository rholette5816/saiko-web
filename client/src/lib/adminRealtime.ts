import { supabase } from "@/lib/supabase";

export interface NewOrderEvent {
  id: string;
  order_number: string;
  created_at: string;
  customer_name?: string;
}

export type LiveStatus = "connecting" | "live" | "offline";

const seenOrderIds = new Set<string>();
const orderListeners = new Set<(order: NewOrderEvent) => void>();
const statusListeners = new Set<(status: LiveStatus) => void>();

let liveStatus: LiveStatus = "offline";
let channelRef: ReturnType<typeof supabase.channel> | null = null;
let subscribers = 0;

function notifyStatus(nextStatus: LiveStatus) {
  liveStatus = nextStatus;
  statusListeners.forEach((listener) => listener(nextStatus));
}

function ensureChannel() {
  if (channelRef) return;
  notifyStatus("connecting");
  channelRef = supabase
    .channel("admin-orders-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
      const row = payload.new as Record<string, unknown>;
      const order = {
        id: String(row.id ?? ""),
        order_number: String(row.order_number ?? "SAIKO-NEW"),
        created_at: String(row.created_at ?? new Date().toISOString()),
        customer_name: typeof row.customer_name === "string" ? row.customer_name : undefined,
      };
      if (!order.id || seenOrderIds.has(order.id)) return;
      seenOrderIds.add(order.id);
      orderListeners.forEach((listener) => listener(order));
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") notifyStatus("live");
      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        notifyStatus("offline");
      }
    });
}

export function subscribeToOrderInserts(
  onOrder: (order: NewOrderEvent) => void,
  onStatus?: (status: LiveStatus) => void,
): () => void {
  subscribers += 1;
  orderListeners.add(onOrder);
  if (onStatus) {
    statusListeners.add(onStatus);
    onStatus(liveStatus);
  }
  ensureChannel();

  return () => {
    subscribers = Math.max(0, subscribers - 1);
    orderListeners.delete(onOrder);
    if (onStatus) statusListeners.delete(onStatus);

    if (subscribers === 0 && channelRef) {
      supabase.removeChannel(channelRef);
      channelRef = null;
      notifyStatus("offline");
    }
  };
}
