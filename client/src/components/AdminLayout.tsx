import { signOut, useAuth } from "@/lib/auth";
import { type LiveStatus, type NewOrderEvent, subscribeToOrderInserts } from "@/lib/adminRealtime";
import logo from "@/assets/logo.png";
import { Bell, BookOpen, Calculator, FileText, LayoutDashboard, ListOrdered, LogOut, Package, Settings, Tag, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const SOUND_KEY = "saiko-admin-sound-enabled";
const UNSEEN_KEY = "saiko-admin-unseen-orders";

function playAlertTone() {
  const context = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.06;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { session } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const [unseenOrders, setUnseenOrders] = useState<NewOrderEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, active: (path: string) => path === "/admin" },
      { href: "/admin/orders", label: "Orders", icon: ListOrdered, active: (path: string) => path.startsWith("/admin/orders") },
      { href: "/admin/counter", label: "Counter", icon: Calculator, active: (path: string) => path.startsWith("/admin/counter") },
      { href: "/admin/reports/daily", label: "Daily Report", icon: FileText, active: (path: string) => path.startsWith("/admin/reports/daily") },
      { href: "/admin/products", label: "Products", icon: Package, active: (path: string) => path.startsWith("/admin/products") },
      { href: "/admin/promos", label: "Promos", icon: Tag, active: (path: string) => path.startsWith("/admin/promos") },
      { href: "/admin/settings", label: "Settings", icon: Settings, active: (path: string) => path.startsWith("/admin/settings") },
      { href: "/admin/help", label: "Help", icon: BookOpen, active: (path: string) => path.startsWith("/admin/help") },
    ],
    [],
  );

  useEffect(() => {
    const savedSound = localStorage.getItem(SOUND_KEY);
    setSoundEnabled(savedSound === "1");
    const savedUnseen = localStorage.getItem(UNSEEN_KEY);
    if (savedUnseen) {
      try {
        setUnseenOrders(JSON.parse(savedUnseen) as NewOrderEvent[]);
      } catch {
        setUnseenOrders([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(UNSEEN_KEY, JSON.stringify(unseenOrders));
  }, [unseenOrders]);

  useEffect(() => {
    const unsubscribe = subscribeToOrderInserts(
      (order) => {
        setUnseenOrders((prev) => {
          if (prev.some((item) => item.id === order.id)) return prev;
          return [order, ...prev].slice(0, 20);
        });
        if (soundEnabled) {
          try {
            playAlertTone();
          } catch {
            // ignore browser audio restrictions
          }
        }
        window.dispatchEvent(new CustomEvent("saiko:new-order", { detail: order }));
      },
      (status) => setLiveStatus(status),
    );
    return () => unsubscribe();
  }, [soundEnabled]);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
    navigate("/admin/login");
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
      return next;
    });
  }

  function openNotifications() {
    setShowNotifications((prev) => !prev);
  }

  const liveText = liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline";

  return (
    <div className="min-h-screen bg-[#ebe9e6] text-[#0d0f13]">
      <header className="border-b border-[#d8d2cb] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 justify-between">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <img src={logo} alt="Saiko" className="h-9 w-auto" />
            <span className="text-sm font-semibold uppercase tracking-wide text-[#705d48]">Admin</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`hidden md:inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                liveStatus === "live" ? "bg-[#2d7a3e]/10 text-[#2d7a3e]" : "bg-[#705d48]/10 text-[#705d48]"
              }`}
            >
              {liveStatus === "live" ? <Wifi size={13} /> : <WifiOff size={13} />}
              {liveText}
            </span>
            <button
              type="button"
              onClick={toggleSound}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#d8d2cb] text-[#0d0f13]"
              title={soundEnabled ? "Disable sound alerts" : "Enable sound alerts"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={openNotifications}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                title="Order notifications"
              >
                <Bell size={16} />
                {unseenOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ac312d] text-white text-[10px] font-bold leading-[18px] text-center">
                    {unseenOrders.length > 9 ? "9+" : unseenOrders.length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#d8d2cb] rounded-lg shadow-md z-20 p-2">
                  <p className="text-xs font-semibold text-[#705d48] px-2 py-1">New Orders</p>
                  {unseenOrders.length === 0 ? (
                    <p className="text-xs text-[#705d48] px-2 py-2">No new orders.</p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto space-y-1">
                      {unseenOrders.map((order) => (
                        <li key={order.id}>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            onClick={() => {
                              setUnseenOrders((prev) => prev.filter((item) => item.id !== order.id));
                              setShowNotifications(false);
                            }}
                            className="block px-2 py-2 rounded-md hover:bg-[#f6f2ed]"
                          >
                            <p className="text-sm font-semibold text-[#0d0f13]">{order.order_number}</p>
                            <p className="text-xs text-[#705d48]">{order.customer_name ?? "New order"}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
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
              const isActive = item.active(location);
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
