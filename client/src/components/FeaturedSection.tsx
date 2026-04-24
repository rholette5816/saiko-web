import { menuData } from "@/lib/menuData";
import { Link } from "wouter";
import { Flame, Star, Sparkles, Award } from "lucide-react";

const badgeConfig = {
  bestseller: { label: "Best Seller", Icon: Star, className: "bg-[#ac312d] text-white" },
  "chefs-pick": { label: "Chef's Pick", Icon: Award, className: "bg-[#0d0f13] text-[#c08643]" },
  new: { label: "New", Icon: Sparkles, className: "bg-[#c08643] text-white" },
  spicy: { label: "Spicy", Icon: Flame, className: "bg-[#e88627] text-white" },
} as const;

export function FeaturedSection() {
  const featured = menuData.find((c) => c.id === "featured")?.items.slice(0, 4) ?? [];

  return (
    <section id="featured" className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="text-center mb-12 md:mb-16">
          <p className="text-xs md:text-sm uppercase tracking-widest text-[#ac312d] font-bold mb-2">
            Must-Try Dishes
          </p>
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Featured
          </h2>
          <p className="text-lg text-[#705d48] max-w-2xl mx-auto mb-6">
            Our chef's picks that regulars keep coming back for. Start here, then explore the full menu.
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-[#e88627] via-[#c08643] to-[#ac312d] rounded-full mx-auto" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 mb-10">
          {featured.map((item, index) => {
            const badge = item.badge ? badgeConfig[item.badge] : null;
            return (
              <article
                key={item.id}
                className="group relative bg-white rounded-2xl overflow-hidden border border-[#ebe9e6] hover:border-[#c08643]/60 hover:shadow-xl transition-all duration-300"
                style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards` }}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-[#ebe9e6] via-[#f5f4f2] to-[#ebe9e6] flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="text-7xl opacity-60">🍜</span>
                  )}
                  {badge && (
                    <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md ${badge.className}`}>
                      <badge.Icon size={11} />
                      {badge.label}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-poppins font-bold text-lg text-[#0d0f13] mb-1 leading-tight group-hover:text-[#ac312d] transition-colors">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-[#705d48] mb-4 leading-snug line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <p className="font-poppins font-bold text-xl text-[#ac312d]">
                    ₱{item.price}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-[#705d48] mb-5 text-sm md:text-base">
            Plus {menuData.reduce((n, c) => n + c.items.length, 0) - 4}+ more dishes across{" "}
            {menuData.length} categories
          </p>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#0d0f13] text-white font-poppins font-bold rounded-lg hover:bg-black hover:shadow-lg transition-all duration-200 uppercase tracking-wide"
          >
            View Full Menu →
          </Link>
        </div>
      </div>
    </section>
  );
}
