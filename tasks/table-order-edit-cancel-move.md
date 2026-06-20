# Task: table-order-edit-cancel-move

## Goal
Staff can edit an open round's items, cancel an open round, or move an open round to a different table, all from the Table Order page, before that table is billed out.

## Why
Right now once a round is submitted there is no way to fix a misrung item, cancel an order, or move a customer to a different table without going around the app (directly in Supabase). This causes wrong totals and stuck "occupied" tables. Staff need first-class actions for these three cases, gated the same way billing already is.

## Files to create

- `supabase/migrations/<next_number>_table_round_management.sql` — three new RPCs:

  1. `update_table_round_items(p_order_id uuid, p_items jsonb)` — `security definer`. Validates the order exists and has `status in ('preparing','ready')` (raise exception otherwise, e.g. "Order is not open"). Deletes existing `order_items` rows for `p_order_id` and inserts the new set from `p_items` (same shape as `place_table_round`'s `p_items`: `item_id`, `item_name`, `unit_price`, `quantity`, `line_total`). Recomputes `subtotal`/`total_amount` on the `orders` row from the new items. Clears `kitchen_ticket_printed_at`, `kitchen_ticket_print_count`, `bar_ticket_printed_at`, `bar_ticket_print_count` back to null/0 so the round shows "Pending" again and must be reprinted. Returns the updated order row as jsonb.

  2. `cancel_table_round(p_order_id uuid, p_reason text)` — `security definer`. Validates the order exists and has `status in ('preparing','ready')`. Sets `status = 'cancelled'`. Appends a `[cancelled:<reason>|<now()::text>]` line to the existing `notes` column following the exact same bracket-tag pattern already used for `[waiter:...]` and `[printed:...]` tags in `client/src/pages/admin/TableOrder.tsx`'s `composeRoundNotes`/`parseRoundNotes` functions (read that file's notes-encoding pattern before writing the SQL string concatenation, match it exactly: tag line is appended on its own line, reason has any literal `]` characters stripped or escaped so the tag can't be broken out of). Returns true.

  3. `transfer_table_round(p_order_id uuid, p_new_table_number text)` — `security definer`. Validates the order exists, has `status in ('preparing','ready')`, and `p_new_table_number` is not null/blank and differs from the order's current `table_number`. Updates `table_number = trim(p_new_table_number)`. Returns the updated order row as jsonb. Do not validate `p_new_table_number` against a fixed table list in SQL — the 23-table list (`T1`..`T23`) lives in `client/src/lib/tables.ts` on the frontend; trust the caller.

  Grant `execute` on all three functions to `authenticated` (mirror however `place_table_round`/`close_table_bill` are granted in `supabase/migrations/20260618_011_table_orders.sql` — match that pattern exactly).

## Files to modify

- `client/src/pages/admin/TableOrder.tsx` — this is the main page, already large (1300+ lines). Add:
  - **Edit round**: a new "Edit" button next to each round's existing Kitchen/Bar ticket actions (in `renderTicketAction` area / the round card markup, look for where `renderTicketAction(round, "kitchen")` and `renderTicketAction(round, "bar")` are rendered together). Clicking it opens the existing item-picker UI (the same menu grid + cart used for placing a new order — reuse, don't duplicate) but pre-filled with that round's current `order_items`, and changes the submit button to call a new `handleEditRound(round)` instead of `handleSubmitRound`. On save, call `supabase.rpc("update_table_round_items", { p_order_id: round.id, p_items: [...] })`, then `await loadRounds()`. Disable/hide the Edit button once the table has been billed out (use the same `hasBilledOut` gate already in this file) or once `showCloseModal` flow has started.
  - **Cancel round**: a "Cancel" button (red/outline-red, matches existing button color conventions in this file, e.g. `#ac312d`) per round. Clicking opens a confirm dialog (reuse the existing modal pattern used for `showCloseModal`, or a simpler `window.confirm`-style inline confirm state if a lighter pattern already exists in this file — check before adding a new modal). If `ticketPrintedAt(round, "kitchen") || ticketPrintedAt(round, "bar")` is truthy, the confirm copy must say a VOID ticket will print for whichever ticket(s) were printed. On confirm: call `supabase.rpc("cancel_table_round", { p_order_id: round.id, p_reason: <reason input, default "Cancelled by staff"> })`; if a kitchen and/or bar ticket had been printed, also trigger printing a VOID variant of `RoundTicket` (extend `RoundTicket` with an optional `voided?: boolean` prop that renders `VOID — <kind label>` instead of the normal kind label, reusing the existing print flow / `.print-tickets-root` wrapper, not a new print mechanism). After cancel completes, `await loadRounds()`.
  - **Move table**: a "Move Table" button per round. Clicking opens a small dropdown/select populated from `TABLES` (imported from `@/lib/tables`), excluding the current table. On confirm, call `supabase.rpc("transfer_table_round", { p_order_id: round.id, p_new_table_number: selectedTableId })`, then `navigate(`/admin/tables/${selectedTableId}`)` so staff lands on the destination table. Block this action (disable button, tooltip) once `hasBilledOut` is true, same gating as Edit.
  - Gate all three new buttons with `canManageBilling` exactly like the existing Bill Out / Settle & Close buttons are gated in this file.

