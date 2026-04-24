import teamImg from "@/assets/images/team.png";

export function TeamSection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            The People Behind The Bowl
          </h2>
          <p className="text-lg text-[#705d48] max-w-2xl mx-auto">
            Chefs who've trained for this. A service team that remembers your order the second visit. That's the Saiko family.
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-[#c08643] to-[#ac312d] rounded-full mx-auto mt-6" />
        </div>

        {/* Team Image */}
        <div className="relative w-full h-96 md:h-[500px] rounded-2xl overflow-hidden shadow-xl mb-12">
          <img
            src={teamImg}
            alt="Saiko Ramen & Sushi team behind the counter"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f13]/50 to-transparent" />
        </div>

        {/* Team Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "👨‍🍳",
              title: "Chefs Who Trained For This",
              description: "Every ramen chef on our line has spent years mastering broth, noodle, and knife. No shortcuts. No frozen shipments.",
            },
            {
              icon: "🤝",
              title: "A Service Team That Remembers",
              description: "Second visit, we remember your usual. Third visit, we know your order before you sit down.",
            },
            {
              icon: "❤️",
              title: "Obsessed With The Bowl",
              description: "If the broth isn't perfect, it doesn't go out. If a roll isn't tight, it gets rerolled. That's the standard.",
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
      </div>
    </section>
  );
}
