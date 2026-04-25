import { type MenuBadge, type MenuItem } from "@/lib/menuData";
import { useMenuOverrides } from "@/lib/itemOverrides";
import { Flame } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";

interface MenuItemCardProps {
  item: MenuItem;
  index?: number;
}

const badgeStyles: Record<MenuBadge, { label: string; className: string }> = {
  bestseller: { label: "Best Seller", className: "bg-[#ac312d] text-white" },
  "chefs-pick": { label: "Chef's Pick", className: "bg-[#0d0f13] text-[#c08643]" },
  new: { label: "New", className: "bg-[#c08643] text-white" },
  spicy: { label: "Spicy", className: "bg-[#e88627] text-white" },
};

export function MenuItemCard({ item, index = 0 }: MenuItemCardProps) {
  const { getOverride } = useMenuOverrides();
  const override = getOverride(item.id);
  const isSoldOut = !override.is_available;
  const effectiveBadge: MenuBadge | null = item.badge ?? (override.is_best_seller ? "bestseller" : null);
  const badge = effectiveBadge ? badgeStyles[effectiveBadge] : null;

  return (
    <div
      className="group relative flex gap-3 py-4 px-3 rounded-lg hover:bg-[#ebe9e6] transition-all duration-200 cursor-pointer"
      style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.05}s backwards` }}
    >
      {isSoldOut && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#705d48] text-white">
            Sold Out
          </span>
        </div>
      )}

      {item.image && (
        <img
          src={item.image}
          alt={item.name}
          className={`w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover flex-shrink-0 ${isSoldOut ? "grayscale opacity-75" : ""}`}
          loading="lazy"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {badge && (
          <span className={`inline-flex items-center gap-1 self-start text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.className}`}>
            {effectiveBadge === "spicy" && <Flame size={10} />}
            {badge.label}
          </span>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={`font-poppins font-semibold text-sm md:text-base transition-colors ${isSoldOut ? "text-[#705d48] line-through" : "text-[#0d0f13] group-hover:text-[#ac312d]"}`}>
              {item.name}
            </h3>
            {item.description && (
              <p className="text-xs md:text-sm text-[#705d48] mt-1 leading-snug">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-right flex flex-col items-end gap-2 min-w-[96px]">
            <p className="font-poppins font-bold text-base md:text-lg text-[#ac312d]">
              PHP {item.price}
            </p>
            {isSoldOut ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#d8d2cb] text-[#705d48] text-xs font-bold uppercase tracking-wide rounded-full cursor-not-allowed"
              >
                Unavailable
              </button>
            ) : (
              <AddToCartButton
                item={{ id: item.id, name: item.name, price: item.price, image: item.image }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
