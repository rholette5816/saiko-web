import type { BusinessSettings } from "@/lib/supabase";

interface CounterReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface CounterReceiptProps {
  orderNumber: string;
  orNumber: string | null;
  items: CounterReceiptItem[];
  total: number;
  subtotal: number;
  payment: string;
  received: number;
  change: number;
  customer: string;
  notes: string;
  createdAt: Date;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  seniorPwdDiscount: number;
  seniorPwdId: string | null;
  seniorPwdName: string | null;
  settings: BusinessSettings;
  cashier?: string | null;
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sectionDivider(char = "-") {
  return char.repeat(48);
}

export function CounterReceipt(props: CounterReceiptProps) {
  const isOfficial = props.settings.is_bir_accredited;

  return (
    <div className="counter-receipt">
      <style>{`
        .counter-receipt {
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
        .counter-receipt .center { text-align: center; }
        .counter-receipt .tight { line-height: 1.2; }
        .counter-receipt .heading { font-weight: 700; font-size: 14px; }
        .counter-receipt .row { display: flex; justify-content: space-between; gap: 8px; }
        .counter-receipt .row .label { color: #0d0f13; }
        .counter-receipt .row .value { text-align: right; min-width: 90px; }
        .counter-receipt .bold { font-weight: 700; }
        .counter-receipt .muted { color: #393939; }
        .counter-receipt .divider { margin: 6px 0; color: #5a5a5a; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: white !important; }
          .counter-receipt { box-shadow: none !important; }
        }
      `}</style>

      <div className="center heading tight">{props.settings.business_name || "SAIKO RAMEN & SUSHI"}</div>
      <div className="center tight">TIN: {props.settings.business_tin || "___"}</div>
      <div className="center tight">{props.settings.business_address || "Address not set"}</div>
      <div className="center tight">Tel: {props.settings.business_contact || "N/A"}</div>

      <div className="center divider">{sectionDivider("=")}</div>
      <div className="center bold">{isOfficial ? "OFFICIAL RECEIPT" : "PROVISIONAL RECEIPT"}</div>
      <div className="row">
        <span className="label">OR No:</span>
        <span className="value">{props.orNumber || "N/A"}</span>
      </div>
      <div className="row">
        <span className="label">Order:</span>
        <span className="value">{props.orderNumber}</span>
      </div>
      <div className="row">
        <span className="label">Date:</span>
        <span className="value">
          {new Date(props.createdAt).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
      <div className="row">
        <span className="label">Cashier:</span>
        <span className="value">{props.cashier || "admin"}</span>
      </div>
      <div className="row">
        <span className="label">Customer:</span>
        <span className="value">{props.customer}</span>
      </div>

      <div className="center divider">{sectionDivider("-")}</div>
      <div className="bold">ITEMS:</div>
      {props.items.map((item, idx) => (
        <div key={`${item.name}-${idx}`} className="mt-1">
          <div className="row">
            <span className="label">
              {item.quantity}x {item.name}
            </span>
            <span className="value">{money(item.price * item.quantity)}</span>
          </div>
          <div className="row muted">
            <span className="label">@ {money(item.price)}</span>
            <span className="value" />
          </div>
        </div>
      ))}

      <div className="center divider">{sectionDivider("-")}</div>

      {props.seniorPwdDiscount > 0 ? (
        <>
          <div className="row">
            <span className="label">Subtotal</span>
            <span className="value">{money(props.subtotal)}</span>
          </div>
          <div className="row">
            <span className="label">Senior/PWD Discount (20%)</span>
            <span className="value">-{money(props.seniorPwdDiscount)}</span>
          </div>
          <div className="row">
            <span className="label">VAT-Exempt Sales</span>
            <span className="value">{money(props.vatExemptSales)}</span>
          </div>
          <div className="row bold">
            <span className="label">TOTAL</span>
            <span className="value">{money(props.total)}</span>
          </div>
          <div className="row">
            <span className="label">Senior ID:</span>
            <span className="value">{props.seniorPwdId || "N/A"}</span>
          </div>
          <div className="row">
            <span className="label">Customer:</span>
            <span className="value">{props.seniorPwdName || props.customer}</span>
          </div>
        </>
      ) : props.settings.vat_registered ? (
        <>
          <div className="row">
            <span className="label">VAT-able Sales</span>
            <span className="value">{money(props.vatableSales)}</span>
          </div>
          <div className="row">
            <span className="label">VAT ({money(props.settings.vat_rate).replace(".00", "")}%)</span>
            <span className="value">{money(props.vatAmount)}</span>
          </div>
          <div className="row bold">
            <span className="label">TOTAL</span>
            <span className="value">{money(props.total)}</span>
          </div>
        </>
      ) : (
        <div className="row bold">
          <span className="label">TOTAL</span>
          <span className="value">{money(props.total)}</span>
        </div>
      )}

      <div className="center divider">{sectionDivider("-")}</div>
      <div className="row">
        <span className="label">Payment ({props.payment.toUpperCase()}):</span>
        <span className="value">{money(props.received)}</span>
      </div>
      <div className="row">
        <span className="label">Change:</span>
        <span className="value">{money(props.change)}</span>
      </div>

      {props.notes && (
        <>
          <div className="center divider">{sectionDivider("-")}</div>
          <div className="muted">Notes: {props.notes}</div>
        </>
      )}

      <div className="center divider">{sectionDivider("-")}</div>
      <div className="center">{props.settings.receipt_footer || "Salamat at bumalik kayo!"}</div>

      {!isOfficial && (
        <div className="center muted" style={{ marginTop: "6px" }}>
          This is a provisional receipt for transaction
          <br />
          tracking only. Not a BIR Official Receipt.
        </div>
      )}

      <div className="center divider">{sectionDivider("=")}</div>
    </div>
  );
}
