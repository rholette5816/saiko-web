# Task: offline-pos-phase1-counter

## Goal
The Counter (walk-in POS) page keeps working with no internet: it loads from cache, a cashier can build a cart and submit an order, tickets/receipt print immediately with a temporary order number, the order is queued locally, and it auto-syncs to the real backend the moment the connection returns - with a visible banner showing how many orders are pending.

## Why
Saiko's POS depends on Supabase over the network for every order placement, even though all pricing/VAT math already happens client-side before the network call, and ticket/receipt printing is pure client-side DOM rendering. A flaky connection during service currently blocks the cashier outright. This closes that gap for the Counter page specifically (a second task will extend the same primitives to the Tables/dine-in page later - don't touch `TableOrder.tsx` or `Tables.tsx` in this task).

The database side is already done: a new column `client_request_id uuid` exists on `orders` (unique when not null), and `place_counter_order` now accepts an extra trailing param `p_client_request_id uuid default null`. If a row already exists with that id, the function returns the existing order's data instead of inserting again - so calling it twice with the same id is always safe. You do not need to touch any `.sql` file in this task.

## Files to create

- `client/src/lib/offlineStatus.ts` - exports `useOnlineStatus(): boolean`. Initializes from `navigator.onLine`, subscribes to `window.addEventListener("online", ...)` / `("offline", ...)` in a `useEffect`, cleans up listeners on unmount.

- `client/src/lib/offlineQueue.ts` - a plain (non-React) localStorage-backed FIFO queue, key `"saiko-offline-queue"`. Export:
  - `interface QueuedAction { localId: string; type: "counter_order"; payload: Record<string, unknown>; createdAt: string }`
  - `function enqueue(type: QueuedAction["type"], payload: Record<string, unknown>): QueuedAction` - generates `localId` via `crypto.randomUUID()`, appends to the stored array, returns the created entry.
  - `function getQueue(): QueuedAction[]`
  - `function removeFromQueue(localId: string): void`
  - All reads/writes wrapped in try/catch (in case localStorage is full/unavailable); on parse failure, treat queue as empty rather than throwing.

- `client/src/lib/offlineSync.ts` - the sync manager. Exports a hook `useOfflineSync(): { pendingCount: number; isSyncing: boolean; lastError: string | null; syncNow: () => void }`.
  - Keeps `pendingCount` in sync with `getQueue().length`, recomputed after every enqueue/removal (poll on an interval of 2000ms is fine, no need for a pub/sub system).
  - `syncNow()` and an automatic call on the `window` `"online"` event (use `useOnlineStatus` or a raw listener) both trigger `processQueue()`.
  - `processQueue()`: reads the queue, processes entries **one at a time, in order** (never `Promise.all`/parallel - a failed sync must not let later entries run out of order). For each entry of `type: "counter_order"`, call `supabase.rpc("place_counter_order", entry.payload)` (payload already contains every param name place_counter_order expects, including `p_client_request_id`, because Counter.tsx builds it that way - see below). On success, `removeFromQueue(entry.localId)` and continue to the next entry. On failure (network error again, or a real validation error), stop processing immediately, set `lastError` to the error message, and leave the remaining queue untouched for the next sync attempt.
  - Import `supabase` from `@/lib/supabase`.

- `client/src/components/OfflineBanner.tsx` - exports `OfflineBanner()`. Uses `useOnlineStatus()` and `useOfflineSync()`. Renders nothing when online AND `pendingCount === 0` AND no error. Otherwise renders a thin full-width bar (fixed or sticky at the very top, above the existing header) with:
  - Offline + pending > 0: `"Offline - {pendingCount} order(s) queued, will sync automatically"` on a warm warning color (use `#e88627` background per brand colors).
  - Online + `isSyncing`: `"Syncing {pendingCount} pending order(s)..."`.
  - Online + just finished (pendingCount just dropped to 0, briefly): `"All orders synced"` on `#2d7a3e`-ish success tint, auto-hide after ~3s.
  - `lastError` present: show the error text plus a "Retry" button calling `syncNow()`.
  - Match the existing visual language in `client/src/components/AdminLayout.tsx` (the `Wifi`/`WifiOff` indicator around line 520-526) - same font weight/size conventions, brand colors from `AGENTS.md`.

