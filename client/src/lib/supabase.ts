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
  tracking_token?: string;
  customer_name: string;
  customer_phone: string;
  pickup_label: string;
  pickup_time: string;
  is_pre_order: boolean;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  total_amount: number;
  promo_code?: string | null;
  subtotal?: number | null;
  discount_amount?: number | null;
  channel?: "web" | "counter" | null;
  payment_method?: string | null;
  amount_received?: number | null;
  or_number?: string | null;
  vat_amount?: number | null;
  vatable_sales?: number | null;
  vat_exempt_sales?: number | null;
  senior_pwd_discount?: number | null;
  senior_pwd_id?: string | null;
  senior_pwd_name?: string | null;
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

export interface ItemOverrideRow {
  item_id: string;
  is_available: boolean;
  is_best_seller: boolean;
  updated_at: string;
}

export interface PromoCodeRow {
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  business_tin: string | null;
  business_address: string | null;
  business_contact: string | null;
  vat_registered: boolean;
  vat_rate: number;
  or_prefix: string;
  or_next_number: number;
  receipt_footer: string | null;
  is_bir_accredited: boolean;
  updated_at: string;
}
