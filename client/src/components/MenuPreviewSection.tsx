import { menuData } from "@/lib/menuData";

export function MenuPreviewSection() {
  // Select featured categories to showcase
  const featuredCategories = menuData.slice(0, 4);

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white to-orange-50">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-foreground mb-4">
            Explore Our Menu
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            From rich, comforting ramen broths to fresh, artfully crafted sushi,
            every dish is made with quality ingredients and care.
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 rounded-full mx-auto" />
        </div>

        {/* Featured Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {featuredCategories.map((category, index) => (
            <div
              key={category.id}
              className="group bg-white rounded-xl p-6 border border-orange-100 hover:shadow-lg hover:border-orange-300 transition-all duration-300 cursor-pointer"
              style={{
                animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards`,
              }}
            >
              {/* Category Icon & Name */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{category.emoji}</span>
                <h3 className="font-poppins font-bold text-foreground group-hover:text-orange-600 transition-colors">
                  {category.name.split(" ")[0]}
                </h3>
              </div>

              {/* Item Count */}
              <p className="text-sm text-muted-foreground mb-4">
                {category.items.length} items
              </p>

              {/* Sample Items */}
              <div className="space-y-2 mb-4">
                {category.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.name}
                    </span>
                    <span className="text-orange-600 float-right">
                      ₱{item.price}
                    </span>
                  </div>
                ))}
              </div>

              {/* View More */}
              <button className="w-full py-2 px-3 bg-orange-50 text-orange-600 font-medium rounded-lg hover:bg-orange-100 transition-colors text-sm group-hover:bg-gradient-to-r group-hover:from-yellow-400 group-hover:via-orange-500 group-hover:to-orange-600 group-hover:text-white">
                View All
              </button>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-6">
            Explore our complete menu with 16 categories and 150+ dishes
          </p>
          <a
            href="#featured"
            className="inline-block px-8 py-3 bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 text-white font-poppins font-bold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-200"
          >
            View Full Menu
          </a>
        </div>
      </div>
    </section>
  );
}
