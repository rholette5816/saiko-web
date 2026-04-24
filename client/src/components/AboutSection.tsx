import ourStoryImg from "@/assets/images/our-story.png";

export function AboutSection() {
  return (
    <section className="py-16 md:py-24 bg-[#ebe9e6]">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Our Story
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-[#c08643] to-[#ac312d] rounded-full mx-auto" />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: Mission & Vision */}
          <div className="space-y-8">
            <div>
              <h3 className="font-poppins font-bold text-xl md:text-2xl text-[#0d0f13] mb-3 flex items-center gap-3">
                <span className="text-2xl">🎯</span> Our Mission
              </h3>
              <p className="text-[#705d48] leading-relaxed">
                To serve high-quality ramen and sushi that are accessible, satisfying, and made with care, while creating a space where every customer feels welcome and valued. We believe great food doesn't have to be complicated — just fresh ingredients, consistent quality, and genuine hospitality.
              </p>
            </div>

            <div>
              <h3 className="font-poppins font-bold text-xl md:text-2xl text-[#0d0f13] mb-3 flex items-center gap-3">
                <span className="text-2xl">✨</span> Our Vision
              </h3>
              <p className="text-[#705d48] leading-relaxed">
                To become a trusted local favorite — a place people remember not just for the taste, but for the experience. A brand that stands for cleanliness, consistency, and honest food that brings people together.
              </p>
            </div>

            <div>
              <h3 className="font-poppins font-bold text-xl md:text-2xl text-[#0d0f13] mb-4 flex items-center gap-3">
                <span className="text-2xl">❤️</span> Our Values
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "🍱", label: "Quality" },
                  { icon: "🌱", label: "Freshness" },
                  { icon: "✨", label: "Cleanliness" },
                  { icon: "🤝", label: "Care" },
                ].map((value) => (
                  <div
                    key={value.label}
                    className="flex items-center gap-2 p-3 bg-white rounded-lg border border-[#c08643]/20"
                  >
                    <span className="text-2xl">{value.icon}</span>
                    <span className="font-medium text-[#0d0f13]">{value.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Restaurant Image */}
          <div className="relative h-96 md:h-full min-h-96 md:min-h-[500px] rounded-2xl overflow-hidden shadow-xl">
            <img
              src={ourStoryImg}
              alt="Saiko Restaurant interior, warm dining ambiance in Oton Iloilo"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        {/* Brand Statement */}
        <div className="mt-16 md:mt-20 bg-[#0d0f13] rounded-2xl p-8 md:p-12 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#e88627]/10 via-transparent to-[#c08643]/10 pointer-events-none" />
          <div className="relative">
            <p className="font-display text-2xl md:text-3xl italic mb-3 text-[#f5a24b]">
              "At Saiko, it's all about balance"
            </p>
            <p className="text-lg opacity-90">
              Clean design, warm flavors, and food that speaks for itself.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
