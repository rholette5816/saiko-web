import { CategoryNav } from "@/components/CategoryNav";
import { CategorySection } from "@/components/CategorySection";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { AboutSection } from "@/components/AboutSection";
import { MenuPreviewSection } from "@/components/MenuPreviewSection";
import { ReviewsSection } from "@/components/ReviewsSection";
import { TeamSection } from "@/components/TeamSection";
import { LocationSection } from "@/components/LocationSection";
import { menuData } from "@/lib/menuData";
import { useState } from "react";

/**
 * Design Philosophy: Warm Minimalism with Depth
 * - Strategic use of gradient accent (yellow-orange) for warmth and appetite appeal
 * - Clean typography hierarchy with Poppins for headers, Inter for body
 * - Generous whitespace and asymmetric layouts inspired by Japanese design
 * - Smooth interactions and staggered animations for visual rhythm
 * - Full brand experience: hero, about, menu preview, reviews, team, location
 */
export default function Home() {
  const [showFullMenu, setShowFullMenu] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <HeroSection />

      {/* About Section */}
      <AboutSection />

      {/* Menu Preview Section */}
      <MenuPreviewSection />

      {/* Reviews Section */}
      <ReviewsSection />

      {/* Team Section */}
      <TeamSection />

      {/* Location & Contact Section */}
      <LocationSection />

      {/* Full Menu Section */}
      {showFullMenu && (
        <>
          {/* Sticky Category Navigation */}
          <CategoryNav categories={menuData} />

          {/* Menu Content */}
          <main className="bg-white">
            <div className="container py-12 md:py-16">
              {/* Menu Categories */}
              {menuData.map((category, index) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  index={index}
                />
              ))}
            </div>
          </main>
        </>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}
