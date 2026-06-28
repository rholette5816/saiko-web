# Task: offline-pos-phase2-tables

## Goal
The Tables (dine-in) page keeps working with no internet for the safe subset of actions - editing items on a round that's already open, adding another round to a table that's already known-open, and printing kitchen/bar tickets - while the actions that aren't safe to replay blindly (opening a brand-new table, cancelling a round, merging/unmerging/transferring tables, closing the bill) are clearly disabled until the connection is back.

## Why
This builds on the offline infrastructure from `offline-pos-phase1-counter.md` (must be completed first - this task assumes `client/src/lib/offlineStatus.ts`, `client/src/lib/offlineQueue.ts`, `client/src/lib/offlineSync.ts`, and `client/src/components/OfflineBanner.tsx` already exist and work for Counter orders).

Tables is riskier than Counter: several of its RPCs are not idempotent (replaying them after a flaky sync could create a duplicate round, double-cancel something, or corrupt a merge), and some require a live read of server state that can't be trusted from a stale local cache (e.g. "is this table already occupied by another device right now"). Ken explicitly decided: block the risky actions while offline rather than queue them, even though that's less convenient, because the failure mode (a corrupted bill someone has to manually fix) is worse than "please reconnect to do this."

The database side for the one action that IS queued here (`place_table_round`, used both to open a table and to add a round to an already-open one) is already done: `order_rounds` now has a `client_request_id uuid` column (unique when not null), and `place_table_round` accepts a new trailing param `p_client_request_id uuid default null` - calling it twice with the same id is safe, it returns the existing round instead of inserting a second one. You do not need to touch any `.sql` file.

## Files to modify

- `client/src/lib/offlineQueue.ts` (created in phase 1) - widen `QueuedAction["type"]` from `"counter_order"` to `"counter_order" | "table_round" | "table_round_edit" | "table_ticket_print"`. No other changes to this file.

- `client/src/lib/offlineSync.ts` (created in phase 1) - in `processQueue()`, add handling for the three new types alongside the existing `"counter_order"` case (still one item at a time, in order, stop on first failure):
  - `"table_round"`: `supabase.rpc("place_table_round", entry.payload)`.
  - `"table_round_edit"`: `supabase.rpc("update_table_round_items", entry.payload)`.
  - `"table_ticket_print"`: `supabase.rpc("mark_table_ticket_printed", entry.payload)`.
  - After any `"table_round"` or `"table_round_edit"` syncs successfully, dispatch a `window.dispatchEvent(new CustomEvent("saiko:table-round-synced"))` (no detail needed) so `TableOrder.tsx` can refresh its rounds if the cashier still has that table open.

