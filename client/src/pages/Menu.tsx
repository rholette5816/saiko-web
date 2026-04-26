import { CategoryNav } from "@/components/CategoryNav";
import { CategorySection } from "@/components/CategorySection";
import { Footer } from "@/components/Footer";
import { MenuSearch } from "@/components/MenuSearch";
import { MobileActionBar } from "@/components/MobileActionBar";
import { OpenStatusBadge } from "@/components/OpenStatusBadge";
import { TopNav } from "@/components/TopNav";
import { useCart } from "@/lib/cart";
import { menuData } from "@/lib/menuData";
import { Phone, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function Menu() {
  const [query, setQuery] = useState("");
  const { openDrawer } = useCart();

  useEffect(() => {
    document.title = "Menu · Saiko Ramen & Sushi - Home Made Ramen, Sushi, Bento";
  }, []);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menuData;
    return menuData
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q) ||
            cat.name.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [query]);

  const resultCount = query
    ? filteredMenu.reduce((sum, c) => sum + c.items.length, 0)
    : null;

  const categoriesForNav = filteredMenu.length ? filteredMenu : menuData;

  return (
    <div
      className="min-h-screen bg-white pb-24 md:pb-0 no-select-content"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <a href="#menu-top" className="skip-link">Skip to menu</a>
      <TopNav />

      {/* Page Header */}
      <header className="bg-[#ebe9e6] border-b border-[#e5e2de]">
        <div className="container py-8 md:py-12 text-center">
          <p className="text-xs md:text-sm uppercase tracking-widest text-[#ac312d] font-bold mb-2">
            Saiko Ramen & Sushi
          </p>
          <h1 className="font-poppins font-bold text-3xl md:text-5xl text-[#0d0f13] uppercase tracking-tight mb-3">
            Our Full Menu
          </h1>
          <p className="text-[#705d48] max-w-xl mx-auto mb-4">
            Home-made ramen, hand-rolled sushi, bento, donburi, and more. Bagong luto, sulit na sulit.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <OpenStatusBadge />
            <span className="text-[#705d48] text-sm">·</span>
            <span className="text-sm text-[#705d48]">
              {menuData.length} categories · {menuData.reduce((n, c) => n + c.items.length, 0)} dishes
            </span>
          </div>
        </div>
      </header>

      {/* Sticky Category Nav */}
      <CategoryNav categories={categoriesForNav} />

      {/* Menu Content */}
      <main id="menu-top" className="bg-white">
        <div className="container py-10 md:py-14">
          <MenuSearch value={query} onChange={setQuery} resultCount={resultCount} />

          {filteredMenu.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#705d48]">No dishes matched your search. Try another keyword.</p>
            </div>
          ) : (
            filteredMenu.map((category, index) => (
              <CategorySection
                key={category.id}
                category={category}
                index={index}
              />
            ))
          )}
        </div>

        {/* Order CTA */}
        <div className="bg-[#0d0f13] py-12 md:py-16">
          <div className="container text-center">
            <h2 className="font-poppins font-bold text-2xl md:text-3xl text-white mb-3 uppercase tracking-wide">
              Ready to Order?
            </h2>
            <p className="text-[#ebe9e6]/80 mb-6 max-w-xl mx-auto">
              Add your dishes to cart, checkout in a minute, and get a live tracking link right away.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <button
                type="button"
                onClick={openDrawer}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors min-w-[220px]"
              >
                <ShoppingBag size={18} /> Review Cart
              </button>
              <a
                href="tel:09178658587"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-[#ebe9e6]/40 text-[#ebe9e6] font-bold uppercase tracking-wide rounded-lg hover:bg-white/10 transition-colors min-w-[220px]"
              >
                <Phone size={18} /> Call Store
              </a>
            </div>
            <p className="text-xs text-[#ebe9e6]/65">
              Already ordered? Use your tracking link from Order Confirmation.
            </p>
          </div>
        </div>
      </main>

      <Footer />
      <MobileActionBar />
    </div>
  );
}
