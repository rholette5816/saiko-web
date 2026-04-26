import type { CartItem } from "./cart";

export interface OrderForm {
  name: string;
  phone: string;
  pickupLabel: string;
  notes?: string;
  promoCode?: string | null;
  subtotal?: number;
  discountAmount?: number;
}

function formatLine(item: CartItem): string {
  const total = item.price * item.quantity;
  return `${item.quantity}x ${item.name} - PHP ${total.toLocaleString()}`;
}

export function formatOrderText(items: CartItem[], form: OrderForm): string {
  const total = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const subtotal = typeof form.subtotal === "number" ? form.subtotal : total;
  const discountAmount = typeof form.discountAmount === "number" ? form.discountAmount : 0;
  const hasPromo = Boolean(form.promoCode && discountAmount > 0);
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
    ...(hasPromo
      ? [
          `Subtotal: PHP ${subtotal.toLocaleString()}`,
          `Promo: ${String(form.promoCode).trim()} (-PHP ${discountAmount.toLocaleString()})`,
        ]
      : []),
    `Total: PHP ${(subtotal - discountAmount).toLocaleString()}`,
  ];
  if (form.notes && form.notes.trim()) {
    lines.push("", `Notes: ${form.notes.trim()}`);
  }
  return lines.join("\n");
}
