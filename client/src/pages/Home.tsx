import { Analytics } from "@/components/Analytics";
import { AboutSection } from "@/components/AboutSection";
import { FeaturedSection } from "@/components/FeaturedSection";
import { DeliverySection } from "@/components/DeliverySection";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { LocationSection } from "@/components/LocationSection";
import { MobileActionBar } from "@/components/MobileActionBar";
import { Reveal } from "@/components/Reveal";
import { ReviewsSection } from "@/components/ReviewsSection";
import { TeamSection } from "@/components/TeamSection";
import { TopNav } from "@/components/TopNav";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    document.title = "Saiko Ramen & Sushi - Home Made Ramen Noodles in Oton, Iloilo";
  }, []);

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <a href="#featured" className="skip-link">Skip to featured dishes</a>
      <TopNav />
      <HeroSection />

      <Reveal><DeliverySection /></Reveal>
      <section id="about"><Reveal><AboutSection /></Reveal></section>
      <Reveal><FeaturedSection /></Reveal>
      <Reveal><ReviewsSection /></Reveal>
      <Reveal><TeamSection /></Reveal>
      <section id="location"><Reveal><LocationSection /></Reveal></section>

      <Footer />

      <MobileActionBar />
      <Analytics />
    </div>
  );
}
