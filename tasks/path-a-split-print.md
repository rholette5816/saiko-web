# Task: path-a-split-print

## Goal
Replace the single auto-print after Submit Round with a success card that shows two separate print buttons: **Print Kitchen Ticket** and **Print Bar Ticket**. Each button opens its own print dialog with the appropriate ticket type only and a clear dialog title so staff knows which printer to pick.

## Why
Saiko has separate kitchen and bar printers. The current implementation prints both kitchen and bar tickets in one print job to one printer, which doesn't match the workflow. Splitting into two explicit print actions lets staff route each ticket to the correct physical printer. Browser print dialog titles ("KITCHEN TICKET" / "BAR TICKET") tell staff which printer to pick the first time, and the browser remembers the choice for next time.

## Critical compatibility notes
- Affects only the Submit Round flow on `client/src/pages/admin/TableOrder.tsx`.
- The Close & Bill flow (consolidated `TableBill`) is NOT changed. It still auto-prints one dialog.
- The `RoundTicket` component itself is NOT changed (it already accepts `kind: "kitchen" | "bar"` and renders accordingly).
- The walk-in Counter page (`Counter.tsx`) is NOT changed.
- No schema changes, no migration, no RPC changes.

## Files to modify

### 1. `client/src/pages/admin/TableOrder.tsx`

The current Submit Round handler does something like:
1. Calls `place_table_round` RPC
2. Sets state with the kitchen + bar items for this round
3. Triggers a single `window.print()` that prints both tickets via page-break

Refactor to:
1. RPC call unchanged
2. After success, set a `printingRound` state with the round data (already happens)
3. **Do NOT auto-call window.print()**. Instead, render a success card in the right panel with two action buttons.

**State changes:**
The existing `printingRound` state stays. It holds `{ orderNumber, orNumber, table, kitchenItems, barItems, createdAt, notes }`.

Add a derived helper that returns which buttons should be enabled:
```ts
const canPrintKitchen = (printingRound?.kitchenItems.length ?? 0) > 0;
const canPrintBar = (printingRound?.barItems.length ?? 0) > 0;
```

**New helper to print one ticket type:**
```ts
function printTicket(kind: "kitchen" | "bar") {
  if (!printingRound) return;
  const previousTitle = document.title;
  document.title = kind === "kitchen" ? "KITCHEN TICKET" : "BAR TICKET";
  setActivePrintKind(kind);
  // Give React a moment to render before opening the dialog.
  setTimeout(() => {
    window.print();
    // Restore title after print dialog closes (best-effort)
    setTimeout(() => {
      document.title = previousTitle;
      setActivePrintKind(null);
    }, 100);
  }, 50);
}
```

Add a `[activePrintKind, setActivePrintKind] = useState<"kitchen" | "bar" | null>(null)` state.

**Conditional render of RoundTicket components:**
The page should render BOTH tickets at all times when `printingRound` is set, BUT use a CSS rule to show only the `activePrintKind` during print:

```tsx
{printingRound && (
  <div className="round-print-area">
    {canPrintKitchen && (
      <div className={`round-print-${activePrintKind === "kitchen" || activePrintKind === null ? "visible" : "hidden"}`}>
        <RoundTicket
          kind="kitchen"
          tableNumber={...}
          capacity={...}
          orderNumber={printingRound.orderNumber}
          orNumber={printingRound.orNumber}
          items={printingRound.kitchenItems}
          notes={printingRound.notes}
          createdAt={printingRound.createdAt}
        />
      </div>
    )}
    {canPrintBar && (
      <div className={`round-print-${activePrintKind === "bar" || activePrintKind === null ? "visible" : "hidden"}`}>
        <RoundTicket
          kind="bar"
          tableNumber={...}
          capacity={...}
          orderNumber={printingRound.orderNumber}
          orNumber={printingRound.orNumber}
          items={printingRound.barItems}
          notes={printingRound.notes}
          createdAt={printingRound.createdAt}
        />
      </div>
    )}
  </div>
)}
```

**Print scoping CSS:**
Add an inline `<style>` block or extend the existing one with:
```css
@media print {
  .round-print-hidden { display: none !important; }
}
.round-print-area { display: none; }
@media print {
  .round-print-area { display: block; }
}
```

Actually simpler approach: use `activePrintKind` to wrap the BOTH-or-ONE rendering. When `activePrintKind` is null, both tickets render in the on-screen success card. When `activePrintKind` is set, only that one renders in a print-scoped container.

