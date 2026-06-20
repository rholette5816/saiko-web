# Task: table-order-consolidation-phase1

## Goal
A table's entire dine-in visit becomes ONE order (one `order_number`, one OR number) from the first item submitted until it's billed out, no matter how many times staff hit "Submit Round."

## Why
Today `place_table_round` inserts a brand new `orders` row every single time staff submit a round, so one table visit accumulates multiple order numbers and multiple OR numbers (the bill currently shows an OR range like "12 to 15" instead of one number). This is wrong for receipt/BIR purposes and confusing for staff.

## Explicitly out of scope for this task
Merging multiple physical tables into one bill (family across T5/T6/T7) is a SEPARATE follow-up task, not part of this one. Do not add a `linked_tables` column, do not add merge/unmerge RPCs, do not add any merge UI. This task is only about consolidating rounds within a single table into one order.

## Schema changes — new migration file `supabase/migrations/<next_number>_order_rounds_consolidation.sql`

1. **New table `order_rounds`** — represents what a "round" used to mean as a whole `orders` row:
   ```sql
   create table if not exists order_rounds (
     id uuid primary key default gen_random_uuid(),
     order_id uuid not null references orders(id) on delete cascade,
     round_no integer not null,
     notes text,
     subtotal numeric not null default 0,
     status text not null default 'active' check (status in ('active','cancelled')),
     kitchen_ticket_printed_at timestamptz,
     kitchen_ticket_print_count integer not null default 0,
     bar_ticket_printed_at timestamptz,
     bar_ticket_print_count integer not null default 0,
     created_at timestamptz not null default now(),
     unique (order_id, round_no)
   );
   alter table order_rounds enable row level security;
   ```
   Add RLS policies mirroring the shape used for `item_overrides`/`menu_items` in earlier migrations: anon gets no access (table_orders are an admin-only concern), authenticated gets full select/insert/update. Read `supabase/migrations/20260618_011_table_orders.sql` and `supabase/migrations/20260620_014_table_round_management.sql` first and match their exact style (security definer, search_path, grants) for everything in this file.

2. **`order_items` gets a new nullable `round_id uuid references order_rounds(id)`** column, additive only. Do NOT remove or repurpose the existing `order_id` column on `order_items` — leave it pointing at the parent `orders` row as it does today, so anything outside this task (Daily Report, analytics, any other reads) that joins on `order_items.order_id` keeps working unchanged. `round_id` is purely additive.

## RPC changes (same migration file)

1. **`place_table_round(p_table_number text, p_subtotal numeric, p_notes text, p_items jsonb)`** — change behavior:
   - Look for an existing order where `table_number = trim(p_table_number) and status in ('preparing','ready')`.
   - If found: compute `next_round_no` = `coalesce(max(round_no),0)+1` for that `order_id` in `order_rounds`; insert the new `order_rounds` row with that round_no and the given `p_notes`; insert `order_items` for it (set both `order_id` AND the new `round_id`); recompute the parent `orders.subtotal`/`total_amount` as the sum of `subtotal` across that order's `active` `order_rounds`; recompute `vatable_sales`/`vat_amount` off the new total the same way the existing code does (look at how `close_table_bill` computes these for the VAT formula to reuse).
   - If not found: insert a brand-new `orders` row exactly as today (gets the one `order_number`/`or_number` via column defaults), then create round_no = 1 in `order_rounds` with `p_notes`, insert items with both `order_id` and `round_id` set.
   - Return shape changes: `returns table (order_id uuid, order_number text, or_number text, round_id uuid, vatable_sales numeric, vat_amount numeric)` — the new `round_id` is needed by the frontend for per-round ticket actions immediately after submit.

