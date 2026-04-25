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

## Edge Functions (Botcake-friendly API)

To keep the `service_role` key inside Supabase and make Botcake calls simple,
use these two Edge Functions:

- `GET https://wiutixrypqrlfbandjox.supabase.co/functions/v1/get-order?ref=SAIKO-XXXX`
- `POST https://wiutixrypqrlfbandjox.supabase.co/functions/v1/update-order-status`

Required header for both:

```
x-api-key: <BOTCAKE_API_KEY>
```

### `get-order` request and response

Request:

```
GET /functions/v1/get-order?ref=SAIKO-0001
```

Response (`200`):

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

### `update-order-status` request and response

Request:

```json
POST /functions/v1/update-order-status
{
  "ref": "SAIKO-0001",
  "status": "preparing"
}
```

Response (`200`):

```json
{
  "order_number": "SAIKO-0001",
  "status": "preparing",
  "updated_at": "2026-04-25T16:05:00Z"
}
```

Allowed status values: `pending`, `preparing`, `ready`, `completed`, `cancelled`.

### Dashboard deploy steps

1. Supabase Dashboard -> Edge Functions -> New function -> name it `get-order` -> paste contents of `supabase/functions/get-order/index.ts` -> Deploy.
2. Repeat for `update-order-status` using `supabase/functions/update-order-status/index.ts`.
3. Supabase Dashboard -> Edge Functions -> Secrets -> add `BOTCAKE_API_KEY` (set the value separately and never commit it).
4. Add and deploy `attach-order-contact` from `supabase/functions/attach-order-contact/index.ts`.
5. Add and deploy `notify-order-ready` from `supabase/functions/notify-order-ready/index.ts`.

### Contact link + ready notification

Additional endpoints:

- `POST https://wiutixrypqrlfbandjox.supabase.co/functions/v1/attach-order-contact`
- `POST https://wiutixrypqrlfbandjox.supabase.co/functions/v1/notify-order-ready`

`attach-order-contact` is called by Botcake after referral capture to link Messenger user:

```json
{
  "ref": "SAIKO-0001",
  "messenger_psid": "1234567890123456"
}
```

`notify-order-ready` is called by admin dashboard when marking order as ready:

```json
{
  "ref": "SAIKO-0001"
}
```

Required secrets for ready notification relay:

- `FB_PAGE_ACCESS_TOKEN` (Facebook Page access token used to send Messenger messages)
- `FB_GRAPH_API_VERSION` (optional, defaults to `v20.0`)
