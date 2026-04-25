import type { CartItem } from "./cart";

export interface OrderForm {
  name: string;
  phone: string;
  pickupLabel: string;
  notes?: string;
}

function formatLine(item: CartItem): string {
  const total = item.price * item.quantity;
  return `${item.quantity}x ${item.name} - PHP ${total.toLocaleString()}`;
}

export function formatOrderText(items: CartItem[], form: OrderForm): string {
  const total = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const lines: string[] = [
    "SAIKO PICKUP ORDER",
    "",
    `For: ${form.name}`,
    `Phone: ${form.phone}`,
    `Pickup: ${form.pickupLabel}`,
    "",
    "Items:",
    ...items.map(formatLine),
    "",
    `Total: PHP ${total.toLocaleString()}`,
  ];
  if (form.notes && form.notes.trim()) {
    lines.push("", `Notes: ${form.notes.trim()}`);
  }
  return lines.join("\n");
}
