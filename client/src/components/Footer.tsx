import logo from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="bg-[#0d0f13] text-white">
      <div className="container py-12 md:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-8">
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center bg-white rounded-xl px-4 py-3 self-start shadow-lg">
              <img src={logo} alt="Saiko Ramen & Sushi" className="h-16 w-auto" />
            </div>
            <p className="text-sm text-[#ebe9e6]/70 max-w-xs">
              Authentic Japanese cuisine crafted with quality ingredients and
              fresh flavors for a memorable dining experience.
            </p>
            <p className="text-xs text-[#705d48] uppercase tracking-widest">
              Japanese Restaurant · Home Made Ramen Noodles
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h4 className="font-poppins font-bold text-lg uppercase tracking-wide text-[#c08643]">Quick Links</h4>
            <ul className="space-y-2 text-sm text-[#ebe9e6]/70">
              <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="/menu" className="hover:text-white transition-colors">Full Menu</a></li>
              <li><a href="/menu#featured" className="hover:text-white transition-colors">Featured / Promo</a></li>
              <li><a href="/menu#ramen" className="hover:text-white transition-colors">Ramen</a></li>
              <li><a href="/menu#sushi" className="hover:text-white transition-colors">Sushi</a></li>
              <li><a href="/menu#bento" className="hover:text-white transition-colors">Bento</a></li>
              <li><a href="/#location" className="hover:text-white transition-colors">Visit Us</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-4">
            <h4 className="font-poppins font-bold text-lg uppercase tracking-wide text-[#c08643]">Contact Us</h4>
            <ul className="space-y-3 text-sm text-[#ebe9e6]/70">
              <li className="flex items-center gap-2">
                <span>📞</span>
                <a href="tel:09178658587" className="hover:text-white transition-colors">
                  0917-865-8587
                </a>
              </li>
              <li className="flex items-start gap-2">
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
                  className="hover:text-white transition-colors"
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
                  className="hover:text-white transition-colors"
                >
                  @saikoramenandsushi
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span>💬</span>
                <a
                  href="https://m.me/saikoramenandsushi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Message us on Messenger
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mb-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#ebe9e6]/50">
          <p>© 2026 Saiko Ramen & Sushi. All rights reserved.</p>
          <p className="text-xs uppercase tracking-widest text-[#c08643]/60">
            Authentic Japanese Cuisine
          </p>
        </div>
      </div>
    </footer>
  );
}
