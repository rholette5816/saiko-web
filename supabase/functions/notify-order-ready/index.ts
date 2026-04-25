import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const API_KEY = Deno.env.get("BOTCAKE_API_KEY") ?? "";
const FB_PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN") ?? "";
const FB_GRAPH_API_VERSION = Deno.env.get("FB_GRAPH_API_VERSION") ?? "v20.0";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey && apiKey === API_KEY) return true;

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!(await isAuthorized(req))) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: { ref?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const ref = typeof payload.ref === "string" ? payload.ref.trim() : "";
  if (!ref) return jsonResponse({ error: "Missing ref" }, 400);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", ref)
    .limit(1)
    .maybeSingle();
  if (orderError) return jsonResponse({ error: "Failed to fetch order" }, 500);
  if (!order) return jsonResponse({ error: "Order not found" }, 404);
  if (order.status !== "ready") return jsonResponse({ error: "Order is not ready yet" }, 400);
  if (order.ready_notified_at) {
    return jsonResponse({
      ok: true,
      already_notified: true,
      order_number: order.order_number,
      ready_notified_at: order.ready_notified_at,
    });
  }
  if (!order.messenger_psid) return jsonResponse({ error: "Order has no messenger_psid link" }, 400);
  if (!FB_PAGE_ACCESS_TOKEN) return jsonResponse({ error: "Missing FB_PAGE_ACCESS_TOKEN secret" }, 500);

  const { data: items } = await supabase
    .from("order_items")
    .select("item_name,quantity,line_total")
    .eq("order_id", order.id);

  const itemsText = (items ?? [])
    .map((item) => `• ${item.item_name} x${Number(item.quantity)} - PHP ${Number(item.line_total).toLocaleString("en-PH")}`)
    .join("\n");
  const messageText = [
    `Hi ${order.customer_name}, your order is ready for pickup.`,
    `Order: ${order.order_number}`,
    `Pickup: ${order.pickup_label}`,
    itemsText ? `Items:\n${itemsText}` : "",
    `Total: PHP ${Number(order.total_amount).toLocaleString("en-PH")}`,
    order.notes ? `Notes: ${order.notes}` : "",
    "See you at Saiko.",
  ]
    .filter(Boolean)
    .join("\n");

  const graphUrl = new URL(`https://graph.facebook.com/${FB_GRAPH_API_VERSION}/me/messages`);
  graphUrl.searchParams.set("access_token", FB_PAGE_ACCESS_TOKEN);

  const notifyRes = await fetch(graphUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: order.messenger_psid },
      messaging_type: "MESSAGE_TAG",
      tag: "POST_PURCHASE_UPDATE",
      message: { text: messageText },
    }),
  });

  if (!notifyRes.ok) {
    const raw = await notifyRes.text();
    return jsonResponse({ error: "Failed to send Botcake notification", status: notifyRes.status, detail: raw }, 502);
  }

  const nowIso = new Date().toISOString();
  await supabase.from("orders").update({ ready_notified_at: nowIso }).eq("id", order.id);

  return jsonResponse({
    ok: true,
    sent: true,
    order_number: order.order_number,
    messenger_psid: order.messenger_psid,
    ready_notified_at: nowIso,
  });
});
