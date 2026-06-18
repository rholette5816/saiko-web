interface RoundTicketProps {
  kind: "kitchen" | "bar";
  tableNumber: string;
  capacity: string;
  orderNumber: string;
  orNumber: string;
  items: { name: string; quantity: number }[];
  notes?: string;
  createdAt: Date;
}

function divider(char = "-") {
  return char.repeat(29);
}

function formatTime(value: Date) {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RoundTicket(props: RoundTicketProps) {
  return (
    <div className="round-ticket">
      <style>{`
        .round-ticket {
          font-family: "Courier New", monospace;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          padding: 10px 12px 14px;
          color: #0d0f13;
          background: white;
          line-height: 1.35;
          font-size: 13px;
        }
        .round-ticket .center { text-align: center; }
        .round-ticket .title { font-size: 20px; font-weight: 800; letter-spacing: 0; }
        .round-ticket .table { font-size: 22px; font-weight: 800; }
        .round-ticket .bold { font-weight: 800; }
        .round-ticket .divider { margin: 8px 0; }
        .round-ticket .item { font-size: 16px; font-weight: 700; margin: 5px 0; }
        .round-ticket .notes { margin-top: 8px; font-size: 15px; font-weight: 800; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: white !important; }
          .round-ticket { box-shadow: none !important; page-break-after: always; }
          .round-ticket:last-child { page-break-after: auto; }
        }
      `}</style>

      <div className="center title">=== {props.kind.toUpperCase()} ===</div>
      <div className="center table">
        TABLE {props.tableNumber} ({props.capacity})
      </div>
      <div>Order: {props.orderNumber}</div>
      <div>OR: {props.orNumber || "N/A"}</div>
      <div>Time: {formatTime(props.createdAt)}</div>

      <div className="divider">{divider("-")}</div>
      {props.items.map((item) => (
        <div key={`${props.kind}-${item.name}`} className="item">
          {item.quantity}x {item.name}
        </div>
      ))}
      <div className="divider">{divider("-")}</div>

      {props.notes && <div className="notes">Notes: {props.notes}</div>}
    </div>
  );
}
