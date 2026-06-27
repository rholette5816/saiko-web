export type HolderType = "senior" | "pwd";

export type DiscountType = "none" | "senior" | "pwd" | "employee" | "family" | "custom";

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  none: "None",
  senior: "Senior Citizen",
  pwd: "PWD",
  employee: "Employee",
  family: "Family",
  custom: "Custom",
};

export const DISCOUNT_TYPE_GUIDE_PCT: Record<DiscountType, number> = {
  none: 0,
  senior: 20,
  pwd: 20,
  employee: 10,
  family: 15,
  custom: 0,
};

export function requiresHolderId(discountType: DiscountType): boolean {
  return discountType === "senior" || discountType === "pwd";
}

export function isFlatDiscountType(discountType: DiscountType): boolean {
  return discountType === "employee" || discountType === "family" || discountType === "custom";
}

export interface DiscountAllocation {
  holderRef: string;
  holderType: HolderType;
  holderName: string;
  holderIdNumber: string;
  discountRate: number;
  orderItemId: string;
  quantity: number;
}

export interface DiscountHolderDraft {
  id: string;
  holderType: HolderType;
  holderName: string;
  holderIdNumber: string;
  discountRate: string;
  allocations: Record<string, string>;
}

export interface DiscountableBillItem {
  orderId: string;
  orderNumber: string;
  orderItemId: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
}

export interface DiscountPreviewLine extends DiscountAllocation {
  orderId: string;
  orderNumber: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  grossAmount: number;
  vatRemovedAmount: number;
  vatExemptSales: number;
  discountAmount: number;
  netAmount: number;
}

export interface DiscountPreview {
  lines: DiscountPreviewLine[];
  errors: string[];
  discountGross: number;
  vatRemovedAmount: number;
  vatExemptSales: number;
  discountAmount: number;
  discountedNet: number;
  regularGross: number;
  vatableSales: number;
  vatAmount: number;
  total: number;
}

export function createDiscountHolderDraft(): DiscountHolderDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    holderType: "senior",
    holderName: "",
    holderIdNumber: "",
    discountRate: "20",
    allocations: {},
  };
}

export function wholeBillAllocations(items: DiscountableBillItem[]): Record<string, string> {
  const allocations: Record<string, string> = {};
  items.forEach((item) => {
    allocations[item.orderItemId] = String(item.quantity);
  });
  return allocations;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampRate(value: string): number {
  const rate = Number(value || 0);
  if (!Number.isFinite(rate)) return 0;
  return Math.min(100, Math.max(0, rate));
}

function cleanQuantity(value: string): number {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, Math.floor(quantity));
}

function vatBase(gross: number, vatRegistered: boolean, vatRate: number): number {
  if (!vatRegistered || vatRate <= 0) return round2(gross);
  return round2(gross / (1 + vatRate / 100));
}

export function computeDiscountPreview(
  items: DiscountableBillItem[],
  holders: DiscountHolderDraft[],
  subtotal: number,
  vatRegistered: boolean,
  vatRate: number,
): DiscountPreview {
  const errors: string[] = [];
  const itemById = new Map(items.map((item) => [item.orderItemId, item]));
  const allocatedByItem = new Map<string, number>();
  const lines: DiscountPreviewLine[] = [];

  holders.forEach((holder, holderIndex) => {
    const holderName = holder.holderName.trim();
    const holderIdNumber = holder.holderIdNumber.trim();
    const discountRate = clampRate(holder.discountRate);
    const allocations = Object.entries(holder.allocations)
      .map(([orderItemId, rawQuantity]) => ({ orderItemId, quantity: cleanQuantity(rawQuantity) }))
      .filter((allocation) => allocation.quantity > 0);

    if (allocations.length === 0) return;

    if (!holderName) errors.push(`Discount holder ${holderIndex + 1}: enter the card holder name.`);
    if (!holderIdNumber) errors.push(`Discount holder ${holderIndex + 1}: enter the ID or card number.`);
    if (discountRate <= 0) errors.push(`Discount holder ${holderIndex + 1}: enter a discount rate greater than 0.`);

    allocations.forEach(({ orderItemId, quantity }) => {
      const item = itemById.get(orderItemId);
      if (!item) {
        errors.push(`Discount holder ${holderIndex + 1}: selected item is no longer available.`);
        return;
      }

      const allocated = (allocatedByItem.get(orderItemId) ?? 0) + quantity;
      allocatedByItem.set(orderItemId, allocated);
      if (allocated > item.quantity) {
        errors.push(`${item.itemName}: discounted quantity cannot exceed ${item.quantity}.`);
      }

      const grossAmount = round2(item.unitPrice * quantity);
      const vatExemptSales = vatBase(grossAmount, vatRegistered, vatRate);
      const vatRemovedAmount = round2(grossAmount - vatExemptSales);
      const discountAmount = round2(vatExemptSales * (discountRate / 100));
      const netAmount = round2(Math.max(0, vatExemptSales - discountAmount));

      lines.push({
        holderRef: holder.id,
        holderType: holder.holderType,
        holderName,
        holderIdNumber,
        discountRate,
        orderItemId,
        quantity,
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        itemId: item.itemId,
        itemName: item.itemName,
        unitPrice: item.unitPrice,
        grossAmount,
        vatRemovedAmount,
        vatExemptSales,
        discountAmount,
        netAmount,
      });
    });
  });

  const discountGross = round2(lines.reduce((total, line) => total + line.grossAmount, 0));
  const vatRemovedAmount = round2(lines.reduce((total, line) => total + line.vatRemovedAmount, 0));
  const vatExemptSales = round2(lines.reduce((total, line) => total + line.vatExemptSales, 0));
  const discountAmount = round2(lines.reduce((total, line) => total + line.discountAmount, 0));
  const discountedNet = round2(lines.reduce((total, line) => total + line.netAmount, 0));
  const regularGross = round2(Math.max(0, subtotal - discountGross));
  const vatAmount = vatRegistered && vatRate > 0 ? round2((regularGross * vatRate) / (100 + vatRate)) : 0;
  const vatableSales = vatRegistered && vatRate > 0 ? round2(regularGross - vatAmount) : 0;
  const total = round2(regularGross + discountedNet);

  return {
    lines,
    errors: Array.from(new Set(errors)),
    discountGross,
    vatRemovedAmount,
    vatExemptSales,
    discountAmount,
    discountedNet,
    regularGross,
    vatableSales,
    vatAmount,
    total,
  };
}

export function computeFlatDiscountPreview(
  subtotal: number,
  pct: string,
  vatRegistered: boolean,
  vatRate: number,
): DiscountPreview {
  const discountAmount = round2(subtotal * (clampRate(pct) / 100));
  const regularGross = round2(Math.max(0, subtotal - discountAmount));
  const vatAmount = vatRegistered && vatRate > 0 ? round2((regularGross * vatRate) / (100 + vatRate)) : 0;
  const vatableSales = vatRegistered && vatRate > 0 ? round2(regularGross - vatAmount) : 0;

  return {
    lines: [],
    errors: [],
    discountGross: 0,
    vatRemovedAmount: 0,
    vatExemptSales: 0,
    discountAmount,
    discountedNet: 0,
    regularGross,
    vatableSales,
    vatAmount,
    total: regularGross,
  };
}