- `client/src/pages/admin/TableOrder.tsx`:
  1. Import `useOnlineStatus` from `@/lib/offlineStatus` and `enqueue` from `@/lib/offlineQueue`. Call `const isOnline = useOnlineStatus();` near the top of the component, alongside the other hooks.
  2. Add a `useEffect` that listens for the `"saiko:table-round-synced"` window event and calls the existing round-loading function (`loadRounds()`, lines 983-1048) again so the UI picks up real round ids/numbers once a queued item syncs. Clean up the listener on unmount.
  3. **`handleSubmitRound`** (lines 1230-1268, RPC call at lines 1240-1245): this function is reused for both "open a new table" (when `!openOrder`, i.e. `openOrder` state - declared line 445 - is null) and "add a round to an already-open table" (when `openOrder` is truthy). Change it so that when `!isOnline`:
     - If `!openOrder` (genuinely opening a new table while offline): do nothing differently than today other than ensuring the calling button is disabled (see step 6) - this path should not be reachable while offline at all.
     - If `openOrder` is truthy (table already known-open): generate `const clientRequestId = crypto.randomUUID();`, call `enqueue("table_round", { p_table_number: table.id, p_subtotal: currentSubtotal, p_notes: composeRoundNotes(selectedWaiter, notes), p_items: buildOrderItemPayload(), p_client_request_id: clientRequestId })`, then update local state exactly the way the success branch of this function does today after a real RPC response - except the round's id is not yet known. Use a locally-generated temporary id (e.g. `` `pending-${clientRequestId}` ``) for the new round's `id` field in whatever local state array holds `openRounds`, and add a `pendingSync: true` flag to that round's local object (extend the round's local TypeScript type with an optional `pendingSync?: boolean` field if needed). Skip calling `loadRounds()` immediately after (it would not see the queued round yet); it'll refresh automatically via the `"saiko:table-round-synced"` listener once synced.
     - When `isOnline` (the common case), behavior is unchanged.
  4. **`handleEditRound`** (lines 1286-1319, RPC call at lines 1300-1303): when `!isOnline`, instead of calling `update_table_round_items` directly, call `enqueue("table_round_edit", { p_round_id: round.id, p_items: buildOrderItemPayload() })` and update the local round's items/subtotal the same way the success path does today. This is safe to allow even on a round that itself has `pendingSync: true` from step 3 - skip that edge case (see Out of scope).
  5. **`markTicketPrinted`** (lines 1096-1108, RPC call at lines 1097-1100): when `!isOnline`, call `enqueue("table_ticket_print", { p_order_id: orderId, p_kind: kind })` instead of calling the RPC directly, and update local print-status state the same way the success path does today (so the ticket still shows "submitted" locally). This function is called from the print flow, not a standalone button - no button gating needed here, it should always succeed locally and queue silently.
  6. **Button gating for the genuinely risky actions** - add `|| !isOnline` (or the equivalent for each button's existing `disabled` expression) to:
     - The round submit/open button (line ~2080-2085): only add the offline condition to the **new-round** path, not the edit path - i.e. `disabled={!orderItems.length || submittingRound || (!editingRound && !waiterName.trim()) || (!editingRound && !isOnline && !openOrder)}` (editing remains enabled offline; opening a brand-new table - `!openOrder` - is blocked offline; adding a round to an already-open table is NOT blocked).
     - Cancel Round button (line ~2385): `disabled={cancellingRoundId === cancelRound.id || !isOnline}`.
     - Merge Table button (line ~2555): `disabled={!selectedMergeTable || merging || !isOnline}`.
     - Unmerge Table button (line ~1800): `disabled={unmergingTable === linkedId || !isOnline}`.
     - Transfer/Move Round button (line ~2472): `disabled={!selectedMoveTable || movingRoundId === moveRound.id || !isOnline}`.
     - Close Bill button (line ~2276): `disabled={closing || billPreview.errors.length > 0 || !isOnline}`.
     - Next to each of these six disabled buttons, render a small inline note `"Needs internet connection"` (reuse whatever small-text/muted style class is already used nearby for hints in this file) when `!isOnline`, so the cashier understands why the button is greyed out rather than assuming it's broken.

## Constraints
- Inherits from `AGENTS.md` (no em/en dashes, brand colors, no new npm deps, don't touch `vite.config.ts`/`package.json`/`tsconfig.json`/`vercel.json`).
- Do not modify any `.sql` file - both migrations this task depends on are already written.
- Do not modify `client/src/pages/admin/Counter.tsx` or `client/src/components/OfflineBanner.tsx` - those are already done in phase 1; this task only adds to the shared `offlineQueue.ts`/`offlineSync.ts` files and changes `TableOrder.tsx`.
- Do not change anything about `close_table_bill`, `merge_table_into_order`, `unmerge_table_from_order`, or `transfer_table_round`'s actual logic - only their button's `disabled` condition.
- Do not commit or push - Claude handles that.

## Reference patterns
- Phase 1's exact pattern for distinguishing a network failure from a real validation error (check `error.code` presence) in `client/src/pages/admin/Counter.tsx`'s `handleSubmit` - mirror that same distinction here if an RPC call fails for a reason other than being offline (i.e. don't suppress real validation errors just because `isOnline` is true).
- `OfflineBanner.tsx` (phase 1) already shows the global pending-count banner - no need to add another banner here, just make sure the new queue entry types feed into the same `pendingCount`.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] With a table that already has an open order/round, going offline (DevTools "Offline") and adding a new round still works: it appears in the UI locally (marked as pending) and the global offline banner's pending count increases.
- [ ] Still offline, editing the items on an already-synced round (not one added while offline) succeeds locally and increases the pending count.
- [ ] Still offline, printing a kitchen/bar ticket for an open round still works (prints locally, no error), and is queued.
- [ ] Still offline, attempting to open a brand-new table (one with no current open order) shows the Submit/Open button disabled with the "Needs internet connection" note.
- [ ] Still offline, the Cancel Round, Merge Table, Unmerge, Transfer/Move Round, and Close Bill buttons are all disabled with the same note.
- [ ] Going back online syncs the queued round and round-edit, after which `loadRounds()` refreshes and the temporary pending round is replaced by the real synced one with no duplicate.
- [ ] No console errors in browser dev mode.

## Out of scope
- Editing, cancelling, or printing a ticket for a round that is itself still `pendingSync: true` (not yet synced) - leave those controls disabled or simply don't worry about that specific combination; it's an acceptable gap, not a bug to fix in this task.
- Any change to the actual close-bill, merge, unmerge, or transfer business logic - only their offline button gating.
- `Tables.tsx` (the table grid overview page) - it has no RPC calls and needs no changes for this task.
- Multi-device awareness (two offline devices touching the same table) - explicitly accepted as a known limitation, not something to solve here.

## Notes for Codex
- `openOrder` (state declared around line 445, set in `loadRounds()` around line 1003) is the existing signal for "does this table currently have a known-open order." Use `!!openOrder` exactly as described above - don't introduce a second way of tracking this.
- If anything about the exact current line numbers has drifted because of other recent edits to `TableOrder.tsx`, search for the function/RPC names called out above rather than trusting the line numbers literally - the function and RPC names are the source of truth, the line numbers are just to help you find them quickly.
