import logo from "@/assets/logo.png";
import { Phone, MessageCircle, Star } from "lucide-react";
import { OpenStatusBadge } from "./OpenStatusBadge";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 py-12 md:py-20 items-center">
        {/* Left Content */}
        <div className="flex flex-col gap-6 z-10">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <img
              src={logo}
              alt="Saiko Ramen & Sushi"
              className="h-24 md:h-28 w-auto"
            />
            <h1 className="sr-only">Saiko Ramen & Sushi</h1>
          </div>

          {/* Social Proof Strip */}
          <div className="flex items-center gap-2 text-sm">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} className="fill-[#e88627] text-[#e88627]" />
              ))}
            </div>
            <span className="font-semibold text-[#0d0f13]">4.8</span>
            <span className="text-[#705d48]">· Loved by 1,000+ diners in Iloilo</span>
          </div>

          {/* Main Heading */}
          <div className="space-y-3">
            <h2 className="font-poppins font-bold text-3xl md:text-5xl text-[#0d0f13] leading-tight uppercase tracking-tight">
              Home Made{" "}
              <span className="bg-gradient-to-r from-[#e88627] via-[#c08643] to-[#ac312d] bg-clip-text text-transparent">
                Ramen Noodles
              </span>
            </h2>
            <p className="text-base md:text-lg text-[#705d48] max-w-md">
              Authentic Japanese cuisine crafted with quality ingredients, fresh
              flavors, and a memorable dining experience.
            </p>
            <p className="text-sm font-medium text-[#ac312d]">
              Starts at ₱189 · Sulit Ramen for Every Barkada
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href="https://m.me/saikoramenandsushi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-[#ac312d] text-white font-poppins font-bold rounded-lg hover:bg-[#8f2825] hover:shadow-lg transition-all duration-200 text-center uppercase tracking-wide"
            >
              <MessageCircle size={18} /> Message Us
            </a>
            <a
              href="tel:09178658587"
              className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-[#0d0f13] text-white font-poppins font-bold rounded-lg hover:bg-black hover:shadow-lg transition-all duration-200 text-center uppercase tracking-wide"
            >
              <Phone size={18} /> Call Now
            </a>
            <a
              href="#full-menu"
              className="flex items-center justify-center px-6 md:px-8 py-3 md:py-4 border-2 border-[#0d0f13] text-[#0d0f13] font-poppins font-bold rounded-lg hover:bg-[#ebe9e6] transition-all duration-200 text-center uppercase tracking-wide"
            >
              View Menu
            </a>
          </div>

          {/* Quick Info */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm md:text-base">
            <OpenStatusBadge />
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <span className="text-[#705d48]">Oton, Iloilo</span>
            </div>
          </div>
        </div>

        {/* Right Image */}
        <div className="relative h-96 md:h-full min-h-96 md:min-h-[500px]">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#ebe9e6] to-[#f5f4f2] rounded-3xl" />

          <div className="relative h-full flex items-center justify-center">
            {/* TODO: Replace with real Saiko best-seller bowl photo. Steaming shot, overhead or 45deg, natural light. */}
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663376430088/RVzgkYvoeVKSdip6UycaUV/ramen-hero-QD29TgxjNRG4Rwab59pvr7.webp"
              alt="Saiko Ramen Bowl"
              className="w-full h-full object-cover rounded-3xl shadow-2xl hover:shadow-3xl transition-shadow duration-300"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>

          {/* Floating Badge */}
          <div className="absolute bottom-6 left-6 bg-white rounded-full px-4 py-2 shadow-xl flex items-center gap-2">
            <Star size={18} className="fill-[#e88627] text-[#e88627]" />
            <p className="font-poppins font-bold text-[#0d0f13] text-sm md:text-base">
              4.8 on Facebook
            </p>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-[#ebe9e6]/30 pointer-events-none" />
    </section>
  );
}
