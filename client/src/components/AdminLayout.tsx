import { signOut, useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";
import { LayoutDashboard, ListOrdered, LogOut } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { session } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Orders", icon: ListOrdered },
    ],
    [],
  );

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#ebe9e6] text-[#0d0f13]">
      <header className="border-b border-[#d8d2cb] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 justify-between">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <img src={logo} alt="Saiko" className="h-9 w-auto" />
            <span className="text-sm font-semibold uppercase tracking-wide text-[#705d48]">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-[#705d48]">{session?.user?.email ?? "admin"}</span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#0d0f13] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-60"
            >
              <LogOut size={14} />
              {loggingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto md:grid md:grid-cols-[220px_1fr] md:gap-6 px-4 sm:px-6 py-4 md:py-6">
        <aside className="mb-4 md:mb-0">
          <nav className="bg-[#0d0f13] rounded-lg p-2 flex md:flex-col gap-2 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${
                    isActive ? "bg-[#c08643] text-[#0d0f13]" : "text-[#f2ede7] hover:bg-[#1c212a]"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-[#f2ede7] hover:bg-[#1c212a] disabled:opacity-60 whitespace-nowrap"
            >
              <LogOut size={16} />
              Logout
            </button>
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
