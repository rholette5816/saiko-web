import logo from "@/assets/logo.png";
import { Link, useLocation } from "wouter";
import { Phone } from "lucide-react";

type NavLink =
  | { type: "route"; to: string; label: string; match: string }
  | { type: "hash"; href: string; label: string };

const links: NavLink[] = [
  { type: "route", to: "/", label: "Home", match: "/" },
  { type: "route", to: "/menu", label: "Menu", match: "/menu" },
  { type: "hash", href: "/#about", label: "About" },
  { type: "hash", href: "/#location", label: "Visit" },
];

export function TopNav() {
  const [location] = useLocation();

  return (
    <nav className="hidden md:flex sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#ebe9e6] shadow-sm">
      <div className="container py-3 flex items-center justify-between gap-6 w-full">
        <Link href="/" className="flex items-center gap-2" aria-label="Saiko Ramen & Sushi - Home">
          <img src={logo} alt="Saiko" className="h-12 w-auto" />
        </Link>

        <ul className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = link.type === "route" && location === link.match;
            const className = `px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide transition-colors ${
              isActive ? "bg-[#ebe9e6] text-[#ac312d]" : "text-[#0d0f13] hover:bg-[#ebe9e6]"
            }`;

            return (
              <li key={link.label}>
                {link.type === "route" ? (
                  <Link href={link.to} className={className}>
                    {link.label}
                  </Link>
                ) : (
                  <a href={link.href} className={className}>
                    {link.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        <a
          href="tel:09178658587"
          className="flex items-center gap-2 px-5 py-2 bg-[#ac312d] text-white font-bold text-sm rounded-lg hover:bg-[#8f2825] transition-colors uppercase tracking-wide"
        >
          <Phone size={16} /> Call
        </a>
      </div>
    </nav>
  );
}
