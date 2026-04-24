export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Hero Container */}
      <div className="container grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 py-12 md:py-20 items-center">
        {/* Left Content */}
        <div className="flex flex-col gap-6 z-10">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              🍜
            </div>
            <div>
              <h1 className="font-poppins font-bold text-2xl md:text-3xl text-foreground">
                SAIKO
              </h1>
              <p className="font-display text-orange-600 text-sm md:text-base italic">
                Ramen & Sushi
              </p>
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-3">
            <h2 className="font-poppins font-bold text-3xl md:text-5xl text-foreground leading-tight">
              Clean, Warm,{" "}
              <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                Appetizing
              </span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-md">
              Experience authentic Japanese ramen and sushi crafted with quality
              ingredients, fresh flavors, and a memorable dining experience.
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button className="px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 text-white font-poppins font-bold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200">
              ORDER NOW
            </button>
            <button className="px-6 md:px-8 py-3 md:py-4 border-2 border-orange-600 text-orange-600 font-poppins font-bold rounded-lg hover:bg-orange-50 transition-all duration-200">
              EXPLORE MENU
            </button>
          </div>

          {/* Quick Info */}
          <div className="flex gap-6 pt-4 text-sm md:text-base">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📍</span>
              <span className="text-muted-foreground">Multiple Locations</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              <span className="text-muted-foreground">Open Daily</span>
            </div>
          </div>
        </div>

        {/* Right Image - Hero Food Photo */}
        <div className="relative h-96 md:h-full min-h-96 md:min-h-[500px]">
          {/* Decorative gradient circle background */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-orange-100 to-orange-50 rounded-full blur-3xl opacity-60" />

          {/* Food Image */}
          <div className="relative h-full flex items-center justify-center">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663376430088/RVzgkYvoeVKSdip6UycaUV/ramen-hero-QD29TgxjNRG4Rwab59pvr7.webp"
              alt="Saiko Ramen Bowl"
              className="w-full h-full object-cover rounded-3xl shadow-2xl hover:shadow-3xl transition-shadow duration-300"
            />
          </div>

          {/* Floating Badge */}
          <div className="absolute bottom-6 left-6 bg-white rounded-full px-4 py-3 shadow-lg border border-orange-100">
            <p className="font-poppins font-bold text-orange-600 text-sm md:text-base">
              ✨ Fresh & Quality
            </p>
          </div>
        </div>
      </div>

      {/* Decorative SVG Divider */}
      <div className="absolute bottom-0 left-0 right-0 h-16 md:h-24 bg-gradient-to-b from-transparent to-orange-50 pointer-events-none" />
    </section>
  );
}
