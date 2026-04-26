import { menuData } from "@/lib/menuData";
import { useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";

export function FeaturedSection() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pauseUntilRef = useRef(0);

  const pauseAutoScroll = useCallback((ms = 3500) => {
    pauseUntilRef.current = performance.now() + ms;
  }, []);

  const allImageItems = menuData
    .filter((category) => category.id !== "featured")
    .flatMap((category) =>
      category.items.filter((item) => Boolean(item.image)),
    );

  const featured = Array.from(
    new Map(allImageItems.map((item) => [item.name.toLowerCase(), item])).values(),
  );
  const loopedItems = featured.length > 1 ? [...featured, ...featured] : featured;
  const hasLoop = featured.length > 1;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !hasLoop) return;

    let frame = 0;
    let lastTime = performance.now();
    const speedPxPerSecond = 22;

    const tick = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (time >= pauseUntilRef.current) {
        const halfWidth = scroller.scrollWidth / 2;
        if (halfWidth > 0) {
          scroller.scrollLeft += (speedPxPerSecond * delta) / 1000;
          if (scroller.scrollLeft >= halfWidth) {
            scroller.scrollLeft -= halfWidth;
          }
        }
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hasLoop]);

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
            ref={scrollerRef}
            onPointerDown={() => pauseAutoScroll(5000)}
            onTouchStart={() => pauseAutoScroll(5000)}
            onScroll={() => pauseAutoScroll(1800)}
            className="overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
          >
            <div className="flex w-max gap-4 md:gap-6 px-2 md:px-4">
              {loopedItems.map((item, index) => (
                <article
                  key={`${item.id}-${index}`}
                  className="group relative snap-start min-w-[280px] max-w-[280px] md:min-w-[360px] md:max-w-[360px] bg-white rounded-xl overflow-hidden border border-[#ebe9e6] hover:border-[#c08643]/60 hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative aspect-[5/4] bg-gradient-to-br from-[#ebe9e6] via-[#f5f4f2] to-[#ebe9e6] flex items-center justify-center overflow-hidden">
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
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[#705d48] mb-5 text-sm md:text-base">
            To make an order, please go to the full menu.
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
