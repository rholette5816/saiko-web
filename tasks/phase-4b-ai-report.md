# Task: phase-4b-ai-report

> REVISED for current codebase state. The in-flight tracking_token system, FB Messenger notifications, realtime admin alerts, and migrations 001-007 are not modified by this spec. Promo data (Phase 4A migration 008) is read conditionally if present.

## Goal
Add an admin-only "Generate AI Report" feature on the Dashboard. Click the button → backend Supabase Edge Function pulls orders + items + (if available) promo activity in the selected date range, calls Gemini, returns a structured restaurant performance report in Markdown. Admin sees it inline and can print it to PDF via the browser.

## Why
The data is already in Supabase from Phases 1-3. The owner wants weekly/monthly performance summaries without manually tabulating sales. This phase adds the prompt construction, the LLM call, and a clean way to display + print the result. The Gemini API key lives only in Supabase Edge Function secrets, never in the browser bundle.

## Critical compatibility notes (read first)

- The Edge Function name `generate-report` is currently free (existing functions are `_shared`, `attach-order-contact`, `get-order`, `get-order-tracking`, `notify-order`, `notify-order-ready`, `update-order-status`).
- This is admin-only. Auth is the admin's session JWT (from `supabase.auth.getSession()`). It does NOT use `BOTCAKE_API_KEY` or Page tokens.
- This is read-only. It does not modify any tables. Safe to ship even if Phase 4A is not yet executed.
- The function reads `promo_code` and `discount_amount` from `orders` if those columns exist (Phase 4A); if they don't, the promo section of the report is omitted gracefully.

## Files to modify

### 1. `client/src/pages/admin/Dashboard.tsx`
Add the AI report controls below the existing KPI cards and charts. Keep all existing dashboard content intact (date range selector, KPIs, charts, recent orders list, realtime alerts).

**Imports (add):**
- `Sparkles` from lucide-react
- `import { ReportMarkdown } from "@/components/ReportMarkdown";`

**State (add near existing state):**
```ts
const [reportLoading, setReportLoading] = useState(false);
const [reportError, setReportError] = useState<string | null>(null);
const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
const [reportRange, setReportRange] = useState<{ from: string; to: string; label: string } | null>(null);
```

**Button placement:**
Add a `Generate AI Report` button in the date-range row (or directly above the charts — match the existing layout style). Use the `Sparkles` icon. Disable while `reportLoading`. Show "Generating report..." with a small spinner during loading.

**Handler:**
```ts
async function handleGenerateReport() {
  setReportLoading(true);
  setReportError(null);
  setReportMarkdown(null);
  const range = getRange(activeRangeKey); // existing helper from dateRanges.ts
  try {
    const { data, error } = await supabase.functions.invoke("generate-report", {
      body: { from: range.startIso, to: range.endIso, label: range.label },
    });
    if (error) throw error;
    if (!data?.report) throw new Error("Report came back empty");
    setReportMarkdown(data.report);
    setReportRange({ from: range.startIso, to: range.endIso, label: range.label });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    setReportError(`Could not generate report: ${detail}`);
  } finally {
    setReportLoading(false);
  }
}
```

**Display section:**
When `reportMarkdown` is set, render below the charts inside a `print-report` container:

```tsx
{reportMarkdown && (
  <section id="ai-report" className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mt-8 print-report">
    <div className="flex items-center justify-between mb-4 print-hide flex-wrap gap-3">
      <div>
        <h2 className="font-poppins font-bold text-xl uppercase tracking-wide text-[#0d0f13]">
          AI Report
        </h2>
        <p className="text-sm text-[#705d48]">
          {reportRange?.label} · Generated {new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#0d0f13] text-white text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-black transition-colors"
        >
          Print / Save as PDF
        </button>
        <button
          type="button"
          onClick={() => setReportMarkdown(null)}
          className="px-4 py-2 bg-white border border-[#0d0f13] text-[#0d0f13] text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-[#ebe9e6] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
    <ReportMarkdown markdown={reportMarkdown} />
  </section>
)}
```

