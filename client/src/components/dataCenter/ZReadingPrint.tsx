import type { CashClosingRow, PayoutRow } from "@/lib/cashDrawer";
import type { DailySummaryRow, PaymentMixRow, ProductSalesRow, TableSalesRow } from "@/lib/dataCenter";

interface ZReadingPrintProps {
  scope: string;
  rangeLabel: string;
  generatedAt: Date;
  business: { name: string; tin: string | null; address: string | null };
  summary: DailySummaryRow[];
  paymentMix: PaymentMixRow[];
  productRows: ProductSalesRow[];
  tableRows: TableSalesRow[];
  closing?: CashClosingRow | null;
  payouts?: PayoutRow[];
  thermalMode: boolean;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function php(value: number): string {
  return `PHP ${phpFormatter.format(Number(value || 0))}`;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function totals(rows: DailySummaryRow[]) {
  return rows.reduce(
    (acc, row) => ({
      gross: acc.gross + num(row.gross_sales),
      promo: acc.promo + num(row.promo_discount),
      sr: acc.sr + num(row.senior_pwd_discount),
      net: acc.net + num(row.net_sales),
      vatable: acc.vatable + num(row.vatable_sales),
      vat: acc.vat + num(row.vat_amount),
      vatExempt: acc.vatExempt + num(row.vat_exempt_sales),
      cash: acc.cash + num(row.cash_total),
      gcash: acc.gcash + num(row.gcash_total),
      card: acc.card + num(row.card_total),
      online: acc.online + num(row.online_total),
    }),
    { gross: 0, promo: 0, sr: 0, net: 0, vatable: 0, vat: 0, vatExempt: 0, cash: 0, gcash: 0, card: 0, online: 0 },
  );
}

function orRange(rows: DailySummaryRow[]) {
  const valid = rows.filter((row) => row.first_or || row.last_or);
  if (valid.length === 0) return { first: null as string | null, last: null as string | null, count: 0 };
  const firsts = valid.map((row) => row.first_or).filter((value): value is string => !!value);
  const lasts = valid.map((row) => row.last_or).filter((value): value is string => !!value);
  const completedCount = rows
    .filter((row) => row.status === "completed")
    .reduce((sum, row) => sum + num(row.order_count), 0);
  return {
    first: firsts.length ? firsts.sort()[0] : null,
    last: lasts.length ? lasts.sort().at(-1) ?? null : null,
    count: completedCount,
  };
}

function topProducts(rows: ProductSalesRow[], limit = 10) {
  const grouped = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const row of rows) {
    const current = grouped.get(row.item_id) ?? { name: row.item_name, qty: 0, revenue: 0 };
    current.qty += num(row.qty_sold);
    current.revenue += num(row.revenue);
    grouped.set(row.item_id, current);
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function tableSummary(rows: TableSalesRow[]) {
  const grouped = new Map<string, { label: string; orders: number; revenue: number }>();
  for (const row of rows) {
    const current = grouped.get(row.table_label) ?? { label: row.table_label, orders: 0, revenue: 0 };
    current.orders += num(row.order_count);
    current.revenue += num(row.revenue);
    grouped.set(row.table_label, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
}

export function ZReadingPrint(props: ZReadingPrintProps) {
  const t = totals(props.summary);
  const or = orRange(props.summary);
  const top = topProducts(props.productRows);
  const tables = tableSummary(props.tableRows);
  const widthClass = props.thermalMode ? "z-reading-thermal" : "z-reading-a4";

  return (
    <div className={`z-reading ${widthClass}`}>
      <style>{`
        .z-reading {
          font-family: Consolas, "Courier New", monospace;
          color: #000000;
          background: white;
          line-height: 1.25;
          font-weight: 700;
        }
        .z-reading.z-reading-thermal {
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 3mm 3mm 6mm;
          font-size: 12px;
        }
        .z-reading.z-reading-a4 {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: 16mm;
          font-size: 13px;
          font-weight: 500;
          font-family: Inter, system-ui, sans-serif;
          color: #0d0f13;
        }
        .z-reading h1 { font-size: 16px; margin: 0; }
        .z-reading h2 { font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .z-reading .meta { margin-top: 4px; font-size: 12px; }
        .z-reading .row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
        .z-reading .row.totals { border-top: 1px solid #000000; margin-top: 4px; padding-top: 4px; font-weight: 800; }
        .z-reading section { margin-top: 12px; }
        .z-reading ul { list-style: none; padding: 0; margin: 4px 0 0; }
        .z-reading li { padding: 1px 0; }
        .z-reading footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #c0c0c0; }
        @media print {
          @page { size: ${props.thermalMode ? "80mm auto" : "A4"}; margin: ${props.thermalMode ? "0" : "12mm"}; }
          html, body, #root { margin: 0 !important; padding: 0 !important; background: white !important; }
          .z-reading { page-break-after: avoid; }
        }
      `}</style>

      <header className="center">
        <h1>{props.business.name}</h1>
        {props.business.tin && <p className="meta">TIN: {props.business.tin}</p>}
        {props.business.address && <p className="meta">{props.business.address}</p>}
        <p className="meta">Z-READING / {props.rangeLabel}</p>
        <p className="meta">Generated: {props.generatedAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
        <p className="meta">Scope: {props.scope}</p>
      </header>

      <section>
        <h2>OR Range</h2>
        {or.count === 0 ? (
          <p>No completed orders.</p>
        ) : (
          <>
            <div className="row">
              <span>First OR</span>
              <span>{or.first ?? "N/A"}</span>
            </div>
            <div className="row">
              <span>Last OR</span>
              <span>{or.last ?? "N/A"}</span>
            </div>
            <div className="row">
              <span>OR Count</span>
              <span>{or.count}</span>
            </div>
          </>
        )}
      </section>

      <section>
        <h2>Sales Totals</h2>
        <div className="row">
          <span>Gross Sales</span>
          <span>{php(t.gross)}</span>
        </div>
        {t.promo > 0 && (
          <div className="row">
            <span>Promo Discounts</span>
            <span>-{php(t.promo)}</span>
          </div>
        )}
        {t.sr > 0 && (
          <div className="row">
            <span>Senior/PWD Discounts</span>
            <span>-{php(t.sr)}</span>
          </div>
        )}
        <div className="row totals">
          <span>Net Sales</span>
          <span>{php(t.net)}</span>
        </div>
      </section>

      <section>
        <h2>VAT Breakdown</h2>
        <div className="row">
          <span>VAT-able Sales</span>
          <span>{php(t.vatable)}</span>
        </div>
        <div className="row">
          <span>VAT</span>
          <span>{php(t.vat)}</span>
        </div>
        <div className="row">
          <span>VAT-exempt</span>
          <span>{php(t.vatExempt)}</span>
        </div>
      </section>

      <section>
        <h2>Payment Mix</h2>
        {props.paymentMix.length === 0 ? (
          <p>No completed orders.</p>
        ) : (
          props.paymentMix.map((row) => (
            <div key={row.payment_label} className="row">
              <span>
                {row.payment_label} ({row.order_count})
              </span>
              <span>{php(row.total_amount)}</span>
            </div>
          ))
        )}
      </section>

      <section>
        <h2>Top 10 Items</h2>
        {top.length === 0 ? (
          <p>No sold items.</p>
        ) : (
          <ul>
            {top.map((item) => (
              <li key={item.name} className="row">
                <span>
                  {item.name} ({item.qty})
                </span>
                <span>{php(item.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tables.length > 0 && !props.thermalMode && (
        <section>
          <h2>Tables</h2>
          <ul>
            {tables.slice(0, 12).map((row) => (
              <li key={row.label} className="row">
                <span>
                  {row.label} ({row.orders})
                </span>
                <span>{php(row.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.closing && (
        <section>
          <h2>Drawer Reconciliation</h2>
          <div className="row">
            <span>Status</span>
            <span>{props.closing.status.toUpperCase()}</span>
          </div>
          <div className="row">
            <span>Opening Float</span>
            <span>{php(props.closing.opening_float)}</span>
          </div>
          <div className="row">
            <span>Cash Variance</span>
            <span>{php(props.closing.cash_variance)}</span>
          </div>
          <div className="row">
            <span>GCash Variance</span>
            <span>{php(props.closing.gcash_variance)}</span>
          </div>
          <div className="row">
            <span>BPI Variance</span>
            <span>{php(props.closing.card_variance)}</span>
          </div>
          <div className="row">
            <span>Payouts Total</span>
            <span>{php(props.closing.payouts_total)}</span>
          </div>
          {props.payouts && props.payouts.length > 0 && (
            <ul>
              {props.payouts.map((payout) => (
                <li key={payout.id} className="row">
                  <span>{payout.label}</span>
                  <span>{php(payout.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {props.closing.notes && <p className="meta">Notes: {props.closing.notes}</p>}
        </section>
      )}

      <footer>
        <p>Cashier signature: __________________________</p>
        <p>Manager signature: __________________________</p>
      </footer>
    </div>
  );
}
