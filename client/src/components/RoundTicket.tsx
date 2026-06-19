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
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 0 3mm 2mm;
          color: #000000;
          background: white;
          line-height: 1.08;
          font-size: 12px;
          font-weight: 700;
          -webkit-font-smoothing: none;
          text-rendering: geometricPrecision;
        }
        .round-ticket .center { text-align: center; }
        .round-ticket .ticket-kind { font-size: 17px; font-weight: 900; line-height: 1; }
        .round-ticket .dine { font-size: 19px; font-weight: 900; line-height: 1; margin: 2px 0; }
        .round-ticket .bold { font-weight: 900; }
        .round-ticket .divider { margin: 3px 0; overflow: hidden; white-space: nowrap; }
        .round-ticket .item-head {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr);
          gap: 6px;
          font-size: 13px;
          font-weight: 900;
        }
        .round-ticket .item-row {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr);
          gap: 6px;
          margin: 4px 0;
          font-size: 17px;
          font-weight: 900;
          line-height: 1.02;
        }
        .round-ticket .qty { text-align: right; }
        .round-ticket .desc { min-width: 0; overflow-wrap: anywhere; }
        .round-ticket .notes { margin-top: 5px; font-size: 13px; font-weight: 900; }
        .round-ticket .footer-time { margin-top: 3px; font-size: 12px; }
        @media print {
          @page { size: 3in 95mm; margin: 0; }
          html, body, #root { margin: 0 !important; padding: 0 !important; width: 3in !important; min-height: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          .round-ticket, .round-ticket * { visibility: visible !important; }
          .round-ticket {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 72mm !important;
            max-width: 72mm !important;
            padding-top: 0 !important;
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
