import { MenuItem } from "@/lib/menuData";

interface MenuItemCardProps {
  item: MenuItem;
  index?: number;
}

export function MenuItemCard({ item, index = 0 }: MenuItemCardProps) {
  return (
    <div
      className="group flex flex-col gap-2 py-4 px-3 rounded-lg hover:bg-orange-50 transition-all duration-200 hover:shadow-md cursor-pointer"
      style={{
        animation: `fadeInUp 0.5s ease-out ${index * 0.05}s backwards`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-poppins font-semibold text-sm md:text-base text-foreground group-hover:text-orange-600 transition-colors">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {item.description}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-poppins font-bold text-base md:text-lg text-orange-600">
            ₱{item.price}
          </p>
        </div>
      </div>
    </div>
  );
}

// Add animation keyframes
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);
