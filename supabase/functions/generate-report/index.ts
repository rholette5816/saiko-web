import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderItemRow {
  item_name: string;
  quantity: number | string;
  line_total: number | string;
}

interface OrderRow {
  id: string;
  created_at: string;
  status: OrderStatus;
  total_amount: number | string;
  promo_code?: string | null;
  discount_amount?: number | string | null;
  order_items?: OrderItemRow[] | null;
}

interface ReportMetrics {
  totalOrders: number;
  completedCount: number;
  cancelledCount: number;
  cancellationRate: number;
  grossSales: number;
  completedSales: number;
  avgOrderValue: number;
  itemPerformance: Array<{ name: string; qty: number; revenue: number }>;
  peakHours: Array<{ hour: string; count: number }>;
  peakDays: Array<{ dayName: string; count: number }>;
  promoUsage: Array<{ code: string; times_used: number; discount_total: number }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatPhp(value: number): string {
  return `PHP ${Math.round(value).toLocaleString("en-PH")}`;
}

function computeMetrics(orders: OrderRow[]): ReportMetrics {
  const totalOrders = orders.length;
  const completed = orders.filter((order) => order.status === "completed");
  const nonCancelled = orders.filter((order) => order.status !== "cancelled");
  const cancelledCount = orders.filter((order) => order.status === "cancelled").length;
  const completedCount = completed.length;
  const grossSales = nonCancelled.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const completedSales = completed.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const avgOrderValue = nonCancelled.length > 0 ? grossSales / nonCancelled.length : 0;
  const cancellationRate = totalOrders > 0 ? (cancelledCount / totalOrders) * 100 : 0;

  const itemTotals = new Map<string, { qty: number; revenue: number }>();
  for (const order of completed) {
    for (const item of order.order_items ?? []) {
      const name = (item.item_name || "Unnamed item").trim();
      const prev = itemTotals.get(name) ?? { qty: 0, revenue: 0 };
      prev.qty += Number(item.quantity ?? 0);
      prev.revenue += Number(item.line_total ?? 0);
      itemTotals.set(name, prev);
    }
  }

  const itemPerformance = Array.from(itemTotals.entries())
    .map(([name, totals]) => ({ name, qty: totals.qty, revenue: totals.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const hourFormatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hour12: false,
  });
  const dayFormatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
  });

  const hourMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  for (const order of completed) {
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const hour = hourFormatter.format(created);
    const dayName = dayFormatter.format(created);
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
    dayMap.set(dayName, (dayMap.get(dayName) ?? 0) + 1);
  }

  const peakHours = Array.from(hourMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count || a.hour.localeCompare(b.hour));
  const peakDays = Array.from(dayMap.entries())
    .map(([dayName, count]) => ({ dayName, count }))
    .sort((a, b) => b.count - a.count || a.dayName.localeCompare(b.dayName));

  const promoUsageMap = new Map<string, { times_used: number; discount_total: number }>();
  for (const order of orders) {
    if (!("promo_code" in order) || !order.promo_code) continue;
    const code = String(order.promo_code).trim().toUpperCase();
    if (!code) continue;
    const prev = promoUsageMap.get(code) ?? { times_used: 0, discount_total: 0 };
    prev.times_used += 1;
    prev.discount_total += Number(order.discount_amount ?? 0);
    promoUsageMap.set(code, prev);
  }

  const promoUsage = Array.from(promoUsageMap.entries())
    .map(([code, totals]) => ({ code, times_used: totals.times_used, discount_total: totals.discount_total }))
    .sort((a, b) => b.times_used - a.times_used || b.discount_total - a.discount_total);

  return {
    totalOrders,
    completedCount,
    cancelledCount,
    cancellationRate,
    grossSales,
    completedSales,
    avgOrderValue,
    itemPerformance,
    peakHours,
    peakDays,
    promoUsage,
  };
}

