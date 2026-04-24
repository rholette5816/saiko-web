import { MenuItem, MenuBadge } from "@/lib/menuData";
import { Flame } from "lucide-react";

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
  const badge = item.badge ? badgeStyles[item.badge] : null;

  return (
    <div
      className="group flex gap-3 py-4 px-3 rounded-lg hover:bg-[#ebe9e6] transition-all duration-200 cursor-pointer"
      style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.05}s backwards` }}
    >
      {/* Image slot (optional). TODO: populate item.image with real dish photos. */}
      {item.image && (
        <img
          src={item.image}
          alt={item.name}
          className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover flex-shrink-0"
          loading="lazy"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {badge && (
          <span className={`inline-flex items-center gap-1 self-start text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.className}`}>
            {item.badge === "spicy" && <Flame size={10} />}
            {badge.label}
          </span>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-poppins font-semibold text-sm md:text-base text-[#0d0f13] group-hover:text-[#ac312d] transition-colors">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-xs md:text-sm text-[#705d48] mt-1 leading-snug">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-poppins font-bold text-base md:text-lg text-[#ac312d]">
              ₱{item.price}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
