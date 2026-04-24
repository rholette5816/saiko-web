import { useState } from "react";
import { Gift } from "lucide-react";

export function NewsletterBanner() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("https://formspree.io/f/alphrickfoodventuresinc@gmail.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, source: "Saiko Newsletter / ₱50 Off Promo" }),
      });
      setStatus(res.ok ? "sent" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container">
        <div className="max-w-4xl mx-auto bg-[#0d0f13] rounded-2xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#e88627]/15 via-transparent to-[#c08643]/15 pointer-events-none" />
          <div className="relative grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 items-center">
            <div className="md:col-span-3 text-white">
              <div className="inline-flex items-center gap-2 bg-[#ac312d] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                <Gift size={14} /> ₱50 Off · First Bowl
              </div>
              <h2 className="font-poppins font-bold text-2xl md:text-3xl mb-2">
                Get ₱50 off your first ramen
              </h2>
              <p className="text-[#ebe9e6]/80 text-sm md:text-base">
                Drop your email. We'll send a coupon plus first dibs on promos and new dishes.
              </p>
            </div>

            <div className="md:col-span-2">
              {status === "sent" ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                  <p className="text-white font-semibold mb-1">You're in!</p>
                  <p className="text-[#ebe9e6]/80 text-sm">Check your inbox for your ₱50 coupon.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg bg-white text-[#0d0f13] placeholder-[#705d48] focus:outline-none focus:ring-2 focus:ring-[#c08643]"
                    aria-label="Email address"
                  />
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full py-3 bg-[#ac312d] text-white font-bold uppercase tracking-wide rounded-lg hover:bg-[#8f2825] transition-colors disabled:opacity-60"
                  >
                    {status === "sending" ? "Sending..." : "Claim ₱50 Off"}
                  </button>
                  {status === "error" && (
                    <p className="text-[#f5a24b] text-sm text-center">Something went wrong. Please try again.</p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
