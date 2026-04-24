import { MenuCategory } from "@/lib/menuData";
import { useEffect, useState } from "react";

interface CategoryNavProps {
  categories: MenuCategory[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || "");

  useEffect(() => {
    const handleScroll = () => {
      for (const category of categories) {
        const element = document.getElementById(category.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) setActiveCategory(category.id);
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categories]);

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveCategory(categoryId);
    }
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e5e2de] shadow-sm">
      <div className="container">
        <div className="flex overflow-x-auto gap-2 py-3 -mx-4 px-4 md:mx-0 md:px-0 md:gap-1">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => scrollToCategory(category.id)}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all duration-200 flex-shrink-0 uppercase tracking-wide ${
                activeCategory === category.id
                  ? "bg-[#ac312d] text-white shadow-md"
                  : "text-[#0d0f13] hover:bg-[#ebe9e6]"
              }`}
            >
              <span className="text-lg">{category.emoji}</span>
              <span className="hidden sm:inline">{category.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