2. **`update_table_round_items(p_round_id uuid, p_items jsonb)`** — rename the parameter from `p_order_id` to `p_round_id` (use `drop function if exists update_table_round_items(uuid, jsonb);` before recreating with the new signature to avoid an ambiguous-overload error). Validate the `order_rounds` row exists, has `status = 'active'`, and its parent `orders.status in ('preparing','ready')` (raise exception "Order is not open" otherwise, matching the existing error message style). Replace `order_items` for that `round_id` (keep `order_id` populated too on the new rows, pointing at the round's parent order). Recompute the round's own `subtotal` from its items, then recompute the parent order's `subtotal`/`total_amount`/`vatable_sales`/`vat_amount` as the sum across all that order's active rounds. Clear `kitchen_ticket_printed_at`/`kitchen_ticket_print_count` and `bar_ticket_printed_at`/`bar_ticket_print_count` on the **round** row (not the order) so it shows "Pending" again.

3. **`cancel_table_round(p_round_id uuid, p_reason text)`** — rename the parameter from `p_order_id` to `p_round_id` (drop and recreate signature like above). Validate the round is `active` and parent order is open. Sets `order_rounds.status = 'cancelled'` and appends the `[cancelled:<reason>|<timestamp>]` tag (same encoding `cancel_table_round` already uses today, just write it to `order_rounds.notes` instead of the parent order's notes — each round now owns its own notes/tag history). Recompute the parent order's `subtotal`/`total_amount`/`vatable_sales`/`vat_amount` excluding cancelled rounds (same aggregation as item #2).

4. **`transfer_table_round(p_round_id uuid, p_new_table_number text)`** — for this phase, keep the existing per-round-id parameter naming pattern but it now needs to move the ENTIRE parent order (all its rounds), since a round can no longer belong to a different table than its sibling rounds. Look up the round's `order_id`, validate that order is open, validate `p_new_table_number` is non-blank and differs from the order's current `table_number`, validate no OTHER open order already has that `table_number`. Update `table_number` on the **order** row (not anything on the round). Return the updated order row as jsonb.

5. **`close_table_bill(p_table_number, p_payment_method, p_amount_received, p_senior_pwd, p_senior_pwd_id, p_senior_pwd_name)`** — lookup stays `table_number = trim(p_table_number)` (no merge logic in this phase). There is now exactly one open order per table, not a set of rows. Build `v_rounds` (the per-round breakdown returned for the printed bill) from `order_rounds` (status = 'active') for that one order, joined to their `order_items` via `round_id`, instead of from multiple `orders` rows. Aggregate `v_subtotal` from those active rounds. Set `status = 'completed'` on that one `orders` row (unchanged from today otherwise).

Grant `execute` on all changed functions to `authenticated`, revoke from `public`, matching the existing migrations' exact pattern.

## Frontend changes

### `client/src/pages/admin/TableOrder.tsx`
This file already has Edit/Cancel/Move-table support from a prior task — read the current state of this file in FULL before changing it, since the round-fetching, ticket-printing, and billing logic all need to shift from "rounds = orders rows for this table" to "rounds = order_rounds rows under this table's one open order."

- **Loading rounds**: instead of querying `orders` directly filtered by `table_number` (today's `openRounds`), first resolve the table's one open order (`table_number = this table`, `status in ('preparing','ready')`), then fetch its `order_rounds` (status = 'active', ordered by `round_no`) with nested `order_items` (joined via `round_id`). This becomes the new `openRounds` equivalent — keep the `RoundWithItems` shape as close to identical as possible (it's already keyed by an `id`, just that `id` now refers to an `order_rounds.id` instead of an `orders.id`) so the rest of the rendering code (ticket actions, edit, cancel) needs minimal changes. Store the resolved parent `order_id` in a small piece of state too (needed for Move Table and for `handleBillOut`/`handleConfirmCloseBill` if they need it).
- **Submit Round** → calls the updated `place_table_round`, now also receives `round_id` in the response (use it instead of the old per-round `order_id` wherever the round's own id was being tracked for ticket actions right after submit).
- **Edit Round / Cancel Round** → pass `round_id` instead of the old order id to `update_table_round_items` / `cancel_table_round`.
- **Move Table** → now moves the whole order. Call the updated `transfer_table_round` (still takes a round id per its new signature, but moves the entire parent order server-side) — or simplify the frontend call to pass any one active round's id from the currently loaded set, since they all share the same parent order. Update the button's confirm copy to say it moves the entire table's order, not just one round, since that's now accurate.
- **Bill Out / Settle & Close** — `handleBillOut` and `handleConfirmCloseBill` currently call RPCs keyed by `table.id`. `close_table_bill` is unchanged in its calling signature for this phase, so these should keep working once the round-loading rewrite above is in place — just verify the existing `hasBilledOut` gating and `allRequiredTicketsPrinted` checks still read correctly against the new round shape (they iterate `openRounds` checking `ticketPrintedAt`/etc., which should still work since `RoundWithItems`'s shape is preserved).

### `client/src/components/TableBill.tsx`
- The `rangeLabel` helper currently turns multiple OR numbers into a range string ("12 to 15"). Under the new model there is exactly one OR number per bill, so `orRange`/`orderRange` will naturally collapse to a single value once `props.rounds` reflects `order_rounds` instead of multiple `orders` rows (each round under one order shares the SAME parent `or_number`/`order_number` now). No code change should be strictly required in `TableBill.tsx` itself since `rangeLabel` already handles the single-value case — just confirm the caller in `TableOrder.tsx` passes the parent order's `or_number`/`order_number` for every round in `BillRound`, not a per-round value (rounds no longer have their own order_number).

## Constraints
- Inherits from `AGENTS.md` (no em dashes, brand colors, no new deps)
- Do NOT add `linked_tables`, merge, or unmerge anything — that is a separate future task, explicitly out of scope here
- Do NOT change `order_items.order_id` usage anywhere outside this feature (Daily Report, analytics, any other reads) — leave those queries untouched, they keep working against `order_id` as before
- Existing Kitchen/Bar ticket printing UI (`RoundTicket.tsx`, `printTicket`, `.print-tickets-root`) stays as-is structurally; only the data feeding it (now sourced from `order_rounds` instead of `orders`) changes
- It's expected and CORRECT that Daily Report / sales-count-style aggregations that count rows in `orders` will now show fewer "orders" per day for dine-in (since multiple rounds collapse into one order) — this is the intended fix, not a regression, do not try to compensate for it elsewhere

## Reference patterns
- Existing migration RPC style: `supabase/migrations/20260618_011_table_orders.sql`, `supabase/migrations/20260620_014_table_round_management.sql`
- Round-state UI, ticket actions, edit/cancel/move UI to extend: `client/src/pages/admin/TableOrder.tsx` (read the full current file before editing)
- Bill receipt rendering: `client/src/components/TableBill.tsx`

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] New migration is syntactically consistent with existing migrations (security definer, search_path, grants, RLS policy shape)
- [ ] Submitting 3 rounds on the same table produces ONE `orders` row with ONE `order_number`/`or_number`, and 3 `order_rounds` rows underneath it
- [ ] Editing a round only affects that round's items and recomputes the parent order's total correctly, resets that round's print status if a ticket was already printed
- [ ] Cancelling a round only affects that round's status and recomputes the parent order's total correctly, excluding cancelled rounds
- [ ] Moving a table moves the entire order (all rounds) to the new table number, old table becomes unoccupied, new table shows the order
- [ ] Settling produces a bill with ONE OR number / ONE order number covering every round on that table
- [ ] No console errors in browser dev mode on `/admin/tables/:id`

## Out of scope
- Merging multiple physical tables into one bill (separate future task, see "Explicitly out of scope" above)
- Any change to the public-facing `/menu` page or non-table order flows (Counter, pickup orders)

## Notes for Codex
- `client/src/pages/admin/TableOrder.tsx` is large (1500+ lines) and already has Edit/Cancel/Move-table UI wired to the OLD per-order-is-a-round model. You are converting that existing UI to point at the new round-under-one-order model, not building it from scratch — preserve existing styling, button placement, and gating patterns (`hasBilledOut`, `canManageBilling`, `roundManagementDisabled`) exactly as they are, just repoint the data/ids they operate on.
- If `place_table_round`'s return shape change breaks the existing TypeScript caller in `TableOrder.tsx` (it currently destructures `order_id`, `order_number`, `or_number`, `vatable_sales`, `vat_amount` from `PlaceTableRoundRow`), update that interface to add `round_id` and use it wherever the per-round id is needed for ticket actions immediately after submit.
