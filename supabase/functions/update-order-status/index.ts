import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const API_KEY = Deno.env.get("BOTCAKE_API_KEY") ?? "";
const ALLOWED_STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"] as const;
type OrderStatus = (typeof ALLOWED_STATUSES)[number];

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
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let payload: { ref?: unknown; status?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const ref = typeof payload.ref === "string" ? payload.ref.trim() : "";
  const status = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : "";
  if (!ref) return jsonResponse({ error: "Missing ref" }, 400);
  if (!status) return jsonResponse({ error: "Missing status" }, 400);
  if (!ALLOWED_STATUSES.includes(status as OrderStatus)) {
    return jsonResponse({ error: "Invalid status" }, 400);
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("order_number", ref)
    .select("order_number,status,updated_at")
    .maybeSingle();

  if (error) return jsonResponse({ error: "Failed to update order" }, 500);
  if (!data) return jsonResponse({ error: "Order not found" }, 404);

  return jsonResponse({
    order_number: data.order_number,
    status: data.status,
    updated_at: data.updated_at,
  });
});