When `reportError` is set, render a small inline alert above the report area in `text-[#ac312d]`.

**Print CSS (add a `<style>` block at the top of the JSX returned by `Dashboard`, or inject into `index.css`):**
- `@media print { body { background: white; } .print-hide { display: none !important; } body > *:not(.print-report-root) { display: none !important; } .print-report { box-shadow: none; padding: 0; } }`
- Or simpler: use `@media print` to hide everything inside `AdminLayout` except `.print-report`, by adding a shared print rule.

The exact print CSS approach is your call as long as printing the page produces a clean report-only output. Reference `client/src/pages/admin/PrintSlip.tsx` for the existing print pattern.

### 2. `client/src/lib/supabase.ts`
No code change needed. `supabase.functions.invoke` is already available on the existing client. Confirm only.

## Files to create

### 3. `client/src/components/ReportMarkdown.tsx`
Lightweight inline Markdown renderer (no external dep). Handles a small subset that's sufficient for our report shape: headings (`#`, `##`, `###`), bold (`**...**`), bullets (`-`), numbered lists (`1.`), paragraph breaks.

Skeleton:

```tsx
interface Props { markdown: string }

export function ReportMarkdown({ markdown }: Props) {
  const blocks = parseBlocks(markdown);
  return (
    <div className="text-[#0d0f13] leading-relaxed">
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
}

// Implement parseBlocks and renderBlock with a tiny state machine. Keep file under 150 lines total.
// Block types: h1, h2, h3, paragraph, bullet-list, numbered-list.
// Inline: bold via **...**.
// Heading classes:
//   h1 -> "font-poppins font-bold text-2xl mt-6 mb-3 uppercase tracking-wide text-[#0d0f13]"
//   h2 -> "font-poppins font-bold text-xl mt-5 mb-2 uppercase tracking-wide text-[#0d0f13]"
//   h3 -> "font-poppins font-bold text-lg mt-4 mb-2 text-[#0d0f13]"
// Paragraph: "mb-3 text-[#0d0f13]"
// Lists: ul list-disc list-inside / ol list-decimal list-inside, with li mb-1.
```

Do NOT introduce `react-markdown`, `marked`, or any other Markdown dep.

## Files to create (Edge Function)

### 4. `supabase/functions/generate-report/index.ts`
Deno Edge Function. Auth via admin session JWT. Pulls orders + items in range, computes metrics, builds prompt, calls Gemini, returns Markdown.

**Auth:**
- Read `Authorization: Bearer <jwt>`
- Verify with `supabase.auth.getUser(token)`
- 401 if missing/invalid

**Request body:**
```ts
{ from: string; to: string; label: string }
// from/to are UTC ISO strings (start inclusive, end exclusive)
// label is human-readable (e.g., "Last 7 Days")
```

**Response body:**
```ts
{ report: string; metrics: { ... } }
```

**Behavior:**
1. CORS preflight handling.
2. Validate auth (admin JWT). 401 if invalid.
3. Validate body shape. 400 if missing fields.
4. Pull orders in range with embedded items: `supabase.from("orders").select("*, order_items(*)").gte("created_at", from).lt("created_at", to)`.
5. Compute metrics:
   - `totalOrders`, `completedCount`, `cancelledCount`, `cancellationRate`
   - `grossSales` (sum of `total_amount` where status != cancelled)
   - `completedSales` (sum where status = completed)
   - `avgOrderValue` (grossSales / non-cancelled count, or 0 when denominator is 0)
   - `itemPerformance`: top 10 items by completed-only revenue. Each: `{ name, qty, revenue }`. Aggregate from embedded `order_items`.
   - `peakHours`: bucket completed orders by hour-of-day in Asia/Manila. Return array of `{ hour, count }`.
   - `peakDays`: bucket completed orders by day-of-week in Asia/Manila. Return array of `{ dayName, count }`.
   - `promoUsage`: ONLY if `promo_code` field exists on the order rows AND any orders in range have a non-null `promo_code`. Aggregate: `{ code, times_used, discount_total }`. If no rows have promo data (because Phase 4A is not yet shipped, or no orders used a promo), set this to an empty array.
