import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { Check, Copy, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

interface StashedOrder {
  orderText: string;
  method: "messenger" | "email";
  name: string;
  phone: string;
  pickup: string;
  isTomorrow: boolean;
}

export default function OrderConfirmed() {
  const [order, setOrder] = useState<StashedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Order Received · Saiko Ramen & Sushi";
    try {
      const raw = sessionStorage.getItem("saiko-last-order");
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  async function copyOrder() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.orderText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#ebe9e6]">
        <TopNav />
        <div className="container py-16 text-center max-w-xl">
          <h1 className="font-poppins font-bold text-3xl mb-4">No order to show</h1>
          <p className="text-[#705d48] mb-6">
            Looks like you landed here directly. Head back to the menu to start an order.
          </p>
          <Link
            href="/menu"
            className="inline-block px-6 py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
          >
            Browse Menu
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const messengerUrl = "https://m.me/saikoramenandsushi?ref=order";

  return (
    <div className="min-h-screen bg-[#ebe9e6]">
      <TopNav />

      <div className="container py-10 md:py-16 max-w-2xl">
        <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check size={32} className="text-green-600" strokeWidth={3} />
            </div>
            <h1 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-2 uppercase tracking-tight">
              Order Received
            </h1>
            <p className="text-[#705d48] max-w-md">
              {order.method === "email" ? (
                <>We've emailed your order to the kitchen. We'll text or call <strong>{order.phone}</strong> shortly to confirm.</>
              ) : (
                <>One last step: send your order via Messenger so the kitchen sees it. Tap the button below, paste, and hit send.</>
              )}
            </p>
            {order.isTomorrow && (
              <p className="text-sm text-[#ac312d] font-semibold mt-2">
                Pre-order for tomorrow: {order.pickup}
              </p>
            )}
          </div>

          {/* Order summary */}
          <div className="bg-[#ebe9e6]/50 rounded-xl p-5 mb-6">
            <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap text-[#0d0f13] leading-relaxed">
{order.orderText}
            </pre>
          </div>

          {/* Action area */}
          {order.method === "messenger" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={copyOrder}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#0d0f13] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-black transition-colors"
              >
                <Copy size={16} /> {copied ? "Copied!" : "1. Copy Order"}
              </button>
              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
              >
                <MessageCircle size={16} /> 2. Open Messenger and Paste
              </a>
              <p className="text-xs text-center text-[#705d48]">
                Paste the order in chat. We'll confirm pickup time within minutes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#705d48] text-center">
                Want faster confirmation? Message us directly:
              </p>
              <a
                href={messengerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
              >
                <MessageCircle size={16} /> Message Us
              </a>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#ebe9e6] flex flex-col sm:flex-row gap-3">
            <a
              href="tel:09178658587"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-[#0d0f13] text-[#0d0f13] font-bold uppercase tracking-wide text-sm rounded-lg hover:bg-[#ebe9e6] transition-colors"
            >
              <Phone size={16} /> Call Saiko
            </a>
            <Link
              href="/menu"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-[#0d0f13] text-[#0d0f13] font-bold uppercase tracking-wide text-sm rounded-lg hover:bg-[#ebe9e6] transition-colors"
            >
              Browse Menu
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
