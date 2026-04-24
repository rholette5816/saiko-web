import { MenuCategory } from "@/lib/menuData";
import { MenuItemCard } from "./MenuItemCard";

interface CategorySectionProps {
  category: MenuCategory;
  index?: number;
}

export function CategorySection({ category, index = 0 }: CategorySectionProps) {
  return (
    <section
      id={category.id}
      className="py-12 md:py-16 border-b border-[#ebe9e6] last:border-b-0 scroll-mt-20"
    >
      {/* Category Header with Gradient Accent */}
      <div className="mb-8 relative">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-3xl md:text-4xl">{category.emoji}</span>
          <h2 className="font-poppins font-bold text-2xl md:text-3xl text-[#0d0f13] uppercase tracking-wide">
            {category.name}
          </h2>
        </div>
        <div className="h-1 w-24 bg-gradient-to-r from-[#e88627] via-[#c08643] to-[#ac312d] rounded-full" />
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
        {category.items.map((item, itemIndex) => (
          <MenuItemCard key={item.id} item={item} index={itemIndex} />
        ))}
      </div>
    </section>
  );
}
