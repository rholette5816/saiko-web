export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface VatSplit {
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  total: number;
}

export function computeVatSplit(base: number, vatRegistered: boolean, vatRate: number, isVatExempt = false): VatSplit {
  if (isVatExempt) {
    return { vatableSales: 0, vatAmount: 0, vatExemptSales: round2(base), total: round2(base) };
  }
  if (vatRegistered) {
    const vatAmount = round2((base * vatRate) / (100 + vatRate));
    const vatableSales = round2(base - vatAmount);
    return { vatableSales, vatAmount, vatExemptSales: 0, total: round2(base) };
  }
  return { vatableSales: 0, vatAmount: 0, vatExemptSales: 0, total: round2(base) };
}
