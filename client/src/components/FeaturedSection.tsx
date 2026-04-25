import { menuData } from "@/lib/menuData";
import { Award, Flame, Sparkles, Star } from "lucide-react";
import { Link } from "wouter";

const badgeConfig = {
  bestseller: { label: "Best Seller", Icon: Star, className: "bg-[#ac312d] text-white" },
  "chefs-pick": { label: "Chef's Pick", Icon: Award, className: "bg-[#0d0f13] text-[#c08643]" },
  new: { label: "New", Icon: Sparkles, className: "bg-[#c08643] text-white" },
  spicy: { label: "Spicy", Icon: Flame, className: "bg-[#e88627] text-white" },
} as const;

export function FeaturedSection() {
  const allImageItems = menuData
    .filter((category) => category.id !== "featured")
    .flatMap((category) =>
      category.items
        .filter((item) => Boolean(item.image))
        .map((item) => ({ ...item, categoryName: category.name })),
    );

  const featured = Array.from(
    new Map(allImageItems.map((item) => [item.name.toLowerCase(), item])).values(),
  );
  const loopedItems = featured.length > 1 ? [...featured, ...featured] : featured;

  return (
    <section id="featured" className="py-16 md:py-24 bg-white overflow-hidden">
      <div className="container">
        <div className="text-center mb-12 md:mb-16">
          <p className="text-xs md:text-sm uppercase tracking-widest text-[#ac312d] font-bold mb-2">
            Kahit Isang Bite
          </p>
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Featured
          </h2>
          <p className="text-lg text-[#705d48] max-w-2xl mx-auto mb-6">
            Browse the dish photos here, then order inside the full menu.
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-[#e88627] via-[#c08643] to-[#ac312d] rounded-full mx-auto" />
        </div>

        <div className="relative mb-10 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-8 md:w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-8 md:w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div
            className={`flex w-max gap-4 md:gap-6 ${
              featured.length > 1
                ? "animate-[saiko-marquee_72s_linear_infinite] hover:[animation-play-state:paused]"
                : ""
            }`}
          >
            {loopedItems.map((item, index) => {
              const badge = item.badge ? badgeConfig[item.badge] : null;
              return (
                <article
                  key={`${item.id}-${index}`}
                  className="group relative min-w-[235px] max-w-[235px] md:min-w-[280px] md:max-w-[280px] bg-white rounded-xl overflow-hidden border border-[#ebe9e6] hover:border-[#c08643]/60 hover:shadow-xl transition-all duration-300"
                >
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
                      <span className="text-6xl opacity-60">?</span>
                    )}
                    {badge && (
                      <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md ${badge.className}`}>
                        <badge.Icon size={11} />
                        {badge.label}
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex flex-col gap-1">
                    <h3 className="font-poppins font-bold text-base md:text-lg text-[#0d0f13] leading-tight group-hover:text-[#ac312d] transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-[11px] uppercase tracking-wider text-[#705d48] line-clamp-1">
                      {item.categoryName}
                    </p>
                    <p className="font-poppins font-bold text-lg text-[#ac312d]">
                      PHP {item.price}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="text-center">
          <p className="text-[#705d48] mb-5 text-sm md:text-base">
            Add to cart is available on the menu page.
          </p>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#0d0f13] text-white font-poppins font-bold rounded-lg hover:bg-black hover:shadow-lg transition-all duration-200 uppercase tracking-wide"
          >
            View Full Menu
          </Link>
        </div>
      </div>
    </section>
  );
}
