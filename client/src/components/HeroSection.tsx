export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 py-12 md:py-20 items-center">
        {/* Left Content */}
        <div className="flex flex-col gap-6 z-10">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#0d0f13] flex items-center justify-center shadow-lg">
              <span className="text-[#c08643] text-xl font-bold">S</span>
            </div>
            <div>
              <h1 className="font-poppins font-bold text-2xl md:text-3xl text-[#0d0f13] tracking-widest">
                SAIKO
              </h1>
              <p className="font-display text-[#c08643] text-sm md:text-base italic">
                Ramen & Sushi
              </p>
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-3">
            <h2 className="font-poppins font-bold text-3xl md:text-5xl text-[#0d0f13] leading-tight uppercase tracking-tight">
              Home Made{" "}
              <span className="bg-gradient-to-r from-[#c08643] to-[#ac312d] bg-clip-text text-transparent">
                Ramen Noodles
              </span>
            </h2>
            <p className="text-base md:text-lg text-[#705d48] max-w-md">
              Authentic Japanese cuisine crafted with quality ingredients, fresh
              flavors, and a memorable dining experience.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <a
              href="tel:09178658587"
              className="px-6 md:px-8 py-3 md:py-4 bg-[#ac312d] text-white font-poppins font-bold rounded-lg hover:bg-[#8f2825] hover:shadow-lg transition-all duration-200 text-center uppercase tracking-wide"
            >
              Call Us Now
            </a>
            <a
              href="#menu-preview"
              className="px-6 md:px-8 py-3 md:py-4 border-2 border-[#0d0f13] text-[#0d0f13] font-poppins font-bold rounded-lg hover:bg-[#0d0f13] hover:text-white transition-all duration-200 text-center uppercase tracking-wide"
            >
              Explore Menu
            </a>
          </div>

          {/* Quick Info */}
          <div className="flex gap-6 pt-4 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <span className="text-[#705d48]">Oton, Iloilo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⏰</span>
              <span className="text-[#705d48]">Open Daily</span>
            </div>
          </div>
        </div>

        {/* Right Image */}
        <div className="relative h-96 md:h-full min-h-96 md:min-h-[500px]">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#ebe9e6] to-[#f5f4f2] rounded-3xl" />

          <div className="relative h-full flex items-center justify-center">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663376430088/RVzgkYvoeVKSdip6UycaUV/ramen-hero-QD29TgxjNRG4Rwab59pvr7.webp"
              alt="Saiko Ramen Bowl"
              className="w-full h-full object-cover rounded-3xl shadow-2xl hover:shadow-3xl transition-shadow duration-300"
            />
          </div>

          {/* Floating Badge */}
          <div className="absolute bottom-6 left-6 bg-[#0d0f13] rounded-full px-4 py-3 shadow-lg">
            <p className="font-poppins font-bold text-[#c08643] text-sm md:text-base uppercase tracking-wide">
              Fresh & Quality
            </p>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-[#ebe9e6]/30 pointer-events-none" />
    </section>
  );
}
