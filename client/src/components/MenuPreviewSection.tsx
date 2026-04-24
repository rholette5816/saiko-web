import { menuData } from "@/lib/menuData";

export function MenuPreviewSection() {
  const featuredCategories = menuData.slice(0, 4);

  return (
    <section id="menu-preview" className="py-16 md:py-24 bg-white">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Explore Our Menu
          </h2>
          <p className="text-lg text-[#705d48] max-w-2xl mx-auto mb-6">
            From rich, comforting ramen broths to fresh, artfully crafted sushi,
            every dish is made with quality ingredients and care.
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-[#c08643] to-[#ac312d] rounded-full mx-auto" />
        </div>

        {/* Featured Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {featuredCategories.map((category, index) => (
            <div
              key={category.id}
              className="group bg-white rounded-xl p-6 border border-[#e5e2de] hover:shadow-lg hover:border-[#c08643] transition-all duration-300 cursor-pointer"
              style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards` }}
            >
              {/* Category Icon & Name */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{category.emoji}</span>
                <h3 className="font-poppins font-bold text-[#0d0f13] group-hover:text-[#ac312d] transition-colors uppercase text-sm tracking-wide">
                  {category.name.split(" ")[0]}
                </h3>
              </div>

              {/* Item Count */}
              <p className="text-sm text-[#705d48] mb-4">{category.items.length} items</p>

              {/* Sample Items */}
              <div className="space-y-2 mb-4">
                {category.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-xs text-[#705d48]">
                    <span className="font-medium text-[#0d0f13]">{item.name}</span>
                    <span className="text-[#ac312d] float-right font-medium">₱{item.price}</span>
                  </div>
                ))}
              </div>

              {/* View More */}
              <button className="w-full py-2 px-3 bg-[#ebe9e6] text-[#0d0f13] font-medium rounded-lg hover:bg-[#ac312d] hover:text-white transition-colors text-sm uppercase tracking-wide">
                View All
              </button>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-[#705d48] mb-6">
            Explore our complete menu with 16 categories and 150+ dishes
          </p>
          <a
            href="#featured"
            className="inline-block px-8 py-3 bg-[#ac312d] text-white font-poppins font-bold rounded-lg hover:bg-[#8f2825] hover:shadow-lg transition-all duration-200 uppercase tracking-wide"
          >
            View Full Menu
          </a>
        </div>
      </div>
    </section>
  );
}
