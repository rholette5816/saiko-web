import { Footer } from "@/components/Footer";
import { TopNav } from "@/components/TopNav";
import { useCart } from "@/lib/cart";
import { getPickupOptions, type PickupSlot } from "@/lib/pickupSlots";
import { formatOrderText } from "@/lib/orderFormat";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, ChevronLeft } from "lucide-react";

export default function Checkout() {
  const cart = useCart();
  const [, navigate] = useLocation();

  useEffect(() => {
    document.title = "Checkout · Saiko Ramen & Sushi";
  }, []);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupValue, setPickupValue] = useState<string>("asap");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickup = useMemo(() => getPickupOptions(), []);
  const selectedSlot: PickupSlot | undefined = pickup.slots.find((s) => s.value === pickupValue);

  // If pickup options change (e.g., closed state) make sure the selection is valid.
  useEffect(() => {
    if (!pickup.slots.length) return;
    if (!pickup.slots.find((s) => s.value === pickupValue)) {
      setPickupValue(pickup.slots[0].value);
    }
  }, [pickup.slots, pickupValue]);

  const canSubmit =
    cart.items.length > 0 &&
    name.trim().length >= 2 &&
    /^09\d{9}$/.test(phone.replace(/\s|-/g, "")) &&
    !!selectedSlot &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedSlot) return;
    setSubmitting(true);
    setError(null);

    const orderText = formatOrderText(cart.items, {
      name: name.trim(),
      phone: phone.trim(),
      pickupLabel: selectedSlot.label,
      notes: notes.trim() || undefined,
    });

    const orderItems = cart.items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
    }));

    try {
      const { data: orderResult, error: orderError } = await supabase.rpc("place_order_with_items", {
        p_customer_name: name.trim(),
        p_customer_phone: phone.trim(),
        p_pickup_label: selectedSlot.label,
        p_pickup_time: selectedSlot.date.toISOString(),
        p_is_pre_order: selectedSlot.isTomorrow ?? false,
        p_notes: notes.trim() || null,
        p_total_amount: cart.totalPrice,
        p_items: orderItems,
      });

      const firstRow = Array.isArray(orderResult) ? orderResult[0] : orderResult;
      const orderNumber =
        firstRow && typeof firstRow === "object" && "order_number" in firstRow
          ? String((firstRow as { order_number: string }).order_number)
          : "";

      if (orderError || !orderNumber) {
        setError("Something went wrong. Try again or call us directly.");
        setSubmitting(false);
        return;
      }

      // Stash for confirmation page.
      sessionStorage.setItem(
        "saiko-last-order",
        JSON.stringify({
          orderNumber,
          orderText,
          name: name.trim(),
          phone: phone.trim(),
          pickup: selectedSlot.label,
          isTomorrow: !!selectedSlot.isTomorrow,
          total: cart.totalPrice,
        }),
      );

      cart.clear();
      navigate("/order-confirmed");
    } catch {
      setError("Something went wrong. Try again or call us directly.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#ebe9e6] pb-24 md:pb-0">
      <TopNav />

      <div className="container py-8 md:py-12 max-w-3xl">
        <Link
          href="/menu"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#705d48] hover:text-[#ac312d] mb-4"
        >
          <ChevronLeft size={16} /> Back to menu
        </Link>

        <h1 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-2 uppercase tracking-tight">
          Checkout
        </h1>
        <p className="text-[#705d48] mb-6">Pickup only. Pay when you collect your order.</p>

        {pickup.showPreOrderNotice && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-lg bg-[#0d0f13] text-white">
            <AlertCircle size={20} className="text-[#f5a24b] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">We're closed right now.</p>
              <p className="opacity-80">
                You can still place a pre-order. Pickup slots below are for tomorrow when we reopen at 10:00 AM.
              </p>
            </div>
          </div>
        )}

        {cart.items.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center">
            <p className="font-semibold text-[#0d0f13] mb-2">Your cart is empty.</p>
            <p className="text-sm text-[#705d48] mb-6">Add a few dishes from the menu to continue.</p>
            <Link
              href="/menu"
              className="inline-block px-6 py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Form */}
            <div className="md:col-span-2 bg-white rounded-2xl p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold uppercase tracking-wide text-[#0d0f13] mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Juan Dela Cruz"
                  className="w-full px-4 py-3 rounded-lg border-2 border-[#ebe9e6] focus:outline-none focus:border-[#c08643] bg-white text-[#0d0f13]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wide text-[#0d0f13] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="0917 123 4567"
                  inputMode="tel"
                  className="w-full px-4 py-3 rounded-lg border-2 border-[#ebe9e6] focus:outline-none focus:border-[#c08643] bg-white text-[#0d0f13]"
                />
                <p className="text-xs text-[#705d48] mt-1">
                  We'll only text or call to confirm your pickup.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wide text-[#0d0f13] mb-2">
                  Pickup Time
                </label>
                {pickup.slots.length === 0 ? (
                  <p className="text-sm text-[#ac312d]">No pickup slots available right now. Please try again later.</p>
                ) : (
                  <select
                    value={pickupValue}
                    onChange={(e) => setPickupValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border-2 border-[#ebe9e6] focus:outline-none focus:border-[#c08643] bg-white text-[#0d0f13]"
                  >
                    {pickup.slots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-[#705d48] mt-1">
                  Minimum prep time is {pickup.prepMinutes} minutes.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wide text-[#0d0f13] mb-2">
                  Special Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Allergies, less spice, extra rice, etc."
                  className="w-full px-4 py-3 rounded-lg border-2 border-[#ebe9e6] focus:outline-none focus:border-[#c08643] bg-white text-[#0d0f13] resize-none"
                />
              </div>

              <p className="text-xs text-[#705d48]">
                Your order will be sent to our Messenger right after you tap Place Order. Confirm pickup details there.
              </p>

              {error && (
                <p className="text-sm text-[#ac312d] font-medium">{error}</p>
              )}
            </div>

            {/* Summary */}
            <aside className="bg-white rounded-2xl p-6 md:p-7 h-fit md:sticky md:top-20 space-y-4">
              <h2 className="font-poppins font-bold uppercase tracking-wide text-[#0d0f13]">Order Summary</h2>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {cart.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#0d0f13] truncate">{item.name}</p>
                      <p className="text-xs text-[#705d48]">
                        {item.quantity} × ₱{item.price}
                      </p>
                    </div>
                    <p className="font-bold text-[#0d0f13] flex-shrink-0">
                      ₱{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="pt-3 border-t border-[#ebe9e6] flex items-baseline justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-[#705d48]">Total</span>
                <span className="font-poppins font-bold text-2xl text-[#ac312d]">
                  ₱{cart.totalPrice.toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Place Order"}
              </button>
              <p className="text-xs text-[#705d48] text-center">
                Pickup only. No payment online. Pay at the counter.
              </p>
            </aside>
          </form>
        )}
      </div>

      <Footer />
    </div>
  );
}