6. Build a Gemini prompt that includes the metrics. Use `gemini-1.5-flash`.
7. Call Gemini REST API:
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=<GEMINI_API_KEY>
   Content-Type: application/json
   Body: {
     "contents": [{ "parts": [{ "text": "<prompt>" }] }],
     "generationConfig": { "temperature": 0.4, "maxOutputTokens": 1200 }
   }
   ```
8. Extract `candidates[0].content.parts[0].text`. If blocked (safety filter) or empty, return 502 with `{ error: "Report blocked or empty. Try again." }`.
9. Return 200 `{ report, metrics }` as JSON.

**Prompt template (build dynamically):**
```
You are a restaurant analytics consultant for Saiko Ramen & Sushi, a Japanese restaurant in Oton, Iloilo, Philippines. Your audience is the owner who wants a clear, actionable performance summary.

DATE RANGE: {label} ({from} to {to}, Asia/Manila)

METRICS:
- Total orders: {totalOrders}
- Completed: {completedCount}
- Cancelled: {cancelledCount} ({cancellationRate}%)
- Gross sales: PHP {grossSales}
- Completed sales: PHP {completedSales}
- Average order value: PHP {avgOrderValue}

TOP 10 DISHES BY REVENUE:
{itemPerformance as markdown table or bullet list}

PEAK HOURS (completed orders):
{peakHours as bullet list}

PEAK DAYS (completed orders):
{peakDays as bullet list}

PROMO USAGE:
{promoUsage as bullet list, OR omit this section entirely if empty}

WRITE A REPORT WITH THESE SECTIONS:
## Executive Summary
2-3 sentences. State the headline numbers and overall trend (positive, neutral, concerning).

## Sales Performance
Reflect on gross vs completed sales. Note cancellation rate and what it implies.

## What's Working
The standout dishes from the top 10. Be specific. Use peso figures.

## What Needs Attention
Underperformers (low revenue items). Cancelled orders if the rate is high.

## When People Order
Peak hours and days. Suggest staffing or prep timing implications.

{If promoUsage is non-empty, include this section:}
## Promo Effectiveness
Comment on uptake and discount given.

## Three Recommendations
Number them 1-2-3. Each must be:
- Concrete (specific action)
- Cheap to test
- Tied to the data above

