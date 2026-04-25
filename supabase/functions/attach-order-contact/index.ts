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
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== API_KEY) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: { ref?: unknown; messenger_psid?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const ref = typeof payload.ref === "string" ? payload.ref.trim() : "";
  const messengerPsid = typeof payload.messenger_psid === "string" ? payload.messenger_psid.trim() : "";
  if (!ref) return jsonResponse({ error: "Missing ref" }, 400);
  if (!messengerPsid) return jsonResponse({ error: "Missing messenger_psid" }, 400);

  const { data, error } = await supabase
    .from("orders")
    .update({ messenger_psid: messengerPsid })
    .eq("order_number", ref)
    .select("order_number,messenger_psid")
    .maybeSingle();

  if (error) return jsonResponse({ error: "Failed to link order contact" }, 500);
  if (!data) return jsonResponse({ error: "Order not found" }, 404);

  return jsonResponse({
    order_number: data.order_number,
    messenger_psid: data.messenger_psid,
    linked: true,
  });
});
