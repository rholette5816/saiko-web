import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { Check, Copy, Phone, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

interface StashedOrder {
  orderNumber: string;
  orderText: string;
  name: string;
  phone: string;
  pickup: string;
  isTomorrow: boolean;
  total: number;
  subtotal?: number;
  discountAmount?: number;
  promoCode?: string | null;
  trackingToken?: string;
}

export default function OrderConfirmed() {
  const [order, setOrder] = useState<StashedOrder | null>(null);
  const [refFromUrl, setRefFromUrl] = useState("");
  const [trackFromUrl, setTrackFromUrl] = useState("");
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Order Received - Saiko Ramen & Sushi";
    try {
      const raw = sessionStorage.getItem("saiko-last-order");
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // ignore
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref")?.trim() ?? "";
      const track = params.get("track")?.trim() ?? "";
      if (ref) setRefFromUrl(ref);
      if (track) setTrackFromUrl(track);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!copyNotice) return;
    const timer = window.setTimeout(() => setCopyNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  const effectiveRef = (order?.orderNumber || refFromUrl).trim();
  const trackingToken = (order?.trackingToken || trackFromUrl).trim();
  const trackingPath = trackingToken ? `/track/${encodeURIComponent(trackingToken)}` : "";
  const trackingUrl = useMemo(() => {
    if (!trackingToken) return "";
    return `${window.location.origin}/track/${encodeURIComponent(trackingToken)}`;
  }, [trackingToken]);

  async function copyTrackingUrl() {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopyNotice("Tracking URL copied.");
    } catch {
      setCopyNotice("Could not copy tracking URL.");
    }
  }

  if (!order && !effectiveRef) {
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
            <p className="font-poppins font-bold text-2xl text-[#ac312d] mb-2">
              Order #{effectiveRef}
            </p>
            <p className="text-[#705d48] max-w-md">Track your order status anytime using your tracking link.</p>
            {order?.isTomorrow && (
              <p className="text-sm text-[#ac312d] font-semibold mt-2 px-3 py-1 rounded-full bg-[#ac312d]/10">
                Pre-order for tomorrow: {order.pickup}
              </p>
            )}
            {copyNotice && <p className="text-sm text-[#2d7a3e] mt-2">{copyNotice}</p>}
          </div>

          {order?.orderText && (
            <div className="bg-[#ebe9e6]/50 rounded-xl p-5 mb-6">
              <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap text-[#0d0f13] leading-relaxed">
{order.orderText}
              </pre>
            </div>
          )}

          <div className="space-y-3">
            {trackingPath ? (
              <>
                <Link
                  href={trackingPath}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
                >
                  <Route size={16} /> Track Order
                </Link>
                <button
                  type="button"
                  onClick={copyTrackingUrl}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-[#0d0f13] text-[#0d0f13] font-bold uppercase tracking-wide rounded-lg hover:bg-[#ebe9e6] transition-colors"
                >
                  <Copy size={16} /> Copy Tracking URL
                </button>
              </>
            ) : (
              <p className="text-sm text-center text-[#ac312d] font-semibold">
                Tracking link is not ready yet. Please contact the store.
              </p>
            )}
          </div>

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
