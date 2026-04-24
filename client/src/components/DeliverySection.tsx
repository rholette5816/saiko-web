import { Bike } from "lucide-react";

/*
  TODO: Replace href="#" with real GrabFood + FoodPanda store URLs once listings are live.
  When ready, also remove the "comingSoon" badge below.
*/
const platforms = [
  {
    name: "GrabFood",
    href: "#",
    accent: "#00b140",
    tagline: "Order via Grab",
    comingSoon: true,
  },
  {
    name: "FoodPanda",
    href: "#",
    accent: "#d70f64",
    tagline: "Order via Panda",
    comingSoon: true,
  },
];

export function DeliverySection() {
  return (
    <section className="py-10 md:py-14 bg-[#ebe9e6]">
      <div className="container">
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-2 text-[#ac312d] font-poppins font-bold uppercase tracking-wide text-sm mb-2">
            <Bike size={18} /> Saiko Sa Inyong Bahay
          </div>
          <h2 className="font-poppins font-bold text-2xl md:text-3xl text-[#0d0f13] uppercase tracking-wide">
            Order Delivery
          </h2>
          <p className="text-[#705d48] mt-2 text-sm md:text-base">
            Too sulit to pass up. Get Saiko delivered hot to your door.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {platforms.map(({ name, href, accent, tagline, comingSoon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={comingSoon}
              onClick={(e) => comingSoon && e.preventDefault()}
              className={`relative group bg-white rounded-xl p-6 flex items-center justify-between border-2 border-transparent hover:border-[#c08643] hover:shadow-lg transition-all duration-200 ${
                comingSoon ? "cursor-not-allowed opacity-90" : ""
              }`}
            >
              <div>
                <p className="text-xs uppercase tracking-widest text-[#705d48] mb-1">{tagline}</p>
                <p className="font-poppins font-bold text-xl md:text-2xl" style={{ color: accent }}>
                  {name}
                </p>
              </div>
              {comingSoon ? (
                <span className="text-xs font-bold uppercase tracking-widest bg-[#0d0f13] text-[#c08643] px-3 py-1 rounded-full">
                  Coming Soon
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-widest text-[#ac312d] group-hover:translate-x-1 transition-transform">
                  Order →
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
