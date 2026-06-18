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

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function divider(char = "-") {
  return char.repeat(32);
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TableBill(props: TableBillProps) {
  const isOfficial = props.settings.is_bir_accredited;

  return (
    <div className="table-bill">
      <style>{`
        .table-bill {
          font-family: "Courier New", monospace;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          padding: 8px 10px 12px;
          color: #0d0f13;
          background: white;
          line-height: 1.35;
          font-size: 12px;
        }
        .table-bill .center { text-align: center; }
        .table-bill .heading { font-weight: 800; font-size: 14px; }
        .table-bill .row { display: flex; justify-content: space-between; gap: 8px; }
        .table-bill .row .value { text-align: right; min-width: 88px; }
        .table-bill .bold { font-weight: 800; }
        .table-bill .muted { color: #393939; }
        .table-bill .divider { margin: 6px 0; color: #5a5a5a; }
        .table-bill .total { font-size: 16px; font-weight: 900; }
        .table-bill .item-name { flex: 1; min-width: 0; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .table-bill, .table-bill * { visibility: visible !important; }
          .table-bill { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="center heading">{props.settings.business_name || "SAIKO RAMEN & SUSHI"}</div>
      <div className="center">TIN: {props.settings.business_tin || "___"}</div>
      <div className="center">{props.settings.business_address || "Address not set"}</div>
      <div className="center">Tel: {props.settings.business_contact || "N/A"}</div>

      <div className="center divider">{divider("=")}</div>
      <div className="center bold">{isOfficial ? "OFFICIAL TABLE BILL" : "PROVISIONAL TABLE BILL"}</div>
      <div>Table {props.table.number} ({props.table.capacity})</div>
      <div>Date: {formatDate(new Date())}</div>

      <div className="divider">{divider("-")}</div>
      {props.rounds.map((round, index) => (
        <div key={`${round.order_number}-${round.or_number}`} style={{ marginBottom: "8px" }}>
          <div className="bold">
            ROUND {index + 1} - {formatTime(round.created_at)} - OR: {round.or_number || "N/A"}
          </div>
          {round.items.map((item, itemIndex) => (
            <div key={`${round.order_number}-${item.item_name}-${itemIndex}`} className="row">
              <span className="item-name">
                {item.quantity}x {item.item_name}
              </span>
              <span className="value">{money(item.line_total)}</span>
            </div>
          ))}
          <div className="row bold">
            <span>Subtotal:</span>
            <span className="value">{money(round.subtotal)}</span>
          </div>
        </div>
      ))}

      <div className="center divider">{divider("=")}</div>
      <div className="row">
        <span>GRAND SUBTOTAL</span>
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
        <span>TOTAL</span>
        <span className="value">{money(props.total)}</span>
      </div>

      <div className="divider">{divider("-")}</div>
      <div className="row">
        <span>Payment ({props.paymentMethod.toUpperCase()})</span>
        <span className="value">{money(props.amountReceived)}</span>
      </div>
      <div className="row">
        <span>Change</span>
        <span className="value">{money(props.change)}</span>
      </div>

      {props.seniorPwd && (
        <>
          <div className="divider">{divider("-")}</div>
          <div>ID Number: {props.seniorPwdId || "N/A"}</div>
          <div>Full Name: {props.seniorPwdName || "N/A"}</div>
        </>
      )}

      {!isOfficial && (
        <div className="center muted" style={{ marginTop: "8px" }}>
          This is a provisional bill for tracking only.
          <br />
          Not a BIR Official Receipt.
        </div>
      )}

      <div className="center divider">{divider("=")}</div>
    </div>
  );
}
