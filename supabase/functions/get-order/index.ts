import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const API_KEY = Deno.env.get("BOTCAKE_API_KEY") ?? "";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== API_KEY) return jsonResponse({ error: "Unauthorized" }, 401);
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const ref = new URL(req.url).searchParams.get("ref")?.trim();
  if (!ref) return jsonResponse({ error: "Missing ref param" }, 400);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", ref)
    .limit(1)
    .maybeSingle();

  if (orderError) return jsonResponse({ error: "Failed to fetch order" }, 500);
  if (!order) return jsonResponse({ error: "Order not found" }, 404);

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  if (itemsError) return jsonResponse({ error: "Failed to fetch order items" }, 500);

  return jsonResponse({
    order_number: order.order_number,
    customer_name: order.customer_name,
    phone: order.customer_phone,
    pickup: order.pickup_label,
    pickup_time: order.pickup_time,
    is_pre_order: order.is_pre_order,
    status: order.status,
    total: Number(order.total_amount),
    notes: order.notes,
    items: (items ?? []).map((item) => ({
      name: item.item_name,
      qty: Number(item.quantity),
      price: Number(item.unit_price),
      subtotal: Number(item.line_total),
    })),
    created_at: order.created_at,
  });
});