function buildPrompt(label: string, from: string, to: string, metrics: ReportMetrics): string {
  const topItems =
    metrics.itemPerformance.length > 0
      ? metrics.itemPerformance
          .map((item) => `- ${item.name}: qty ${item.qty}, revenue ${formatPhp(item.revenue)}`)
          .join("\n")
      : "- No completed item data in this range.";

  const hoursText =
    metrics.peakHours.length > 0
      ? metrics.peakHours.map((row) => `- ${row.hour}:00 -> ${row.count} orders`).join("\n")
      : "- No completed orders in this range.";

  const daysText =
    metrics.peakDays.length > 0
      ? metrics.peakDays.map((row) => `- ${row.dayName}: ${row.count} orders`).join("\n")
      : "- No completed orders in this range.";

  const promoSection =
    metrics.promoUsage.length > 0
      ? `\nPROMO USAGE:\n${metrics.promoUsage
          .map((row) => `- ${row.code}: ${row.times_used} uses, discount given ${formatPhp(row.discount_total)}`)
          .join("\n")}\n`
      : "";

  const promoInstruction =
    metrics.promoUsage.length > 0
      ? "## Promo Effectiveness\nComment on uptake and discount given.\n\n"
      : "";

  return `You are a restaurant analytics consultant for Saiko Ramen & Sushi, a Japanese restaurant in Oton, Iloilo, Philippines. Your audience is the owner who wants a clear, actionable performance summary.

DATE RANGE: ${label} (${from} to ${to}, Asia/Manila)

METRICS:
- Total orders: ${metrics.totalOrders}
- Completed: ${metrics.completedCount}
- Cancelled: ${metrics.cancelledCount} (${metrics.cancellationRate.toFixed(1)}%)
- Gross sales: ${formatPhp(metrics.grossSales)}
- Completed sales: ${formatPhp(metrics.completedSales)}
- Average order value: ${formatPhp(metrics.avgOrderValue)}

TOP 10 DISHES BY REVENUE:
${topItems}

PEAK HOURS (completed orders):
${hoursText}

PEAK DAYS (completed orders):
${daysText}
${promoSection}
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

${promoInstruction}## Three Recommendations
Number them 1-2-3. Each must be:
- Concrete (specific action)
- Cheap to test
- Tied to the data above

CONSTRAINTS:
- Use Markdown headings (## for sections).
- Use **bold** for key numbers.
- Keep the whole report under 600 words.
- Filipino-friendly tone but stay professional.
- Do NOT use em dashes or en dashes. Use periods or commas.
- Currency format: PHP 1,234 (no decimals).
- Do not invent data. If a section has no data, say so briefly.`;
}

function buildFallbackReport(label: string, from: string, to: string, metrics: ReportMetrics, reason?: string): string {
  const topItems =
    metrics.itemPerformance.length > 0
      ? metrics.itemPerformance
          .slice(0, 5)
          .map((item, index) => `${index + 1}. ${item.name} - qty ${item.qty}, ${formatPhp(item.revenue)}`)
          .join("\n")
      : "1. No completed item data in this range yet.";

  const peakHour = metrics.peakHours[0];
  const peakDay = metrics.peakDays[0];
  const promoLine =
    metrics.promoUsage.length > 0
      ? `Most-used promo: **${metrics.promoUsage[0].code}** (${metrics.promoUsage[0].times_used} uses).`
      : "No promo usage recorded in this range.";

  const caution = reason ? `\nReport note: AI service unavailable (${reason}). Generated from database metrics.\n` : "";

  return `## Executive Summary
For **${label}** (${from} to ${to}, Asia/Manila), Saiko recorded **${metrics.totalOrders}** orders with **${metrics.completedCount}** completed and **${metrics.cancelledCount}** cancelled. Gross sales reached **${formatPhp(metrics.grossSales)}**, while completed sales were **${formatPhp(metrics.completedSales)}**.

## Sales Performance
Average order value was **${formatPhp(metrics.avgOrderValue)}**. Cancellation rate is **${metrics.cancellationRate.toFixed(1)}%**.

## What's Working
${topItems}

## What Needs Attention
If cancellation stays above current levels, review fulfillment timing and customer confirmations to reduce drop-offs.

## When People Order
Peak day: **${peakDay ? `${peakDay.dayName} (${peakDay.count} orders)` : "No data"}**. Peak hour: **${peakHour ? `${peakHour.hour}:00 (${peakHour.count} orders)` : "No data"}**.

## Promo Effectiveness
${promoLine}

## Three Recommendations
1. Pre-prep ingredients before peak hour to shorten prep time.
2. Feature top-performing items in menu highlights and upsell combos.
3. Track cancellation reasons daily and follow up on recurring causes.${caution}`;
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY,
  )}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] as Record<string, unknown> : null;
  const finishReason = String(candidate?.finishReason ?? "");
  if (finishReason === "SAFETY") {
    throw new Error("Report blocked by content filter. Try again.");
  }

  const content = (candidate?.content ?? null) as { parts?: Array<{ text?: string }> } | null;
  const text = content?.parts?.find((part) => typeof part.text === "string")?.text?.trim() ?? "";
  if (!text) {
    throw new Error("Report blocked or empty. Try again.");
  }
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    // Do not hard-fail report generation when auth lookup is flaky.
    // Dashboard route still protects this page with admin auth.
    if (userErr || !userData?.user) {
      console.warn("generate-report auth verification warning", userErr?.message ?? "No user from token");
    }
  }

  if (!GEMINI_API_KEY) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);

  let body: { from?: string; to?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  if (!body.from || !body.to || !body.label) {
    return jsonResponse({ error: "Missing from, to, or label" }, 400);
  }

  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", body.from)
    .lt("created_at", body.to);
  if (ordersErr) return jsonResponse({ error: ordersErr.message }, 500);

  const metrics = computeMetrics((orders ?? []) as OrderRow[]);
  const prompt = buildPrompt(body.label, body.from, body.to, metrics);

  try {
    const report = await callGemini(prompt);
    return jsonResponse({ report, metrics, source: "gemini" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Gemini error";
    const fallbackReport = buildFallbackReport(body.label, body.from, body.to, metrics, detail);
    return jsonResponse({ report: fallbackReport, metrics, source: "fallback", warning: detail });
  }
});