Either pattern is acceptable as long as the result is: when staff taps Print Kitchen, the print dialog shows ONLY the kitchen ticket (not both, not the bar).

**Success card UI:**
After a successful Submit Round, replace the current auto-print and any prior success card with this card in the right panel (or as a modal — either works, match the existing style):

```tsx
{printingRound && (
  <div className="bg-white border border-[#d8d2cb] rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Check size={18} className="text-[#2d7a3e]" />
      <p className="font-semibold text-[#0d0f13]">
        Round saved. Order #{printingRound.orderNumber} · OR {printingRound.orNumber}
      </p>
    </div>
    <p className="text-xs text-[#705d48]">
      Print each ticket to its assigned printer.
    </p>
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={!canPrintKitchen}
        onClick={() => printTicket("kitchen")}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#ac312d] text-white text-sm font-bold uppercase tracking-wide disabled:bg-[#d8d2cb] disabled:text-[#705d48] disabled:cursor-not-allowed"
      >
        🍳 Kitchen Ticket
      </button>
      <button
        type="button"
        disabled={!canPrintBar}
        onClick={() => printTicket("bar")}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#c08643] text-white text-sm font-bold uppercase tracking-wide disabled:bg-[#d8d2cb] disabled:text-[#705d48] disabled:cursor-not-allowed"
      >
        🍹 Bar Ticket
      </button>
    </div>
    <button
      type="button"
      onClick={() => setPrintingRound(null)}
      className="w-full px-3 py-2 rounded-lg border border-[#0d0f13] text-[#0d0f13] text-xs font-semibold uppercase tracking-wide"
    >
      Done
    </button>
  </div>
)}
```

(The emojis are intentional here per Ken's request; allowed in this UI block only. Do not add emojis elsewhere.)

**Disabled state:** when a category has no items, that button is disabled. Visually muted (`bg-[#d8d2cb] text-[#705d48]`).

**Done button:** dismisses the success card so staff can start the next round.

**Remove the previous auto-print call:**
Find any direct `window.print()` invocation that ran after Submit Round and delete it. The new flow ONLY prints when the user taps a button.

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- No new npm dependencies.
- Brand colors only. The emojis in the two print buttons are an explicit exception for this task.
- Do not modify `RoundTicket.tsx` itself. The component already supports `kind`.
- Do not modify `TableBill.tsx`.
- Do not modify `Counter.tsx` or `CounterReceipt.tsx`.
- Do not modify any RPC, migration, or schema.

## Reference patterns
- Existing successful-submit card style: see Counter.tsx for the "Order completed" toast/banner pattern.
- Existing print pattern: the `@media print` rules in RoundTicket already hide page chrome.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `grep -n "printTicket" client/src/pages/admin/TableOrder.tsx` returns at least one match
- [ ] `grep -n "Kitchen Ticket" client/src/pages/admin/TableOrder.tsx` returns at least one match
- [ ] `grep -n "Bar Ticket" client/src/pages/admin/TableOrder.tsx` returns at least one match
- [ ] `grep -c "window.print" client/src/pages/admin/TableOrder.tsx` returns 1 (only inside `printTicket`; no auto-print after Submit)
- [ ] The Counter page (`Counter.tsx`) is NOT modified
- [ ] `RoundTicket.tsx` is NOT modified
- [ ] `TableBill.tsx` is NOT modified

## Out of scope
- Settings UI for printer names (Phase 7B-prep, separate spec)
- QZ Tray integration (Phase 7B, separate spec)
- Auto-chained printing via `afterprint` event
- Changing the Close & Bill flow

## Notes for Codex
- The button emojis 🍳 and 🍹 are intentional. They survive on thermal printers as Unicode glyphs on most modern printers, but more importantly they make the on-screen buttons unmistakable for staff.
- The `document.title` swap is the cleanest way to tell the browser print dialog which ticket type this is. Browser print dialogs show the page title in the header.
- The `setTimeout` delay before `window.print()` gives React a tick to commit the new `activePrintKind` state so the conditional render takes effect before the dialog opens.
- After the print dialog closes, the second `setTimeout` restores the original title. This is best-effort; some browsers don't fire reliable events for dialog close, but the next title change overrides anyway.
- If staff dismisses one ticket without printing it (just taps Done), that's allowed. They can re-print from the existing rounds list if needed (existing functionality stays).
- Verify with `git diff --name-only` before completing — diff should only include `TableOrder.tsx`.
- Override for this session: you ARE allowed to git add, commit, and push to origin/master after the acceptance checks pass. Commit message: `Path A: split kitchen/bar tickets into separate print actions`.
