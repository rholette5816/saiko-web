export function AboutSection() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-orange-50 to-white">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-foreground mb-4">
            Our Story
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 rounded-full mx-auto" />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: Mission & Vision */}
          <div className="space-y-8">
            {/* Mission */}
            <div>
              <h3 className="font-poppins font-bold text-xl md:text-2xl text-foreground mb-3 flex items-center gap-3">
                <span className="text-2xl">🎯</span> Our Mission
              </h3>
              <p className="text-foreground leading-relaxed">
                To serve high-quality ramen and sushi that are accessible, satisfying, and made with care, while creating a space where every customer feels welcome and valued. We believe great food doesn't have to be complicated—just fresh ingredients, consistent quality, and genuine hospitality.
              </p>
            </div>

            {/* Vision */}
            <div>
              <h3 className="font-poppins font-bold text-xl md:text-2xl text-foreground mb-3 flex items-center gap-3">
                <span className="text-2xl">✨</span> Our Vision
              </h3>
              <p className="text-foreground leading-relaxed">
                To become a trusted local favorite—a place people remember not just for the taste, but for the experience. A brand that stands for cleanliness, consistency, and honest food that brings people together.
              </p>
            </div>

            {/* Core Values */}
            <div>
              <h3 className="font-poppins font-bold text-xl md:text-2xl text-foreground mb-4 flex items-center gap-3">
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
                    className="flex items-center gap-2 p-3 bg-white rounded-lg border border-orange-100"
                  >
                    <span className="text-2xl">{value.icon}</span>
                    <span className="font-medium text-foreground">
                      {value.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Image Placeholder */}
          <div className="relative h-96 md:h-full min-h-96 md:min-h-[500px] rounded-2xl overflow-hidden shadow-xl">
            {/* Image Placeholder */}
            <div className="w-full h-full bg-gradient-to-br from-yellow-100 via-orange-100 to-orange-50 flex items-center justify-center">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663376430088/RVzgkYvoeVKSdip6UycaUV/saiko-restaurant-interior-CavGStzCPFtwPP64FFyqaF.webp"
                alt="Saiko Restaurant Interior"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Brand Statement */}
        <div className="mt-16 md:mt-20 bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <p className="font-display text-2xl md:text-3xl italic mb-3">
            "At Saiko, it's all about balance"
          </p>
          <p className="text-lg opacity-95">
            Clean design, warm flavors, and food that speaks for itself.
          </p>
        </div>
      </div>
    </section>
  );
}
