import { CategoryNav } from "@/components/CategoryNav";
import { CategorySection } from "@/components/CategorySection";
import { DeliverySection } from "@/components/DeliverySection";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { AboutSection } from "@/components/AboutSection";
import { MenuPreviewSection } from "@/components/MenuPreviewSection";
import { MenuSearch } from "@/components/MenuSearch";
import { MobileActionBar } from "@/components/MobileActionBar";
import { NewsletterBanner } from "@/components/NewsletterBanner";
import { Reveal } from "@/components/Reveal";
import { Analytics } from "@/components/Analytics";
import { ReviewsSection } from "@/components/ReviewsSection";
import { TeamSection } from "@/components/TeamSection";
import { LocationSection } from "@/components/LocationSection";
import { menuData } from "@/lib/menuData";
import { useMemo, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");

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

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-0">
      <a href="#full-menu" className="skip-link">Skip to menu</a>
      <HeroSection />
      <Reveal><DeliverySection /></Reveal>
      <Reveal><AboutSection /></Reveal>
      <Reveal><MenuPreviewSection /></Reveal>

      {/* Full Menu - always visible. Category nav sticks as user scrolls. */}
      <section id="full-menu" className="bg-white">
        <CategoryNav categories={filteredMenu.length ? filteredMenu : menuData} />
        <div className="container py-12 md:py-16">
          <MenuSearch value={query} onChange={setQuery} resultCount={resultCount} />
          {filteredMenu.map((category, index) => (
            <CategorySection
              key={category.id}
              category={category}
              index={index}
            />
          ))}
        </div>
      </section>

      <Reveal><ReviewsSection /></Reveal>
      <Reveal><NewsletterBanner /></Reveal>
      <Reveal><TeamSection /></Reveal>
      <Reveal><LocationSection /></Reveal>
      <Footer />

      <MobileActionBar />
      <Analytics />
    </div>
  );
}
