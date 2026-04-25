# Task: phase-1-5-edge-functions

## Goal
Add two Supabase Edge Functions that give Botcake a clean, single-endpoint interface to read and update orders. Both are gated by a shared `x-api-key` header so only Botcake (or anything else holding the secret) can call them.

## Why
The direct Supabase REST API works but forces Botcake to make two calls per order (orders + order_items), parse PostgREST array responses, and manage the service_role key. A pair of purpose-built Edge Functions makes Botcake's HTTP blocks one-line affairs and keeps the service_role key on the Supabase side only.

These same Edge Functions become the home for the Phase 4 AI Report function later, so we're investing in the right infrastructure now.

## Files to modify

### 1. `supabase/README.md`
Append a new section at the end explaining the Edge Functions, their endpoints, the required `BOTCAKE_API_KEY` secret, and Dashboard-based deployment steps. Do not remove existing content.

The new section should cover:
- Endpoint URLs (`https://wiutixrypqrlfbandjox.supabase.co/functions/v1/get-order` and `.../update-order-status`)
- Required header: `x-api-key: <BOTCAKE_API_KEY>`
- Expected request shapes
- Expected response shapes
- Step-by-step Dashboard deploy:
  1. Supabase Dashboard → Edge Functions → New function → name it `get-order` → paste contents of `supabase/functions/get-order/index.ts` → Deploy
  2. Same for `update-order-status`
  3. Edge Functions → Secrets → add `BOTCAKE_API_KEY` (value provided separately, never commit)

## Files to create