CONSTRAINTS:
- Use Markdown headings (## for sections).
- Use **bold** for key numbers.
- Keep the whole report under 600 words.
- Filipino-friendly tone but stay professional.
- Do NOT use em dashes (—) or en dashes (–). Use periods or commas.
- Currency format: PHP 1,234 (no decimals).
- Do not invent data. If a section has no data, say so briefly.
```

**Code skeleton:**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  // Auth
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!GEMINI_KEY) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);

  // Body
  let body: { from?: string; to?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  if (!body.from || !body.to || !body.label) {
    return jsonResponse({ error: "Missing from, to, or label" }, 400);
  }

  // Pull orders + items
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", body.from)
    .lt("created_at", body.to);
  if (ordersErr) return jsonResponse({ error: ordersErr.message }, 500);

  const metrics = computeMetrics(orders ?? [], body.from, body.to);
  const prompt = buildPrompt(body.label, body.from, body.to, metrics);
  const report = await callGemini(prompt);

  return jsonResponse({ report, metrics });
});

// Implement computeMetrics, buildPrompt, callGemini below as helpers.
// Numeric values from PostgREST come back as strings; cast with Number().
// Use Intl.DateTimeFormat with timeZone "Asia/Manila" for hour/day bucketing.
// callGemini does fetch() to the Gemini REST endpoint. Surface clean errors via thrown Error.
```

Keep the file under 300 lines. Use `Number()` to cast numeric fields. Promo aggregation must gracefully handle the case where the column doesn't exist (try/catch around the lookup, or check `if ("promo_code" in order && order.promo_code)`).

## Files to delete
None.

## Constraints
Inherits from `AGENTS.md`. Specific:
- **No new npm dependencies.** No `react-markdown`, no `marked`, no PDF libraries. Use the browser's print + the new `ReportMarkdown.tsx` minimal renderer.
- Edge Function uses the existing `_shared/cors.ts` helper.
- The `GEMINI_API_KEY` lives ONLY in Supabase Edge Function secrets, never in `.env`, never in the codebase.
- Brand colors only.
- **Do not modify** the in-flight TrackOrder, get-order-tracking, notify-order, attach-order-contact, lib/adminRealtime, OR migrations 001-007.

## Reference patterns
- Existing Edge Function with admin JWT: `supabase/functions/notify-order/index.ts` (it has dual auth; use only the JWT branch for this function)
- Existing Edge Function pattern: `supabase/functions/get-order/index.ts`
- Print styling: `client/src/pages/admin/PrintSlip.tsx`
- Date range helpers: `client/src/lib/dateRanges.ts`
- Admin Dashboard component: `client/src/pages/admin/Dashboard.tsx`
- Supabase function invoke pattern: `supabase.functions.invoke("name", { body: {...} })` auto-attaches the admin's session JWT

## Acceptance criteria
- [ ] `grep -rn "[—–]" client/src supabase` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `client/src/components/ReportMarkdown.tsx` exists and exports `ReportMarkdown`
- [ ] `supabase/functions/generate-report/index.ts` exists
- [ ] `grep -n "supabase.auth.getUser" supabase/functions/generate-report/index.ts` returns at least one match
- [ ] `grep -n "GEMINI_API_KEY" supabase/functions/generate-report/index.ts` returns at least one match
- [ ] `grep -n "generativelanguage.googleapis.com" supabase/functions/generate-report/index.ts` returns at least one match
- [ ] `grep -n "Generate AI Report" client/src/pages/admin/Dashboard.tsx` returns at least one match
- [ ] `grep -n "@media print" client/src/pages/admin/Dashboard.tsx` returns at least one match (or in a shared print stylesheet)
- [ ] No new npm dependencies in `package.json`
- [ ] No changes to files outside this spec's scope (verify with `git diff --name-only` before completing)

## Out of scope
- Saving generated reports to a database table for history (V2)
- Scheduling automatic weekly reports (V2 — would need pg_cron)
- Emailing the report to the owner (V2)
- A separate `/admin/reports` page or list of past reports
- Multi-language reports
- Image generation
- Any change to public pages, hero, footer, cart, checkout, menu, tracking page
- Any change to existing Edge Functions (notify-order, get-order, etc.)
- Any change to migrations 001-007

## Notes for Codex
- Gemini's `gemini-1.5-flash` is fast and cheap. Do not switch to `pro` unless instructed.
- Lower temperature (0.4) keeps the report data-focused.
- If Gemini returns a `safetyRatings` block instead of content, return a clean error: `"Report blocked by content filter. Try again."`
- The "active range" on the Dashboard is held in component state. The handler must use that exact state value.
- The inline Markdown renderer should be intentionally simple. Six block types max. Bold inline. No links, no images, no tables (Gemini can format tables as bullet lists in the prompt).
- Print/Save as PDF uses `window.print()`. Browser's print dialog has "Save as PDF" built in on every modern OS.
- Use `supabase.functions.invoke("generate-report", { body: {...} })` from the client. It auto-attaches the JWT.
- The existing `corsHeaders` already include `authorization, x-api-key, content-type`.
- Promo data graceful handling: when there are no promos used in the range, OMIT the "PROMO USAGE" section from the prompt entirely. Do NOT pass an empty list with a header — that wastes tokens and makes Gemini write a "no promo data" paragraph that's not useful.
- Codex MUST NOT touch the in-flight uncommitted files (TrackOrder.tsx, get-order-tracking, notify-order, attach-order-contact, lib/adminRealtime, migrations 006-007). Verify by running `git diff --name-only` before completing.
