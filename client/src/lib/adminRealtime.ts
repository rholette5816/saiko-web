import { supabase } from "@/lib/supabase";

export interface NewOrderEvent {
  id: string;
  order_number: string;
  created_at: string;
  customer_name?: string;
  channel?: string;
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
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: "channel=eq.web" }, (payload) => {
      const row = payload.new as Record<string, unknown>;
      const order = {
        id: String(row.id ?? ""),
        order_number: String(row.order_number ?? "SAIKO-NEW"),
        created_at: String(row.created_at ?? new Date().toISOString()),
        customer_name: typeof row.customer_name === "string" ? row.customer_name : undefined,
        channel: typeof row.channel === "string" ? row.channel : undefined,
      };
      if (!order.id || order.channel !== "web" || seenOrderIds.has(order.id)) return;
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

export interface NewReservationEvent {
  id: string;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  preferred_table_id: string | null;
  notes: string | null;
  created_at: string;
}

const seenReservationIds = new Set<string>();
const reservationListeners = new Set<(reservation: NewReservationEvent) => void>();

let reservationChannelRef: ReturnType<typeof supabase.channel> | null = null;
let reservationSubscribers = 0;

function ensureReservationChannel() {
  if (reservationChannelRef) return;
  reservationChannelRef = supabase
    .channel("admin-reservations-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "table_reservations" }, (payload) => {
      const row = payload.new as Record<string, unknown>;
      if (typeof row.status === "string" && row.status !== "pending") return;
      const reservation: NewReservationEvent = {
        id: String(row.id ?? ""),
        guest_name: String(row.guest_name ?? ""),
        guest_phone: String(row.guest_phone ?? ""),
        party_size: Number(row.party_size ?? 0),
        reservation_date: String(row.reservation_date ?? ""),
        reservation_time: String(row.reservation_time ?? ""),
        preferred_table_id: typeof row.preferred_table_id === "string" ? row.preferred_table_id : null,
        notes: typeof row.notes === "string" ? row.notes : null,
        created_at: String(row.created_at ?? new Date().toISOString()),
      };
      if (!reservation.id || seenReservationIds.has(reservation.id)) return;
      seenReservationIds.add(reservation.id);
      reservationListeners.forEach((listener) => listener(reservation));
    })
    .subscribe();
}

export function subscribeToReservationInserts(onReservation: (reservation: NewReservationEvent) => void): () => void {
  reservationSubscribers += 1;
  reservationListeners.add(onReservation);
  ensureReservationChannel();

  return () => {
    reservationSubscribers = Math.max(0, reservationSubscribers - 1);
    reservationListeners.delete(onReservation);

    if (reservationSubscribers === 0 && reservationChannelRef) {
      supabase.removeChannel(reservationChannelRef);
      reservationChannelRef = null;
    }
  };
}
