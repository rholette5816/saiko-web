export function TeamSection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Meet Our Team
          </h2>
          <p className="text-lg text-[#705d48] max-w-2xl mx-auto">
            Behind every great dish is a passionate team dedicated to quality,
            freshness, and creating a welcoming experience for every guest.
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-[#c08643] to-[#ac312d] rounded-full mx-auto mt-6" />
        </div>

        {/* Team Image */}
        <div className="relative w-full h-96 md:h-[500px] rounded-2xl overflow-hidden shadow-xl mb-12">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663376430088/RVzgkYvoeVKSdip6UycaUV/saiko-team-photo-i5LRX3KoJBJWfViN5XifKP.webp"
            alt="Saiko Team"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f13]/50 to-transparent" />
        </div>

        {/* Team Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "👨‍🍳",
              title: "Expert Chefs",
              description: "Our chefs bring years of experience in authentic Japanese cuisine, ensuring every dish meets our high standards.",
            },
            {
              icon: "🤝",
              title: "Dedicated Staff",
              description: "From kitchen to table, our team is committed to providing exceptional service and creating memorable experiences.",
            },
            {
              icon: "❤️",
              title: "Passionate About Quality",
              description: "We care deeply about our craft, our ingredients, and most importantly, the satisfaction of our customers.",
            },
          ].map((value, index) => (
            <div
              key={value.title}
              className="text-center"
              style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards` }}
            >
              <div className="text-5xl mb-4">{value.icon}</div>
              <h3 className="font-poppins font-bold text-xl text-[#0d0f13] mb-3 uppercase tracking-wide">
                {value.title}
              </h3>
              <p className="text-[#705d48] leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>

        {/* Hiring Banner */}
        <div className="mt-16 md:mt-20 bg-[#0d0f13] rounded-xl p-8 md:p-12 text-center">
          <h3 className="font-poppins font-bold text-2xl text-white mb-3 uppercase tracking-wide">
            Join Our Team
          </h3>
          <p className="text-[#ebe9e6] mb-6 max-w-2xl mx-auto">
            We're always looking for passionate individuals who share our commitment to quality and customer service. If you'd like to be part of the Saiko family, we'd love to hear from you!
          </p>
          <a
            href="mailto:alphrickfoodventuresinc@gmail.com"
            className="inline-block px-8 py-3 bg-[#ac312d] text-white font-poppins font-bold rounded-lg hover:bg-[#8f2825] hover:shadow-lg transition-all duration-200 uppercase tracking-wide"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </section>
  );
}