- `client/src/lib/menuCache.ts` - exports:
  - `async function fetchMenuCategoriesCached(scope: "public" | "admin"): Promise<MenuCategory[]>` - tries `fetchMenuCategories(scope)` from `@/lib/menuItems`; on success, store the result in `localStorage` under key `"saiko-menu-cache-" + scope` (JSON, with a timestamp). On failure (network error), read and return the cached value if present; if no cache exists either, rethrow the original error.
  - `async function fetchBusinessSettingsCached(): Promise<BusinessSettings | null>` - same pattern wrapping the same query `useBusinessSettings()` already runs in `client/src/lib/businessSettings.tsx` (`supabase.from("business_settings").select("*").limit(1).maybeSingle()`), cache key `"saiko-business-settings-cache"`.

- `client/src/swRegister.ts` - exports `function registerServiceWorker(): void`. Inside, `if ("serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => undefined); }); }`. Swallow registration errors silently (don't break the app if SW registration fails, e.g. in dev).

- `client/public/sw.js` - hand-written vanilla service worker, no build step, no imports (plain JS, runs as-is). Behavior:
  - `install` event: `event.waitUntil(caches.open("saiko-v1"))` (just open the cache, no precache list - this app's build output has content-hashed filenames that aren't known ahead of time, so this uses a cache-as-you-go strategy instead of precaching).
  - `fetch` event handler:
    - If the request is a navigation request (`event.request.mode === "navigate"`) or for a same-origin static asset (JS/CSS/HTML/image under the app's own origin): try network first; on success, clone the response into the `"saiko-v1"` cache and return it; on failure, return the cached version if one exists, else let the fetch error propagate.
    - If the request URL includes `/rest/v1/menu_items`, `/rest/v1/menu_categories`, or `/rest/v1/business_settings` (Supabase PostgREST GET reads) AND the method is `GET`: same network-first-falling-back-to-cache strategy, cached under the same `"saiko-v1"` cache by full URL.
    - Everything else (POST/PATCH/DELETE requests, RPC calls, anything not matched above): pass through untouched, do not intercept (`return` without calling `event.respondWith(...)`), so order placement and other writes are never silently served from a stale cache.

## Files to modify

- `client/src/main.tsx` - import and call `registerServiceWorker()` from `@/swRegister` once, right after the `createRoot(...).render(...)` call (or before it, either is fine - just call it unconditionally on module load).

- `client/src/components/AdminLayout.tsx` - render `<OfflineBanner />` (import from `@/components/OfflineBanner`) as the very first child inside the root wrapping `<div>` of the component's return statement, before the existing `<header>`. Do not change any existing state/logic in this file - this is purely an additional render.

- `client/src/pages/admin/Counter.tsx`:
  1. Replace the menu-loading `useEffect` (currently calls `fetchMenuCategories("admin")` around line 184-188) to call `fetchMenuCategoriesCached("admin")` from `@/lib/menuCache` instead. Same `.then(setMenuData).catch(...)` shape.
  2. `useBusinessSettings()` itself lives in `client/src/lib/businessSettings.tsx` and is used by multiple pages - **do not modify that file or its hook signature**. Instead, leave `useBusinessSettings()` as-is in Counter.tsx (it already falls back to `DEFAULT_SETTINGS` on no data, which covers the cold-offline-load case reasonably) - this task's caching effort for settings is optional and lower priority than the menu and order-queue work; skip it if it would require changing the shared hook's contract.
  3. Import `useOnlineStatus` from `@/lib/offlineStatus`, `enqueue` from `@/lib/offlineQueue`, `supabase` is already imported.
  4. In `handleSubmit` (currently builds the RPC params object inline around line 440-460): generate `const clientRequestId = crypto.randomUUID();` once near the top of the function (before any early `return`), and add `p_client_request_id: clientRequestId` as one more field in the RPC params object passed to `supabase.rpc("place_counter_order", { ... })`.
  5. Wrap the existing `const { data, error: rpcError } = await supabase.rpc("place_counter_order", { ... })` call in a `try { ... } catch (networkError) { ... }`. Treat the call as a **network failure** (queue it) when either: (a) the call throws (caught by the `catch` block), or (b) it resolves with `rpcError` present and `rpcError.code` is falsy/undefined (a real business-logic error raised by the function always comes back with a Postgres `code`; a network-level failure does not). In the network-failure branch:
     - Build a temporary order number like `` `OFFLINE-${clientRequestId.slice(0, 8).toUpperCase()}` ``.
     - Call `enqueue("counter_order", { ...same params object including p_client_request_id... })`.
     - Construct the same `CompletedOrder` object the success path builds (reuse the existing `finalPricing`/`charge`/etc. local variables already computed earlier in this function), using the temporary order number as `orderNumber` and `null` as `orNumber`.
     - Continue exactly as the success path does after that point: `setPrintingOrder(completed)`, `setLastCompletedOrder(completed)`, `resetForm(false)`, `setSubmitting(false)` - the cashier should see no difference except the order number format.
     - Do NOT show this as an error (`setError(...)`) - this is the expected offline path, not a failure.
  6. When `rpcError.code` IS present (a genuine validation error from the function, e.g. "Order items are required"), keep the existing behavior exactly as-is: `setError(rpcError.message); setSubmitting(false); return;`.

## Constraints
- Inherits from `AGENTS.md` (no em/en dashes, brand colors, no new npm deps, don't touch `vite.config.ts`/`package.json`/`tsconfig.json`/`vercel.json`).
- Do not modify any `.sql` file - the migration is already written and is not part of this task.
- Do not touch `client/src/pages/admin/TableOrder.tsx` or `client/src/pages/admin/Tables.tsx` - that's a separate task.
- Do not modify `client/src/lib/businessSettings.tsx`.
- Do not commit or push - Claude handles that.

## Reference patterns
- Existing print/ticket flow to mimic for "no network call needed once data is in memory": `Counter.tsx`'s `printCounterTicket` function and the `<RoundTicket>`/`<CounterReceipt>` usage near the bottom of the file - unchanged by this task, just confirming the pattern you're extending.
- Existing `Wifi`/`WifiOff` status indicator for visual style reference: `client/src/components/AdminLayout.tsx` around lines 520-526.
- Existing localStorage-pattern precedent (different feature, same idea of storing small JSON in localStorage): `client/src/components/AdminLayout.tsx`'s `UNSEEN_KEY`/`localStorage.setItem(UNSEEN_KEY, JSON.stringify(...))` usage.

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] With Chrome DevTools set to "Offline": loading `/admin/counter` after at least one prior successful online visit still shows the menu (from cache).
- [ ] With DevTools "Offline": adding items and submitting a Counter order does NOT show an error; it immediately shows the receipt/tickets with an order number starting with `OFFLINE-`; `OfflineBanner` shows "1 order(s) queued".
- [ ] Going back online (toggle DevTools network back to "Online") triggers an automatic sync within a few seconds; the banner updates to show syncing then clears; the order now exists in Supabase `orders` with a real `SAIKO-####` order number.
- [ ] Submitting two offline orders in a row, then reconnecting, syncs both in the order they were created (check `created_at` ordering), with no duplicates.
- [ ] A genuine validation error (e.g. submit with the Senior/PWD discount selected but no ID number entered) still shows the existing inline error message and does NOT get queued, online or offline.
- [ ] No console errors in browser dev mode.

## Out of scope
- `TableOrder.tsx` / `Tables.tsx` (Tables/dine-in offline support - separate task, depends on this one).
- `Checkout.tsx` (customer-facing web ordering) - not part of this effort.
- Any new npm dependency, any PWA manifest/icons work, any "Add to Home Screen" UX - just the service worker + queue + banner described above.
- Caching `business_settings` inside `Counter.tsx` itself if it would require changing `useBusinessSettings()`'s contract (see note above) - skip rather than refactor that shared hook.

## Notes for Codex
- The reason validation errors are distinguished by checking `rpcError.code` rather than message text: Postgres/PostgREST always attaches a `code` field to errors raised inside the function body (`raise exception '...'`), while a transport-level network failure has no such field. This is the cleanest signal available without adding any new dependency.
- It's fine (and expected) that an `OFFLINE-XXXXXXXX` order number appears on the printed receipt/tickets while queued - that's intentional, not a bug to fix. It gets replaced with the real order number once synced, but Counter.tsx doesn't need to re-print anything automatically when that happens; the real number will show up in `/admin/orders` once synced.
