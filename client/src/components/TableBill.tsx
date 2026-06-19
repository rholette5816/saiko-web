import type { BusinessSettings } from "@/lib/supabase";
import type { TableDef } from "@/lib/tables";

interface TableBillProps {
  table: TableDef;
  rounds: Array<{
    order_number: string;
    or_number: string;
    created_at: string;
    subtotal: number;
    items: Array<{ item_name: string; quantity: number; unit_price: number; line_total: number }>;
  }>;
  subtotal: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  seniorDiscount: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  seniorPwd: boolean;
  seniorPwdId?: string | null;
  seniorPwdName?: string | null;
  settings: BusinessSettings;
}

interface CombinedBillItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function divider(char = "-") {
  return char.repeat(42);
}

function formatReceiptDate(value: Date | string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}-${get("day")}-${get("year")}`;
}

function formatReceiptTime(value: Date | string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function rangeLabel(values: string[]) {
  if (!values.length) return "N/A";
  if (values.length === 1) return values[0];
  return `${values[0]} to ${values[values.length - 1]}`;
}

function combineItems(rounds: TableBillProps["rounds"]): CombinedBillItem[] {
  const itemsByKey = new Map<string, CombinedBillItem>();

  rounds.forEach((round) => {
    round.items.forEach((item) => {
      const key = `${item.item_name}-${item.unit_price}`;
      const current = itemsByKey.get(key);

      if (current) {
        current.quantity += item.quantity;
        current.line_total += item.line_total;
        return;
      }

      itemsByKey.set(key, { ...item });
    });
  });

  return Array.from(itemsByKey.values());
}

export function TableBill(props: TableBillProps) {
  const isOfficial = props.settings.is_bir_accredited;
  const printedAt = new Date();
  const orderRange = rangeLabel(props.rounds.map((round) => round.order_number).filter(Boolean));
  const orRange = rangeLabel(props.rounds.map((round) => round.or_number).filter(Boolean));
  const paymentType = props.paymentMethod || "cash";
  const combinedItems = combineItems(props.rounds);
  const itemCount = combinedItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="table-bill">
      <style>{`
        .table-bill {
          font-family: "Courier New", monospace;
          box-sizing: border-box;
          width: 3in;
          max-width: 3in;
          margin: 0 auto;
          padding: 8px 9px 14px;
          color: #0d0f13;
          background: white;
          line-height: 1.22;
          font-size: 11px;
        }
        .table-bill .center { text-align: center; }
        .table-bill .heading { font-weight: 800; font-size: 13px; line-height: 1.15; }
        .table-bill .row { display: grid; grid-template-columns: minmax(0, 1fr) 92px; gap: 6px; }
        .table-bill .row .value { text-align: right; }
        .table-bill .bold { font-weight: 800; }
        .table-bill .muted { color: #393939; }
        .table-bill .divider { margin: 5px 0; color: #5a5a5a; overflow: hidden; white-space: nowrap; }
        .table-bill .total { font-size: 14px; font-weight: 900; }
        .table-bill .item-name { min-width: 0; overflow-wrap: anywhere; }
        .table-bill .item-row {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) 78px;
          gap: 4px;
          align-items: start;
        }
        .table-bill .item-qty { text-align: right; }
        .table-bill .item-amount { text-align: right; }
        @media print {
          @page { size: 3in auto; margin: 0; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .table-bill, .table-bill * { visibility: visible !important; }
          .table-bill { box-shadow: none !important; margin: 0 !important; width: 3in !important; max-width: 3in !important; }
        }
      `}</style>

      <div className="center heading">{props.settings.business_name || "SAIKO RAMEN & SUSHI"}</div>
      <div className="center">TIN: {props.settings.business_tin || "___"}</div>
      <div className="center">{props.settings.business_address || "Address not set"}</div>
      <div className="center">Tel: {props.settings.business_contact || "N/A"}</div>

      <div className="center divider">{divider("=")}</div>
      <div className="center bold">{isOfficial ? "OFFICIAL RECEIPT" : "PROVISIONAL RECEIPT"}</div>
      <div className="row">
        <span>Counter:</span>
        <span className="value">TABLE</span>
      </div>
      <div className="row">
        <span>OR No:</span>
        <span className="value">{orRange}</span>
      </div>
      <div className="row">
        <span>Order:</span>
        <span className="value">{orderRange}</span>
      </div>
      <div className="row">
        <span>P.Type:</span>
        <span className="value">{paymentType.toUpperCase()}</span>
      </div>
      <div className="row">
        <span>Cashier:</span>
        <span className="value">admin</span>
      </div>
      <div className="center divider">{divider("=")}</div>
      <div className="row">
        <span>Date:</span>
        <span className="value">{formatReceiptDate(printedAt)}</span>
      </div>
      <div className="row">
        <span>Time:</span>
        <span className="value">{formatReceiptTime(printedAt)}</span>
      </div>
      <div className="center bold" style={{ marginTop: "4px" }}>
        DINE IN
      </div>
      <div className="row">
        <span>Table:</span>
        <span className="value">{props.table.number}</span>
      </div>
      <div className="row">
        <span>Rounds:</span>
        <span className="value">{props.rounds.length}</span>
      </div>

      <div className="divider">{divider("-")}</div>
      {combinedItems.map((item, itemIndex) => (
        <div key={`${item.item_name}-${item.unit_price}-${itemIndex}`} className="item-row">
          <span className="item-qty">{item.quantity}</span>
          <span className="item-name">{item.item_name}</span>
          <span className="item-amount">{money(item.line_total)}</span>
        </div>
      ))}

      <div className="center divider">{divider("=")}</div>
      <div className="row">
        <span>Subtotal:</span>
        <span className="value">{money(props.subtotal)}</span>
      </div>
      {props.seniorPwd && (
        <>
          <div className="row">
            <span>Senior/PWD (-20%)</span>
            <span className="value">-{money(props.seniorDiscount)}</span>
          </div>
          <div className="row">
            <span>VAT-Exempt Sales</span>
            <span className="value">{money(props.vatExemptSales)}</span>
          </div>
        </>
      )}
      {!props.seniorPwd && props.settings.vat_registered && (
        <>
          <div className="row">
            <span>VAT-able Sales</span>
            <span className="value">{money(props.vatableSales)}</span>
          </div>
          <div className="row">
            <span>VAT ({money(props.settings.vat_rate).replace(".00", "")}%)</span>
            <span className="value">{money(props.vatAmount)}</span>
          </div>
        </>
      )}
      <div className="row total">
        <span>Total Amount:</span>
        <span className="value">{money(props.total)}</span>
      </div>

      <div className="center divider">{divider("=")}</div>
      <div className="row">
        <span>Tendered:</span>
        <span className="value">{money(props.amountReceived)}</span>
      </div>
      <div className="row">
        <span>Change:</span>
        <span className="value">{money(props.change)}</span>
      </div>
      <div className="row">
        <span>Item Count:</span>
        <span className="value">{itemCount}</span>
      </div>

      {props.seniorPwd && (
        <>
          <div className="divider">{divider("-")}</div>
          <div>ID Number: {props.seniorPwdId || "N/A"}</div>
          <div>Full Name: {props.seniorPwdName || "N/A"}</div>
        </>
      )}

      <div className="divider">{divider("-")}</div>
      <div>CUST. NAME: __________________________</div>
      <div>ADDRESS: _____________________________</div>
      <div>TIN #: _______________________________</div>
      <div>BUS. STYLE: __________________________</div>
      <div>SIGNATURE: ___________________________</div>

      <div className="divider">{divider("-")}</div>
      <div className="center">{props.settings.receipt_footer || "THANK YOU, COME AGAIN"}</div>

      {!isOfficial && (
        <div className="center muted" style={{ marginTop: "8px" }}>
          This is a provisional receipt for transaction
          <br />
          tracking only. Not a BIR Official Receipt.
        </div>
      )}

      <div className="center divider">{divider("=")}</div>
    </div>
  );
}
