import type { OrderItemRow, OrderRow } from "@/lib/supabase";

function escapeCsvField(value: string): string {
  const normalized = value.replace(/"/g, "\"\"");
  if (/[",\r\n]/.test(normalized)) return `"${normalized}"`;
  return normalized;
}

function joinItems(items?: OrderItemRow[]): string {
  if (!items || items.length === 0) return "";
  return items.map((item) => `${Number(item.quantity)} x ${item.item_name}`).join("; ");
}

export function exportOrdersToCsv(orders: (OrderRow & { items?: OrderItemRow[] })[], filename: string): void {
  const headers = [
    "Order Number",
    "Customer",
    "Phone",
    "Pickup",
    "Items",
    "Total",
    "Status",
    "Created",
  ];
  const rows = orders.map((order) => [
    order.order_number,
    order.customer_name,
    order.customer_phone,
    order.pickup_label,
    joinItems(order.items),
    Number(order.total_amount).toLocaleString("en-PH"),
    order.status,
    new Date(order.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvField(String(value ?? ""))).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
