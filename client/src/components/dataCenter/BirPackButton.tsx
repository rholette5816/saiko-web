import type { CashClosingRow, PayoutRow } from "@/lib/cashDrawer";
import { exportRowsToCsv, type CsvCell } from "@/lib/csvExport";
import type { DailySummaryRow, PaymentMixRow, ProductSalesRow, TableSalesRow } from "@/lib/dataCenter";

interface BirPackButtonProps {
  summary: DailySummaryRow[];
  productRows: ProductSalesRow[];
  tableRows: TableSalesRow[];
  paymentMix: PaymentMixRow[];
  closing?: CashClosingRow | null;
  payouts?: PayoutRow[];
  scopeLabel: string;
  rangeLabel: string;
  filenameBase: string;
  disabled?: boolean;
}

function amount(value: unknown): string {
  return Number(value ?? 0).toFixed(2);
}

function buildSection(title: string, headers: string[], rows: CsvCell[][]): CsvCell[][] {
  const titleRow: CsvCell[] = [`# ${title}`];
  while (titleRow.length < headers.length) titleRow.push("");
  return [titleRow, headers, ...rows, Array(headers.length).fill("")];
}

export function BirPackButton({
  summary,
  productRows,
  tableRows,
  paymentMix,
  closing,
  payouts,
  scopeLabel,
  rangeLabel,
  filenameBase,
  disabled,
}: BirPackButtonProps) {
  function buildPack(): { headers: string[]; rows: CsvCell[][] } {
    const allRows: CsvCell[][] = [];
    const maxColumns = 10;
    const headers = Array.from({ length: maxColumns }, (_unused, index) => `col_${index + 1}`);

    allRows.push(["# Scope", scopeLabel]);
    allRows.push(["# Range", rangeLabel]);
    allRows.push(Array(headers.length).fill(""));

    allRows.push(
      ...buildSection(
        "Daily Summary",
        ["business_date", "channel", "status", "order_count", "gross", "net", "promo_disc", "sr_pwd_disc", "vat", "vat_exempt"],
        summary.map((row) => [
          row.business_date,
          row.channel,
          row.status,
          row.order_count,
          amount(row.gross_sales),
          amount(row.net_sales),
          amount(row.promo_discount),
          amount(row.senior_pwd_discount),
          amount(row.vat_amount),
          amount(row.vat_exempt_sales),
        ]),
      ),
    );

    allRows.push(
      ...buildSection(
        "Payment Mix",
        ["payment_label", "order_count", "total"],
        paymentMix.map((row) => [row.payment_label, row.order_count, amount(row.total_amount)]),
      ),
    );

    allRows.push(
      ...buildSection(
        "Products",
        ["business_date", "channel", "item_id", "item_name", "qty_sold", "revenue", "order_count"],
        productRows.map((row) => [
          row.business_date,
          row.channel,
          row.item_id,
          row.item_name,
          amount(row.qty_sold),
          amount(row.revenue),
          row.order_count,
        ]),
      ),
    );

    allRows.push(
      ...buildSection(
        "Tables",
        ["business_date", "channel", "table_label", "order_count", "item_count", "revenue", "cash", "gcash", "card", "online"],
        tableRows.map((row) => [
          row.business_date,
          row.channel,
          row.table_label,
          row.order_count,
          amount(row.item_count),
          amount(row.revenue),
          amount(row.cash_total),
          amount(row.gcash_total),
          amount(row.card_total),
          amount(row.online_total),
        ]),
      ),
    );

    if (closing) {
      allRows.push(
        ...buildSection(
          "Cash Drawer Closing",
          ["business_date", "channel", "status", "opening_float", "cash_variance", "gcash_variance", "card_variance", "payouts_total"],
          [
            [
              closing.business_date,
              closing.channel,
              closing.status,
              amount(closing.opening_float),
              amount(closing.cash_variance),
              amount(closing.gcash_variance),
              amount(closing.card_variance),
              amount(closing.payouts_total),
            ],
          ],
        ),
      );
    }

    if (payouts && payouts.length > 0) {
      allRows.push(
        ...buildSection(
          "Payouts",
          ["label", "amount", "created_at"],
          payouts.map((payout) => [payout.label, amount(payout.amount), payout.created_at]),
        ),
      );
    }

    return { headers, rows: allRows };
  }

  function handleDownload() {
    const { headers, rows } = buildPack();
    exportRowsToCsv(headers, rows, `${filenameBase}-bir-pack.csv`);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled}
      className="min-h-11 rounded-md border border-[#0d0f13] bg-white px-4 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
    >
      Download BIR Pack
    </button>
  );
}
