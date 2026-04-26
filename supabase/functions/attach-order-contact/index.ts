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

function pickString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== API_KEY) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    const raw = await req.json();
    payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Accept common aliases so Botcake field naming mismatches do not break linking.
  const ref = pickString(payload, ["ref", "order_number", "orderNumber", "reference"]);
  const messengerPsid = pickString(payload, ["messenger_psid", "psid", "messengerPsid", "subscriber_id", "contact_id"]);
  if (!ref) {
    return jsonResponse(
      { error: "Missing ref", accepted_keys: ["ref", "order_number", "orderNumber", "reference"] },
      400,
    );
  }
  if (!messengerPsid) {
    return jsonResponse(
      {
        error: "Missing messenger_psid",
        accepted_keys: ["messenger_psid", "psid", "messengerPsid", "subscriber_id", "contact_id"],
      },
      400,
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ messenger_psid: messengerPsid })
    .eq("order_number", ref)
    .select("order_number,messenger_psid")
    .maybeSingle();

  if (error) return jsonResponse({ error: "Failed to link order contact" }, 500);
  if (!data) return jsonResponse({ error: "Order not found" }, 404);

  return jsonResponse({
    ok: true,
    order_number: data.order_number,
    messenger_psid: data.messenger_psid,
    linked: true,
  });
});
