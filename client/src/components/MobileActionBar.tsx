import { Phone, MessageCircle, MapPin, UtensilsCrossed } from "lucide-react";
import { Link } from "wouter";

type Action = {
  label: string;
  icon: typeof Phone;
  highlight: boolean;
} & (
  | { type: "route"; to: string }
  | { type: "external"; href: string }
  | { type: "tel"; href: string }
);

const actions: Action[] = [
  { type: "tel", href: "tel:09178658587", label: "Call", icon: Phone, highlight: false },
  { type: "route", to: "/menu", label: "Menu", icon: UtensilsCrossed, highlight: false },
  { type: "external", href: "https://maps.app.goo.gl/8vgyd4T6anvqEJHM6", label: "Directions", icon: MapPin, highlight: false },
  { type: "external", href: "https://m.me/saikoramenandsushi", label: "Messenger", icon: MessageCircle, highlight: true },
];

export function MobileActionBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e2de] shadow-[0_-4px_16px_rgba(13,15,19,0.08)] pb-safe">
      <div className="grid grid-cols-4">
        {actions.map((action) => {
          const { label, icon: Icon, highlight } = action;
          const baseClass = `flex flex-col items-center justify-center gap-1 py-3 px-1 text-xs font-medium transition-colors ${
            highlight ? "bg-[#ac312d] text-white" : "text-[#0d0f13] hover:bg-[#ebe9e6]"
          }`;
          const content = (
            <>
              <Icon size={20} strokeWidth={highlight ? 2.5 : 2} />
              <span className="uppercase tracking-wide">{label}</span>
            </>
          );

          if (action.type === "route") {
            return (
              <Link key={label} href={action.to} className={baseClass}>
                {content}
              </Link>
            );
          }

          return (
            <a
              key={label}
              href={action.href}
              {...(action.type === "external" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={baseClass}
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
