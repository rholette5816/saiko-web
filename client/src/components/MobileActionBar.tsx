import { Phone, MessageCircle, MapPin, UtensilsCrossed } from "lucide-react";

const actions = [
  {
    href: "tel:09178658587",
    label: "Call",
    icon: Phone,
    highlight: false,
  },
  {
    href: "#full-menu",
    label: "Menu",
    icon: UtensilsCrossed,
    highlight: false,
  },
  {
    href: "https://maps.google.com/?q=Circumferential+Road+1+Pulo+Maestra+Vita+Oton+Iloilo",
    label: "Directions",
    icon: MapPin,
    highlight: false,
    external: true,
  },
  {
    href: "https://m.me/saikoramenandsushi",
    label: "Messenger",
    icon: MessageCircle,
    highlight: true,
    external: true,
  },
];

export function MobileActionBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e2de] shadow-[0_-4px_16px_rgba(13,15,19,0.08)] pb-safe">
      <div className="grid grid-cols-4">
        {actions.map(({ href, label, icon: Icon, highlight, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`flex flex-col items-center justify-center gap-1 py-3 px-1 text-xs font-medium transition-colors ${
              highlight
                ? "bg-[#ac312d] text-white"
                : "text-[#0d0f13] hover:bg-[#ebe9e6]"
            }`}
          >
            <Icon size={20} strokeWidth={highlight ? 2.5 : 2} />
            <span className="uppercase tracking-wide">{label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
