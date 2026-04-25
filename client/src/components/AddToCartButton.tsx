import { useCart, type CartItem } from "@/lib/cart";
import { Plus, Minus, ShoppingBag } from "lucide-react";

interface AddToCartButtonProps {
  item: Omit<CartItem, "quantity">;
  variant?: "compact" | "full";
}

export function AddToCartButton({ item, variant = "compact" }: AddToCartButtonProps) {
  const { items, add, setQty } = useCart();
  const inCart = items.find((i) => i.id === item.id);

  if (inCart) {
    return (
      <div className="inline-flex items-center bg-[#0d0f13] rounded-full overflow-hidden">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setQty(item.id, inCart.quantity - 1);
          }}
          className="px-2.5 py-2 text-white hover:bg-[#ac312d] transition-colors"
          aria-label={`Decrease ${item.name}`}
        >
          <Minus size={14} />
        </button>
        <span className="px-3 text-sm font-bold text-white min-w-[28px] text-center">
          {inCart.quantity}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setQty(item.id, inCart.quantity + 1);
          }}
          className="px-2.5 py-2 text-white hover:bg-[#ac312d] transition-colors"
          aria-label={`Add another ${item.name}`}
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          add(item);
        }}
        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#ac312d] text-white text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors"
      >
        <ShoppingBag size={14} /> Add to Cart
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        add(item);
      }}
      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#ac312d] text-white text-xs font-bold uppercase tracking-wide rounded-full hover:bg-[#8f2825] transition-colors"
      aria-label={`Add ${item.name} to cart`}
    >
      <Plus size={12} /> Add
    </button>
  );
}
