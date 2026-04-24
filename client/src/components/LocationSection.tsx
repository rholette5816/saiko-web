import { useState } from "react";

export function LocationSection() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("https://formspree.io/f/alphrickfoodventuresinc@gmail.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email, message: formData.message }),
      });
      if (res.ok) {
        setStatus("sent");
        setFormData({ name: "", email: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="py-16 md:py-24 bg-[#ebe9e6]">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Visit Us Today
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-[#c08643] to-[#ac312d] rounded-full mx-auto" />
        </div>

        {/* Single Location */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="bg-white rounded-xl p-8 border border-[#c08643]/20 hover:shadow-lg transition-shadow duration-300">
            <h3 className="font-poppins font-bold text-xl text-[#0d0f13] mb-6 uppercase tracking-wide">
              Saiko Ramen & Sushi
            </h3>

            <div className="space-y-4">
              {/* Address */}
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">📍</span>
                <div>
                  <p className="text-sm text-[#705d48]">Address</p>
                  <p className="font-medium text-[#0d0f13]">
                    Circumferential Road 1, Pulo Maestra Vita, Oton, Iloilo
                  </p>
                  <p className="text-sm text-[#705d48] mt-0.5">
                    Between Shell and Petron Gasoline Station
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">📞</span>
                <div>
                  <p className="text-sm text-[#705d48]">Phone</p>
                  <a
                    href="tel:09178658587"
                    className="font-medium text-[#ac312d] hover:text-[#8f2825]"
                  >
                    0917-865-8587
                  </a>
                </div>
              </div>

              {/* Hours */}
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🕐</span>
                <div>
                  <p className="text-sm text-[#705d48]">Hours</p>
                  <p className="font-medium text-[#0d0f13]">Mon – Thu: 10AM – 9PM</p>
                  <p className="font-medium text-[#0d0f13]">Fri – Sun: 10AM – 10PM</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-[#e5e2de]">
              <a
                href="https://maps.google.com/?q=Circumferential+Road+1+Pulo+Maestra+Vita+Oton+Iloilo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-4 bg-white border border-[#0d0f13] text-[#0d0f13] font-medium rounded-lg hover:bg-[#ebe9e6] transition-colors text-sm text-center uppercase tracking-wide"
              >
                Get Directions
              </a>
              <a
                href="tel:09178658587"
                className="flex-1 py-2 px-4 bg-[#ac312d] text-white font-medium rounded-lg hover:bg-[#8f2825] hover:shadow-md transition-all text-sm text-center uppercase tracking-wide"
              >
                Call Now
              </a>
            </div>
          </div>
        </div>

        {/* Google Maps Embed */}
        <div className="relative w-full h-96 md:h-[450px] rounded-2xl overflow-hidden shadow-lg mb-12">
          <iframe
            title="Saiko Ramen & Sushi Location"
            src="https://maps.google.com/maps?q=Circumferential+Road+1+Pulo+Maestra+Vita+Oton+Iloilo&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Contact Form Section */}
        <div className="bg-[#ac312d] rounded-2xl p-8 md:p-12 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Info */}
            <div>
              <h3 className="font-poppins font-bold text-2xl mb-4">
                Get in Touch
              </h3>
              <p className="opacity-90 mb-6">
                Have questions or reservations? We'd love to hear from you.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <a
                    href="mailto:alphrickfoodventuresinc@gmail.com"
                    className="hover:opacity-80 transition-opacity"
                  >
                    alphrickfoodventuresinc@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <a
                    href="https://www.instagram.com/saikoramenandsushi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    @saikoramenandsushi
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📘</span>
                  <a
                    href="https://www.facebook.com/saikoramenandsushi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    Saiko Ramen & Sushi
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Quick Contact Form */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <h4 className="font-poppins font-semibold mb-4">Quick Message</h4>
              {status === "sent" ? (
                <p className="text-white font-medium">Message sent! We'll get back to you soon.</p>
              ) : (
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <input
                    type="text"
                    placeholder="Your Name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:outline-none focus:border-white/50"
                  />
                  <input
                    type="email"
                    placeholder="Your Email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:outline-none focus:border-white/50"
                  />
                  <textarea
                    placeholder="Your Message"
                    rows={3}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:outline-none focus:border-white/50 resize-none"
                  />
                  {status === "error" && (
                    <p className="text-white/80 text-sm">Something went wrong. Please try again.</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full py-2 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60"
                  >
                    {status === "sending" ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
