# Supabase Setup for Saiko

This project uses Supabase as its backend. The migrations under `migrations/`
define the schema. Apply them through the Supabase SQL editor or `supabase db push`
if you have the Supabase CLI linked.

## One-time project setup

1. Create a Supabase project at https://supabase.com (free tier is fine).
2. From Project Settings -> API, copy:
   - Project URL -> `VITE_SUPABASE_URL`
   - anon public key -> `VITE_SUPABASE_ANON_KEY`
   - service_role key -> keep secret, only used by Botcake / admin server-side
3. Add the two `VITE_*` keys to `.env` locally and to Vercel env vars (Production + Preview).
4. Open the SQL editor and run each file in `supabase/migrations/` in order.

## Botcake side (separate)

Botcake reads the `ref` query param when a customer lands in the Messenger
conversation from `m.me/saikoramenandsushi?ref=SAIKO-XXXX`. To fetch the
order, Botcake should call the Supabase REST endpoint:

```
GET https://<project>.supabase.co/rest/v1/orders?order_number=eq.SAIKO-XXXX
Authorization: Bearer <service_role_key>
apikey: <service_role_key>
```

Use service_role for this lookup so RLS doesn't block it. Keep that key
in Botcake's secrets, never in the web bundle.
