export function Footer() {
  return (
    <footer className="bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 text-white">
      <div className="container py-12 md:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8">
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                🍜
              </div>
              <div>
                <h3 className="font-poppins font-bold text-xl">SAIKO</h3>
                <p className="font-display text-sm opacity-90">Ramen & Sushi</p>
              </div>
            </div>
            <p className="text-sm opacity-90 max-w-xs">
              Authentic Japanese cuisine crafted with quality ingredients and
              fresh flavors for a memorable dining experience.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h4 className="font-poppins font-bold text-lg">Quick Links</h4>
            <ul className="space-y-2 text-sm opacity-90">
              <li>
                <a href="#featured" className="hover:opacity-100 transition-opacity">
                  Featured Items
                </a>
              </li>
              <li>
                <a href="#ramen" className="hover:opacity-100 transition-opacity">
                  Ramen
                </a>
              </li>
              <li>
                <a href="#sushi" className="hover:opacity-100 transition-opacity">
                  Sushi
                </a>
              </li>
              <li>
                <a href="#drinks" className="hover:opacity-100 transition-opacity">
                  Drinks
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-4">
            <h4 className="font-poppins font-bold text-lg">Contact Us</h4>
            <ul className="space-y-3 text-sm opacity-90">
              <li className="flex items-center gap-2">
                <span>📞</span>
                <a href="tel:09178658587" className="hover:opacity-100 transition-opacity">
                  0917-865-8587
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span>📍</span>
                <span>Circumferential Road 1, Oton, Iloilo</span>
              </li>
              <li className="flex items-center gap-2">
                <span>🕐</span>
                <span>Mon–Thu 10AM–9PM | Fri–Sun 10AM–10PM</span>
              </li>
              <li className="flex items-center gap-2">
                <span>📘</span>
                <a
                  href="https://www.facebook.com/saikoramenandsushi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
                >
                  Saiko Ramen & Sushi
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span>📷</span>
                <a
                  href="https://www.instagram.com/saikoramenandsushi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
                >
                  @saikoramenandsushi
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/20 mb-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm opacity-90">
          <p>
            © 2026 Saiko Ramen & Sushi. All rights reserved.
          </p>
          <p className="text-xs opacity-70">
            Japanese Restaurant · Home Made Ramen Noodles · Authentic Japanese Cuisine
          </p>
        </div>
      </div>
    </footer>
  );
}
