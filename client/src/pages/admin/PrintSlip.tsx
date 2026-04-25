import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

interface SlipOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_label: string;
  notes: string | null;
  total_amount: number | string;
  created_at: string;
  order_items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    line_total: number | string;
  }>;
}

function currencyPhp(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH")}`;
}

export default function AdminPrintSlip({ id }: { id: string }) {
  const [order, setOrder] = useState<SlipOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchOrder() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setOrder((data as SlipOrder | null) ?? null);
      }
      setLoading(false);
    }
    fetchOrder();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (loading || !order || printTriggered) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPrintTriggered(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [loading, order, printTriggered]);

  const total = useMemo(() => Number(order?.total_amount ?? 0), [order]);

  return (
    <div className="min-h-screen bg-[#ebe9e6] text-[#0d0f13] p-4">
      <style>{`
        @page { size: A5; margin: 1cm; }
        @media print {
          body { font-family: 'Courier New', monospace; background: #fff; color: #000; }
          .print-actions { display: none !important; }
          .print-shell { max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="print-shell max-w-md mx-auto bg-white rounded-lg shadow-sm p-5">
        <div className="print-actions mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-md bg-[#0d0f13] text-white text-sm font-semibold"
          >
            Print
          </button>
          <Link href={`/admin/orders/${id}`} className="px-3 py-2 rounded-md border border-[#0d0f13] text-sm font-semibold">
            Back
          </Link>
        </div>

        {loading && <p className="text-sm text-[#705d48]">Loading slip...</p>}
        {error && <p className="text-sm text-[#ac312d]">Failed to load: {error}</p>}
        {!loading && !error && !order && <p className="text-sm text-[#705d48]">Order not found.</p>}

        {!loading && !error && order && (
          <div className="space-y-3 text-sm">
            <h1 className="text-lg font-bold">Pickup Slip #{order.order_number}</h1>
            <p>{new Date(order.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
            <div>
              <p>{order.customer_name}</p>
              <p>{order.customer_phone}</p>
              <p>{order.pickup_label}</p>
            </div>
            <hr className="border-[#d8d2cb]" />
            <div className="space-y-1">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between gap-2">
                  <span>
                    {item.item_name} x {item.quantity}
                  </span>
                  <span>{currencyPhp(Number(item.line_total))}</span>
                </div>
              ))}
            </div>
            <hr className="border-[#d8d2cb]" />
            <p className="font-bold">Total: {currencyPhp(total)}</p>
            {order.notes && <p>Notes: {order.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
