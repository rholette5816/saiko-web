import { useCart } from "@/lib/cart";
import { ShoppingBag } from "lucide-react";

/*
  Floating cart button. Always visible on mobile.
  Sits at the upper-right on mobile for immediate visibility.
*/
export function CartButton() {
  const { totalQty, openDrawer } = useCart();
  const hasItems = totalQty > 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      className={`md:hidden fixed right-4 top-4 z-50 bg-[#0d0f13] text-white rounded-full shadow-2xl hover:bg-black transition-all active:scale-95 ${
        hasItems ? "flex items-center justify-center gap-1.5 h-11 min-w-14 px-2.5" : "w-11 h-11 flex items-center justify-center"
      }`}
      style={{ position: "fixed", right: "1rem", top: "calc(env(safe-area-inset-top) + 1rem)" }}
      aria-label={hasItems ? `Open cart, ${totalQty} item${totalQty === 1 ? "" : "s"}` : "Open cart"}
    >
      <ShoppingBag size={18} />
      {hasItems && (
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
