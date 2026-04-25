import { useCart } from "@/lib/cart";
import { ShoppingBag } from "lucide-react";

/*
  Floating cart button. Always visible on mobile.
  Sits at the upper-right on mobile for immediate visibility.
*/
export function CartButton() {
  const { totalQty, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="md:hidden fixed right-4 top-4 z-50 flex items-center gap-2 px-5 py-3 bg-[#0d0f13] text-white rounded-full shadow-2xl hover:bg-black transition-all active:scale-95"
      style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      aria-label={`Open cart, ${totalQty} item${totalQty === 1 ? "" : "s"}`}
    >
      <ShoppingBag size={18} />
      <span className="font-bold text-sm uppercase tracking-wide">Cart</span>
      {totalQty > 0 && (
        <span className="bg-[#ac312d] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
          {totalQty}
        </span>
      )}
    </button>
  );
}

/*
  Inline cart icon for the desktop TopNav. Always visible there.
*/
export function CartIconNav() {
  const { totalQty, openDrawer } = useCart();

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative p-2 rounded-lg hover:bg-[#ebe9e6] transition-colors text-[#0d0f13]"
      aria-label={`Open cart, ${totalQty} item${totalQty === 1 ? "" : "s"}`}
    >
      <ShoppingBag size={22} />
      {totalQty > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#ac312d] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {totalQty}
        </span>
      )}
    </button>
  );
}
