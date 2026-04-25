import { useCart } from "@/lib/cart";
import { Link } from "wouter";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useEffect } from "react";

export function CartDrawer() {
  const { items, totalPrice, totalQty, isOpen, closeDrawer, setQty, remove } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeDrawer]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Cart">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#ebe9e6]">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-[#ac312d]" />
            <h2 className="font-poppins font-bold text-lg uppercase tracking-wide text-[#0d0f13]">
              Your Order
            </h2>
            {totalQty > 0 && (
              <span className="text-sm text-[#705d48]">
                ({totalQty} {totalQty === 1 ? "item" : "items"})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="p-2 rounded-full hover:bg-[#ebe9e6] text-[#0d0f13]"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag size={48} className="text-[#ebe9e6] mb-4" />
              <p className="font-semibold text-[#0d0f13] mb-1">Your cart is empty</p>
              <p className="text-sm text-[#705d48] mb-6">
                Add a few dishes from the menu and they'll show up here.
              </p>
              <Link
                href="/menu"
                onClick={closeDrawer}
                className="px-6 py-2.5 bg-[#ac312d] text-white text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
              >
                Browse Menu
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 p-3 rounded-lg border border-[#ebe9e6] bg-white"
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#0d0f13] text-sm leading-tight mb-1">
                      {item.name}
                    </h3>
                    <p className="text-sm text-[#ac312d] font-bold mb-2">
                      ₱{item.price} each
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center bg-[#ebe9e6] rounded-full overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setQty(item.id, item.quantity - 1)}
                          className="px-2 py-1.5 text-[#0d0f13] hover:bg-[#0d0f13] hover:text-white transition-colors"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-[#0d0f13] min-w-[24px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(item.id, item.quantity + 1)}
                          className="px-2 py-1.5 text-[#0d0f13] hover:bg-[#0d0f13] hover:text-white transition-colors"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="ml-auto p-1.5 rounded-full text-[#705d48] hover:bg-[#ebe9e6] hover:text-[#ac312d] transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-poppins font-bold text-[#0d0f13] text-sm">
                      ₱{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#ebe9e6] p-5 bg-[#ebe9e6]/30 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide text-[#705d48]">
                Subtotal
              </span>
              <span className="font-poppins font-bold text-2xl text-[#ac312d]">
                ₱{totalPrice.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-[#705d48]">
              Pickup only. Pay when you collect your order.
            </p>
            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="block w-full py-3 bg-[#ac312d] text-white text-center font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
            >
              Checkout
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
