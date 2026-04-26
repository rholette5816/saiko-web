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

const ALLOWED_TEMPLATES = ["order_received", "preparing", "ready", "completed"] as const;
type NotifyTemplate = (typeof ALLOWED_TEMPLATES)[number];

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

function parseTemplate(value: unknown): NotifyTemplate {
  if (typeof value !== "string") return "ready";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_TEMPLATES.includes(normalized as NotifyTemplate) ? (normalized as NotifyTemplate) : "ready";
}

function parseForce(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

async function logNotification(
  orderId: string,
  template: NotifyTemplate,
  forced: boolean,
  status: "sent" | "failed" | "skipped",
  errorDetail?: string | null,
) {
  await supabase.from("order_notifications").insert({
    order_id: orderId,
    template,
    was_forced: forced,
    status,
    error_detail: errorDetail ?? null,
  });
}

function buildMessageText(
  template: NotifyTemplate,
  order: {
    customer_name: string;
    order_number: string;
    pickup_label: string;
    total_amount: number | string;
    notes: string | null;
  },
  items: Array<{ item_name: string; quantity: number | string; line_total: number | string }>,
): string {
  const itemsText = items
    .map((item) => `- ${item.item_name} x${Number(item.quantity)} - PHP ${Number(item.line_total).toLocaleString("en-PH")}`)
    .join("\n");

  const total = `PHP ${Number(order.total_amount).toLocaleString("en-PH")}`;
  const commonFooter = order.notes ? `Notes: ${order.notes}\nSee you at Saiko.` : "See you at Saiko.";

  if (template === "order_received") {
    return [
      `Hi ${order.customer_name}, we received your order.`,
      `Order: ${order.order_number}`,
      `Pickup: ${order.pickup_label}`,
      itemsText ? `Items:\n${itemsText}` : "",
      `Total: ${total}`,
      "We will send another update once your order is being prepared.",
      commonFooter,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (template === "preparing") {
    return [
      `Hi ${order.customer_name}, your order is now being prepared.`,
      `Order: ${order.order_number}`,
      `Pickup: ${order.pickup_label}`,
      `Total: ${total}`,
      "We will message you again once it is ready for pickup.",
      commonFooter,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (template === "completed") {
    return [
      `Hi ${order.customer_name}, your order has been marked completed.`,
      `Order: ${order.order_number}`,
      `Total: ${total}`,
      "Thank you for ordering with Saiko.",
      commonFooter,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Hi ${order.customer_name}, your order is ready for pickup.`,
    `Order: ${order.order_number}`,
    `Pickup: ${order.pickup_label}`,
    itemsText ? `Items:\n${itemsText}` : "",
    `Total: ${total}`,
    commonFooter,
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!(await isAuthorized(req))) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: { ref?: unknown; template?: unknown; force?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const ref = typeof payload.ref === "string" ? payload.ref.trim() : "";
  const template = parseTemplate(payload.template);
  const force = parseForce(payload.force);

  if (!ref) return jsonResponse({ error: "Missing ref" }, 400);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", ref)
    .limit(1)
    .maybeSingle();
  if (orderError) return jsonResponse({ error: "Failed to fetch order" }, 500);
  if (!order) return jsonResponse({ error: "Order not found" }, 404);

  if (!order.messenger_psid) {
    await logNotification(order.id, template, force, "failed", "Order has no messenger_psid link");
    return jsonResponse({ error: "Order has no messenger_psid link" }, 400);
  }
  if (!FB_PAGE_ACCESS_TOKEN) {
    await logNotification(order.id, template, force, "failed", "Missing FB_PAGE_ACCESS_TOKEN secret");
    return jsonResponse({ error: "Missing FB_PAGE_ACCESS_TOKEN secret" }, 500);
  }

  if (template === "ready" && order.ready_notified_at && !force) {
    await logNotification(order.id, template, force, "skipped", "Already notified; use force=true to resend");
    return jsonResponse({
      ok: true,
      already_notified: true,
      order_number: order.order_number,
      ready_notified_at: order.ready_notified_at,
    });
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("item_name,quantity,line_total")
    .eq("order_id", order.id);

  const messageText = buildMessageText(
    template,
    {
      customer_name: order.customer_name,
      order_number: order.order_number,
      pickup_label: order.pickup_label,
      total_amount: order.total_amount,
      notes: order.notes,
    },
    (items ?? []) as Array<{ item_name: string; quantity: number | string; line_total: number | string }>,
  );

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
    await logNotification(order.id, template, force, "failed", raw);
    return jsonResponse({ error: "Failed to send Botcake notification", status: notifyRes.status, detail: raw }, 502);
  }

  const nowIso = new Date().toISOString();
  if (template === "ready") {
    await supabase.from("orders").update({ ready_notified_at: nowIso }).eq("id", order.id);
  }
  await logNotification(order.id, template, force, "sent");

  return jsonResponse({
    ok: true,
    sent: true,
    order_number: order.order_number,
    template,
    forced: force,
    messenger_psid: order.messenger_psid,
    ready_notified_at: template === "ready" ? nowIso : order.ready_notified_at,
  });
});
