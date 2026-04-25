import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Fail loud in dev so we notice missing env config.
  console.warn("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Order placement will fail.");
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: { persistSession: true },
});

export interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_label: string;
  pickup_time: string;
  is_pre_order: boolean;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  total_amount: number;
  messenger_psid?: string | null;
  ready_notified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}