- `client/src/components/RoundTicket.tsx` — add optional `voided?: boolean` prop. When true, render the ticket-kind line as `VOID - {ticketLabel}` (or similar clear void marker) instead of the normal label, keep everything else (items, table, order number) the same so kitchen/bar can see what's being voided.

## Constraints
- Inherits from `AGENTS.md` (no em dashes, brand colors, no new deps)
- Do not touch billing/settle logic (`handleBillOut`, `handleConfirmCloseBill`, `close_table_bill` RPC) beyond what's needed to gate the new buttons off after bill out
- Do not change the menu item picker UI/component itself, only how it's invoked (reused for both new-order and edit-round flows)
- Keep the existing notes-tag encoding pattern (`[waiter:...]`, `[printed:...]`) consistent, don't introduce a different encoding style for the new `[cancelled:...]` tag
- Do not add a generic toast/notification library; reuse whatever inline error/success message pattern already exists in this file (`error`, `closeError` state)

## Reference patterns
- RPC call pattern + error handling: `handleSubmitRound`, `handleConfirmCloseBill` in `client/src/pages/admin/TableOrder.tsx`
- Notes tag encoding: `composeRoundNotes`, `parseRoundNotes` in the same file
- Existing migration RPC style (security definer, grants, status filtering): `supabase/migrations/20260618_011_table_orders.sql`
- Ticket printing flow: `printTicket`, `.print-tickets-root` wrapper, `RoundTicket` component
- Billing gate pattern to copy for Edit/Move disabling: `hasBilledOut` state and the disabled/title props on the Settle & Close button

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] New migration SQL file is syntactically consistent with the existing migration's style (security definer, search_path, grants)
- [ ] Editing a round with no printed tickets updates items/subtotal with no reprint requirement
- [ ] Editing a round with an already-printed ticket resets that ticket's printed status back to "Pending"
- [ ] Cancelling a round with no printed tickets just sets status to cancelled, no ticket prints
- [ ] Cancelling a round with a printed ticket prompts for confirmation and prints a VOID ticket
- [ ] Moving a round to another table updates `table_number` and the round disappears from the original table's open rounds list
- [ ] All three new buttons are disabled once `hasBilledOut` is true for that table
- [ ] No console errors in browser dev mode on `/admin/tables/:id`

## Out of scope
- Editing/cancelling/moving a round after it has been settled (status `completed`) — those are closed, not editable
- Bulk move (moving an entire table's worth of rounds at once) — one round at a time only
- Any change to the public-facing `/menu` page or customer-facing flows

## Notes for Codex
- This file is large; read the full `client/src/pages/admin/TableOrder.tsx` before editing so the new buttons match existing spacing/styling conventions (colors like `#ac312d`, `#c08643`, `#0d0f13`, button height `h-9`/`h-11` patterns, etc.) rather than introducing new ones.
- The item-picker/cart UI used for placing a new round already exists somewhere in this file (look for where `orderItems`, `addToOrder`, `categories.map` render the menu grid for the current screen) — reuse it for Edit instead of building a second picker.
- `hasBilledOut` and `allRequiredTicketsPrinted` are existing gates in this file; new buttons should respect them the same way Bill Out / Settle & Close already do.
