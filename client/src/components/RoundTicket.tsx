interface RoundTicketProps {
  kind: "kitchen" | "bar";
  tableNumber: string;
  capacity: string;
  orderNumber: string;
  orNumber: string;
  items: { name: string; quantity: number }[];
  notes?: string;
  waiterName?: string;
  cashierName?: string;
  createdAt: Date;
}

function divider(char = "=") {
  return char.repeat(38);
}

function formatDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}-${get("day")}-${get("year")}`;
}

function formatTime(value: Date) {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RoundTicket(props: RoundTicketProps) {
  const ticketLabel = props.kind === "kitchen" ? "KITCHEN" : "BAR";
  const cashierName = props.cashierName || "admin";
  const waiterName = props.waiterName ? props.waiterName.toUpperCase() : "N/A";

  return (
    <div className="round-ticket">
      <style>{`
        .round-ticket {
          font-family: Consolas, "Courier New", monospace;
          box-sizing: border-box;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 2mm 3mm 3mm;
          color: #000000;
          background: white;
          line-height: 1.15;
          font-size: 14px;
          font-weight: 700;
          -webkit-font-smoothing: none;
          text-rendering: geometricPrecision;
        }
        .round-ticket .center { text-align: center; }
        .round-ticket .ticket-kind { font-size: 20px; font-weight: 900; line-height: 1.05; }
        .round-ticket .dine { font-size: 22px; font-weight: 900; line-height: 1.05; margin: 3px 0; }
        .round-ticket .bold { font-weight: 900; }
        .round-ticket .divider { margin: 4px 0; overflow: hidden; white-space: nowrap; font-size: 13px; }
        .round-ticket .item-head {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr);
          gap: 6px;
          font-size: 14px;
          font-weight: 900;
        }
        .round-ticket .item-row {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr);
          gap: 6px;
          margin: 5px 0;
          font-size: 20px;
          font-weight: 900;
          line-height: 1.1;
        }
        .round-ticket .qty { text-align: right; }
        .round-ticket .desc { min-width: 0; overflow-wrap: anywhere; }
        .round-ticket .notes { margin-top: 6px; font-size: 15px; font-weight: 900; }
        .round-ticket .footer-time { margin-top: 4px; font-size: 13px; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body, #root { margin: 0 !important; padding: 0 !important; background: white !important; height: auto !important; min-height: 0 !important; }
          .round-ticket {
            position: static !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      <div className="center ticket-kind">
        {ticketLabel} TABLE {props.tableNumber}
      </div>
      <div>Order No.:{props.orderNumber}</div>
      <div>Cashier:{cashierName}</div>
      <div>Waiter:{waiterName}</div>
      <div className="center dine">DINE IN</div>

      <div className="divider">{divider("=")}</div>
      <div className="item-head">
        <span>Qty</span>
        <span>Description(s)</span>
      </div>
      <div className="divider">{divider("=")}</div>

      {props.items.map((item, itemIndex) => (
        <div key={`${props.kind}-${item.name}-${itemIndex}`} className="item-row">
          <span className="qty">{item.quantity}</span>
          <span className="desc">{item.name}</span>
        </div>
      ))}

      {props.notes && (
        <>
          <div className="divider">{divider("-")}</div>
          <div className="notes">Notes:{props.notes}</div>
        </>
      )}

      <div className="divider">{divider("-")}</div>
      <div className="footer-time">
        Date:{formatDate(props.createdAt)} Time:{formatTime(props.createdAt)}
      </div>
    </div>
  );
}