### 2. `supabase/functions/_shared/cors.ts`
Tiny shared CORS header helper to avoid duplication across both functions.

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
```

### 3. `supabase/functions/get-order/index.ts`
Deno-runtime Edge Function. Accepts `GET /functions/v1/get-order?ref=SAIKO-XXXX`. Returns the order with its items in a flat shape Botcake can consume directly.

Behavior:
1. Handle `OPTIONS` preflight by returning `ok` with CORS headers.
2. Auth gate: read `x-api-key` header. If missing or does not match `Deno.env.get("BOTCAKE_API_KEY")`, return `401 { "error": "Unauthorized" }`.
3. Read `ref` from URL search params. If missing or empty, return `400 { "error": "Missing ref param" }`.
4. Use service_role Supabase client (created from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars, both auto-injected by Supabase) to:
   - `SELECT * FROM orders WHERE order_number = ref LIMIT 1`
   - If no row, return `404 { "error": "Order not found" }`
   - `SELECT * FROM order_items WHERE order_id = orders.id`
5. Return `200` with a flattened JSON shape:

```json
{
  "order_number": "SAIKO-0001",
  "customer_name": "Juan Dela Cruz",
  "phone": "09171234567",
  "pickup": "Today, 6:30 PM",
  "pickup_time": "2026-04-25T18:30:00Z",
  "is_pre_order": false,
  "status": "pending",
  "total": 1250,
  "notes": "No spicy",
  "items": [
    { "name": "Wagyu Teppan", "qty": 2, "price": 504, "subtotal": 1008 },
    { "name": "Pork Gyoza", "qty": 3, "price": 157, "subtotal": 471 }
  ],
  "created_at": "2026-04-25T15:24:11Z"
}
```

Field mapping:
- `phone` ← `customer_phone`
- `pickup` ← `pickup_label`
- `total` ← `total_amount` (cast to number)
- `items[].name` ← `item_name`
- `items[].qty` ← `quantity`
- `items[].price` ← `unit_price` (cast to number)
- `items[].subtotal` ← `line_total` (cast to number)

All numeric fields must be returned as numbers, not strings. PostgREST returns `numeric(10,2)` as strings by default. Use `Number(...)` to convert.

Response headers must include the CORS headers and `Content-Type: application/json`.

Use the official Deno-compatible Supabase client import:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

Code skeleton (fill in the logic per the behavior above):

```ts
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

  // ... read ref, fetch order, fetch items, return flattened shape
});
```

### 4. `supabase/functions/update-order-status/index.ts`
Deno Edge Function. Accepts `POST /functions/v1/update-order-status` with JSON body `{ "ref": "SAIKO-XXXX", "status": "preparing" }`.

Behavior:
1. CORS preflight handling.
2. Auth gate via `x-api-key` (same pattern as get-order).
3. Method must be `POST`. Otherwise `405`.
4. Parse JSON body. If invalid JSON or missing `ref` or missing `status`, return `400 { "error": "..." }` with a clear message.
5. Validate `status` is one of: `pending`, `preparing`, `ready`, `completed`, `cancelled`. If not, return `400 { "error": "Invalid status" }`.
6. `UPDATE orders SET status = <status> WHERE order_number = <ref>` and select the updated row.
7. If no row updated, return `404 { "error": "Order not found" }`.
8. Return `200 { "order_number": ..., "status": ..., "updated_at": ... }`.

Use the same client + CORS imports as `get-order`. Use the same `jsonResponse` helper pattern.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific overrides for this task:
- These files are Deno-flavored TypeScript and live outside `client/src/`. They will NOT be compiled by `npx tsc --noEmit` (the client tsconfig excludes `supabase/`). That is correct and expected.
- Do not import from `@/` or any client-side path inside these files. Edge Functions are isolated.
- Do not add any client-side files.
- Do not touch `package.json`, `vite.config.ts`, or anything inside `client/`.

## Reference patterns
- Existing Supabase wrapper: `client/src/lib/supabase.ts` (uses anon key, persistSession off). Edge Functions use service_role and the same `persistSession: false` shape, but in Deno not browser.

## Acceptance criteria
- [ ] `grep -rn "[—–]" supabase` returns nothing
- [ ] `supabase/functions/_shared/cors.ts` exists and exports `corsHeaders`
- [ ] `supabase/functions/get-order/index.ts` exists
- [ ] `supabase/functions/update-order-status/index.ts` exists
- [ ] `grep -n "x-api-key" supabase/functions/get-order/index.ts` returns at least one match
- [ ] `grep -n "x-api-key" supabase/functions/update-order-status/index.ts` returns at least one match
- [ ] `grep -n "BOTCAKE_API_KEY" supabase/functions/get-order/index.ts` returns at least one match
- [ ] `grep -n "BOTCAKE_API_KEY" supabase/functions/update-order-status/index.ts` returns at least one match
- [ ] `grep -n "esm.sh/@supabase/supabase-js" supabase/functions` returns matches in both function files
- [ ] `npx tsc --noEmit` passes (the client project, unchanged)
- [ ] `supabase/README.md` contains a new "Edge Functions" section with deploy instructions and endpoint signatures

## Out of scope
- Deploying the functions. Ken does this manually via Supabase Dashboard.
- Setting the `BOTCAKE_API_KEY` secret. Ken does this in Dashboard.
- Any changes to client-side code. Phase 1 already redirects to Messenger; Botcake will handle the rest.
- Phase 2 admin auth, Phase 3 dashboard, Phase 4 AI report. Separate specs.
- Calling these functions from anywhere in the saiko_web codebase. They are Botcake-facing only for now.

## Notes for Codex
- Edge Functions in Supabase use Deno, not Node. Imports use full URLs (`https://esm.sh/...`), not bare specifiers. Deno's standard library types differ from Node. Do not import `node:` modules.
- `Deno.env.get("KEY")` returns `string | undefined`. Use `?? ""` or `!` (with documented assumption that Supabase auto-injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`).
- `Deno.serve(handler)` is the modern entry point. Do not use the older `serve` import from `std/http/server.ts`.
- PostgREST returns `numeric` columns as strings. Convert to numbers via `Number(value)` before responding.
- Keep both functions under 100 lines each. Concise and readable beats clever.
- Do not add tests in this round.
- If a TypeScript-aware linter complains about Deno globals (like `Deno`), that is expected and harmless. The function will run correctly in the Supabase runtime.
