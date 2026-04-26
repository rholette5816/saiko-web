import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) return jsonResponse({ error: "Missing token param" }, 400);
  if (!/^[a-zA-Z0-9_-]{12,128}$/.test(token)) {
    return jsonResponse({ error: "Invalid tracking token format" }, 400);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,tracking_token,customer_name,pickup_label,status,total_amount,created_at,updated_at")
    .eq("tracking_token", token)
    .limit(1)
    .maybeSingle();

  if (orderError) return jsonResponse({ error: "Failed to fetch order" }, 500);
  if (!order) return jsonResponse({ error: "Tracking token not found" }, 404);

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("item_name,quantity")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) return jsonResponse({ error: "Failed to fetch order items" }, 500);

  return jsonResponse({
    order_number: order.order_number,
    customer_name: order.customer_name,
    pickup: order.pickup_label,
    status: order.status,
    total: Number(order.total_amount),
    items: (items ?? []).map((item) => ({
      name: item.item_name,
      qty: Number(item.quantity),
    })),
    created_at: order.created_at,
    updated_at: order.updated_at,
  });
});
