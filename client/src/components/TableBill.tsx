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
  cashierName?: string | null;
}

const RECEIPT_LEGAL_NAME = "ALPHRICK FOOD VENTURES INC";
const RECEIPT_DEFAULT_ADDRESS = "PULO MAESTRA VITA, OTON, ILOILO";
const RECEIPT_DEFAULT_TIN = "604-863-765-000";
const RECEIPT_SN = "592052438019055";
const RECEIPT_MIN = "2301191829346437";

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
  return char.repeat(40);
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
  const printedAt = new Date();
  const businessName = props.settings.business_name || "SAIKO RAMEN & SUSHI";
  const businessAddress = props.settings.business_address || RECEIPT_DEFAULT_ADDRESS;
  const businessTin = props.settings.business_tin || RECEIPT_DEFAULT_TIN;
  const businessContact = props.settings.business_contact || "N/A";
  const cashierName = props.cashierName || "admin";
  const addressLines = businessAddress.split(/\r?\n/).filter(Boolean);
  const orderRange = rangeLabel(props.rounds.map((round) => round.order_number).filter(Boolean));
  const orRange = rangeLabel(props.rounds.map((round) => round.or_number).filter(Boolean));
  const paymentType = props.paymentMethod || "cash";
  const combinedItems = combineItems(props.rounds);
  const itemCount = combinedItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <div className="table-bill">
      <style>{`
        .table-bill {
          font-family: Consolas, "Courier New", monospace;
          box-sizing: border-box;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 2mm 3mm 6mm;
          color: #000000;
          background: white;
          line-height: 1.2;
          font-size: 14px;
          font-weight: 700;
          -webkit-font-smoothing: none;
          text-rendering: geometricPrecision;
        }
        .table-bill .center { text-align: center; }
        .table-bill .heading { font-weight: 900; font-size: 15px; line-height: 1.15; }
        .table-bill .row { display: grid; grid-template-columns: minmax(0, 1fr) 90px; gap: 4px; }
        .table-bill .row .value { text-align: right; }
        .table-bill .bold { font-weight: 900; }
        .table-bill .muted { color: #000000; }
        .table-bill .divider { margin: 5px 0; color: #000000; overflow: hidden; white-space: nowrap; font-size: 13px; }
        .table-bill .total { font-size: 17px; font-weight: 900; }
        .table-bill .item-name { min-width: 0; overflow-wrap: anywhere; }
        .table-bill .item-row {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) 80px;
          gap: 4px;
          align-items: start;
          font-size: 14px;
        }
        .table-bill .item-qty { text-align: right; }
        .table-bill .item-amount { text-align: right; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body, #root { margin: 0 !important; padding: 0 !important; background: white !important; height: auto !important; min-height: 0 !important; }
          body * { visibility: hidden !important; }
          .table-bill, .table-bill * { visibility: visible !important; }
          .table-bill {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      <div className="center heading">{businessName}</div>
      {addressLines.map((line, index) => (
        <div key={`${line}-${index}`} className="center">
          {line}
        </div>
      ))}
      <div className="center">{RECEIPT_LEGAL_NAME}</div>
      <div className="center">TIN #: {businessTin}</div>
      <div className="center">SN #: {RECEIPT_SN}</div>
      <div className="center">MIN:{RECEIPT_MIN}</div>
      <div className="center">Tel: {businessContact}</div>

      <div className="center divider">{divider("=")}</div>
      <div className="center bold">PROVISIONAL RECEIPT</div>
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
        <span className="value">{cashierName}</span>
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

      <div className="center muted" style={{ marginTop: "8px" }}>
        This is a provisional receipt for transaction
        <br />
        tracking only. Not a BIR Official Receipt.
      </div>

      <div className="center divider">{divider("=")}</div>
    </div>
  );
}
