import { RoundTicket } from "@/components/RoundTicket";
import { signOut, useAuth } from "@/lib/auth";
import { useActiveCashier } from "@/lib/cashier";
import { type LiveStatus, type NewOrderEvent, subscribeToOrderInserts } from "@/lib/adminRealtime";
import {
  composeOrderTicketNotes,
  getRequiredTicketKinds,
  getTicketItems,
  getTicketStatus,
  parseOrderTicketNotes,
  type TicketKind,
} from "@/lib/orderTickets";
import { supabase } from "@/lib/supabase";
import logo from "@/assets/logo.png";
import { BarChart3, Bell, BookOpen, Calculator, History, LayoutDashboard, LayoutGrid, ListOrdered, LogOut, Package, Settings, Tag, Volume2, VolumeX, Wifi, WifiOff, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const SOUND_KEY = "saiko-admin-sound-enabled";
const UNSEEN_KEY = "saiko-admin-unseen-orders";

function playAlertTone() {
  const AudioContextCtor =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const now = context.currentTime;
  [0, 0.22, 0.44].forEach((offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.2);
  });

  window.setTimeout(() => {
    void context.close().catch(() => undefined);
  }, 900);
}
const STAFF_NAV_LABELS = new Set(["Tables"]);

interface OnlineOrderItem {
  id: string;
  item_id: string | null;
  item_name: string;
  quantity: number | string;
}

interface OnlineOrderForModal {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  pickup_label: string;
  notes: string | null;
  channel?: string | null;
  total_amount: number | string;
  created_at: string;
  kitchen_ticket_printed_at?: string | null;
  kitchen_ticket_print_count?: number | string | null;
  bar_ticket_printed_at?: string | null;
  bar_ticket_print_count?: number | string | null;
  order_items: OnlineOrderItem[];
}

interface OnlineTicketPayload {
  order: OnlineOrderForModal;
  kind: TicketKind;
  items: { name: string; quantity: number }[];
}

function formatTicketTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

function currencyPhp(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { session, role } = useAuth();
  const { activeCashier, setActiveCashier, cashierOptions } = useActiveCashier();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
  const [unseenOrders, setUnseenOrders] = useState<NewOrderEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [onlineOrderQueue, setOnlineOrderQueue] = useState<OnlineOrderForModal[]>([]);
  const [printingOnlineTicket, setPrintingOnlineTicket] = useState<OnlineTicketPayload | null>(null);
  const [printingTicketKey, setPrintingTicketKey] = useState<string | null>(null);
  const [onlineTicketError, setOnlineTicketError] = useState<string | null>(null);
  const onlineOrderModal = onlineOrderQueue[0] ?? null;

  const navItems = useMemo(() => {
    const all = [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, active: (path: string) => path === "/admin" },
      { href: "/admin/orders", label: "Orders", icon: ListOrdered, active: (path: string) => path.startsWith("/admin/orders") },
      { href: "/admin/counter", label: "Counter", icon: Calculator, active: (path: string) => path.startsWith("/admin/counter") },
      { href: "/admin/tables", label: "Tables", icon: LayoutGrid, active: (path: string) => path.startsWith("/admin/tables") },
      { href: "/admin/data-center", label: "Data Center", icon: BarChart3, active: (path: string) => path.startsWith("/admin/data-center") },
      { href: "/admin/backlog", label: "Backlog", icon: History, active: (path: string) => path.startsWith("/admin/backlog") },
      { href: "/admin/products", label: "Products", icon: Package, active: (path: string) => path.startsWith("/admin/products") },
      { href: "/admin/promos", label: "Promos", icon: Tag, active: (path: string) => path.startsWith("/admin/promos") },
      { href: "/admin/settings", label: "Settings", icon: Settings, active: (path: string) => path.startsWith("/admin/settings") },
      { href: "/admin/help", label: "Help", icon: BookOpen, active: (path: string) => path.startsWith("/admin/help") },
    ];
    return role === "staff" ? all.filter((item) => STAFF_NAV_LABELS.has(item.label)) : all;
  }, [role]);

  useEffect(() => {
    const savedSound = localStorage.getItem(SOUND_KEY);
    const nextSoundEnabled = savedSound === null ? true : savedSound === "1";
    setSoundEnabled(nextSoundEnabled);
    if (savedSound === null) localStorage.setItem(SOUND_KEY, "1");
    const savedUnseen = localStorage.getItem(UNSEEN_KEY);
    if (savedUnseen) {
      try {
        const savedOrders = JSON.parse(savedUnseen) as NewOrderEvent[];
        setUnseenOrders(savedOrders.filter((order) => order.channel === "web"));
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
        if (order.channel !== "web") return;
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
        void loadOnlineOrderForModal(order);
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
  async function loadOnlineOrderForModal(order: NewOrderEvent) {
    if (order.channel && order.channel !== "web") return;

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order.id)
      .maybeSingle();

    if (error || !data) return;

    const fullOrder = data as OnlineOrderForModal;
    if (fullOrder.channel !== "web") return;
    if (getRequiredTicketKinds(fullOrder.order_items).length === 0) return;

    setOnlineOrderQueue((current) => {
      if (current.some((item) => item.id === fullOrder.id)) return current;
      return [...current, fullOrder].slice(0, 8);
    });
    setOnlineTicketError(null);
  }

  function acknowledgeOnlineOrder(orderId: string) {
    setUnseenOrders((prev) => prev.filter((item) => item.id !== orderId));
    setOnlineOrderQueue((current) => current.filter((item) => item.id !== orderId));
    setOnlineTicketError(null);
  }

  function closeOnlineOrderModal() {
    setOnlineOrderQueue((current) => current.slice(1));
    setOnlineTicketError(null);
  }

  function updateQueuedOrder(orderId: string, nextOrder: Partial<OnlineOrderForModal>) {
    setOnlineOrderQueue((current) =>
      current.map((item) => (item.id === orderId ? { ...item, ...nextOrder } : item)),
    );
  }

  async function markOnlineTicketSubmitted(order: OnlineOrderForModal, kind: TicketKind) {
    const printedAt = new Date().toISOString();
    const metadata = parseOrderTicketNotes(order.notes);
    metadata.printStatus[kind] = {
      printedAt,
      count: getTicketStatus(order, kind).count + 1,
    };

    const nextNotes = composeOrderTicketNotes(order.notes, metadata.printStatus);
    const { error } = await supabase.from("orders").update({ notes: nextNotes }).eq("id", order.id);
    if (error) {
      setOnlineTicketError(error.message);
      return;
    }

    updateQueuedOrder(order.id, { notes: nextNotes });
    window.dispatchEvent(new CustomEvent("saiko:ticket-updated", { detail: { orderId: order.id, kind } }));
  }

  function printOnlineTicket(order: OnlineOrderForModal, kind: TicketKind) {
    const routedItems = getTicketItems(order.order_items, kind).map((item) => ({
      name: item.item_name,
      quantity: Number(item.quantity ?? 0),
    }));
    if (!routedItems.length) return;

    const key = `${order.id}-${kind}`;
    const previousTitle = document.title;
    document.title = kind === "kitchen" ? "KITCHEN TICKET" : "BAR TICKET";
    setPrintingTicketKey(key);
    setPrintingOnlineTicket({ order, kind, items: routedItems });

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
        setPrintingOnlineTicket(null);
        setPrintingTicketKey(null);
        void markOnlineTicketSubmitted(order, kind);
      }, 600);
    }, 300);
  }

  function onlineOrderTicketsComplete(order: OnlineOrderForModal): boolean {
    return getRequiredTicketKinds(order.order_items).every((kind) => !!getTicketStatus(order, kind).printedAt);
  }

  function renderOnlineTicketAction(order: OnlineOrderForModal, kind: TicketKind) {
    const routedItems = getTicketItems(order.order_items, kind);
    if (!routedItems.length) return null;

    const status = getTicketStatus(order, kind);
    const label = kind === "kitchen" ? "Kitchen" : "Bar";
    const key = `${order.id}-${kind}`;
    const isPrinting = printingTicketKey === key;
    const statusText = status.printedAt
      ? `Done ${formatTicketTime(status.printedAt)}${status.count > 1 ? ` (${status.count}x)` : ""}`
      : "Pending";

    return (
      <div className="rounded-lg border border-[#d8d2cb] bg-[#faf8f6] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0d0f13]">{label}</p>
            <p className={`mt-0.5 text-xs font-bold ${status.printedAt ? "text-[#2d7a3e]" : "text-[#ac312d]"}`}>
              {statusText}
            </p>
            <p className="mt-1 text-xs text-[#705d48]">{routedItems.length} line item{routedItems.length === 1 ? "" : "s"}</p>
          </div>
          <button
            type="button"
            onClick={() => printOnlineTicket(order, kind)}
            disabled={isPrinting}
            className={`min-w-[132px] rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60 ${
              kind === "kitchen" ? "bg-[#ac312d]" : "bg-[#c08643]"
            }`}
          >
            {isPrinting ? "Printing" : status.printedAt ? `Reprint ${label}` : `Submit ${label}`}
          </button>
        </div>
        <div className="mt-2 space-y-1 text-xs text-[#0d0f13]">
          {routedItems.slice(0, 4).map((item) => (
            <div key={`${kind}-${item.id}`} className="flex justify-between gap-2">
              <span>{item.item_name}</span>
              <span className="font-bold">x{Number(item.quantity ?? 0)}</span>
            </div>
          ))}
          {routedItems.length > 4 && <p className="text-[#705d48]">+{routedItems.length - 4} more</p>}
        </div>
      </div>
    );
  }

  const liveText = liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline";

  return (
    <div className={`min-h-screen bg-[#ebe9e6] text-[#0d0f13] ${printingOnlineTicket ? "admin-online-ticket-printing" : ""}`}>
      <style>{`
        .admin-online-ticket-print { display: none; }
        @media print {
          .admin-shell-header, .admin-shell-aside { display: none !important; }
          .admin-shell-main-wrap { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .admin-online-ticket-printing .admin-shell-main-wrap,
          .admin-online-ticket-printing .admin-shell-header,
          .admin-online-ticket-printing .admin-shell-aside,
          .admin-online-ticket-printing .admin-online-order-modal { display: none !important; }
          .admin-online-ticket-printing .admin-online-ticket-print { display: block !important; }
        }
      `}</style>
      <header className="admin-shell-header border-b border-[#d8d2cb] bg-white">
        <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-5 py-3 flex items-center gap-3 justify-between">
          <Link href={role === "staff" ? "/admin/tables" : "/admin"} className="inline-flex items-center gap-3">
            <img src={logo} alt="Saiko" className="h-9 w-auto" />
            <span className="text-sm font-semibold uppercase tracking-wide text-[#705d48]">
              {role === "staff" ? "Staff" : "Admin"}
            </span>
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
                          {role === "staff" ? (
                            <button
                              type="button"
                              onClick={() => {
                                void loadOnlineOrderForModal(order);
                                setShowNotifications(false);
                              }}
                              className="block w-full rounded-md px-2 py-2 text-left hover:bg-[#f6f2ed]"
                            >
                              <p className="text-sm font-semibold text-[#0d0f13]">{order.order_number}</p>
                              <p className="text-xs text-[#705d48]">{order.customer_name ?? "New order"}</p>
                            </button>
                          ) : (
                            <Link
                              href={`/admin/orders/${order.id}`}
                              onClick={() => {
                                acknowledgeOnlineOrder(order.id);
                                setShowNotifications(false);
                              }}
                              className="block rounded-md px-2 py-2 hover:bg-[#f6f2ed]"
                            >
                              <p className="text-sm font-semibold text-[#0d0f13]">{order.order_number}</p>
                              <p className="text-xs text-[#705d48]">{order.customer_name ?? "New order"}</p>
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {role !== "staff" && (
              <label className="flex items-center gap-1 text-xs font-semibold text-[#705d48]">
                <span className="hidden md:inline">Cashier</span>
                <select
                  value={activeCashier}
                  onChange={(event) => setActiveCashier(event.target.value)}
                  className="h-9 max-w-[92px] rounded-md border border-[#d8d2cb] bg-white px-2 text-xs font-semibold text-[#0d0f13] md:max-w-none"
                >
                  {cashierOptions.map((cashier) => (
                    <option key={cashier} value={cashier}>
                      {cashier}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="hidden lg:inline text-xs text-[#705d48]">{session?.user?.email ?? "admin"}</span>
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

      <div className="admin-shell-main-wrap w-full max-w-[1800px] mx-auto md:grid md:grid-cols-[208px_minmax(0,1fr)] md:gap-4 px-3 sm:px-4 lg:px-5 py-3 md:py-4">
        <aside className="admin-shell-aside mb-4 md:mb-0">
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

        <main className="min-w-0">{children}</main>
      </div>
      {onlineOrderModal && (
        <div className="admin-online-order-modal fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/65 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#ebe9e6] px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#ac312d]">New Online Order</p>
                <h2 className="text-xl font-black text-[#0d0f13]">{onlineOrderModal.order_number}</h2>
                <p className="mt-1 text-sm text-[#705d48]">
                  {onlineOrderModal.customer_name} | {onlineOrderModal.pickup_label} | {currencyPhp(Number(onlineOrderModal.total_amount))}
                </p>
              </div>
              <button
                type="button"
                onClick={closeOnlineOrderModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                title="Close popup"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-4 py-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="rounded-lg border border-[#ebe9e6] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Items</p>
                  <div className="mt-2 space-y-1.5 text-sm text-[#0d0f13]">
                    {onlineOrderModal.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3">
                        <span>{item.item_name}</span>
                        <span className="font-bold">x{Number(item.quantity ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#ebe9e6] p-3 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Ticket Memory</p>
                  <p className={`mt-2 font-bold ${onlineOrderTicketsComplete(onlineOrderModal) ? "text-[#2d7a3e]" : "text-[#ac312d]"}`}>
                    {onlineOrderTicketsComplete(onlineOrderModal) ? "All submitted" : "Needs submission"}
                  </p>
                  {onlineOrderQueue.length > 1 && (
                    <p className="mt-1 text-xs text-[#705d48]">{onlineOrderQueue.length - 1} more waiting</p>
                  )}
                  {role === "admin" ? (
                    <Link
                      href={`/admin/orders/${onlineOrderModal.id}`}
                      onClick={() => {
                        acknowledgeOnlineOrder(onlineOrderModal.id);
                      }}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-[#0d0f13] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#0d0f13]"
                    >
                      View Order
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => acknowledgeOnlineOrder(onlineOrderModal.id)}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-[#0d0f13] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#0d0f13]"
                    >
                      Mark Seen
                    </button>
                  )}
                </div>
              </div>

              {onlineTicketError && (
                <p className="mt-3 rounded-md border border-[#ac312d]/25 bg-[#ac312d]/10 px-3 py-2 text-sm font-semibold text-[#ac312d]">
                  {onlineTicketError}
                </p>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {renderOnlineTicketAction(onlineOrderModal, "kitchen")}
                {renderOnlineTicketAction(onlineOrderModal, "bar")}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[#ebe9e6] px-4 py-3">
              <button
                type="button"
                onClick={closeOnlineOrderModal}
                className="rounded-md border border-[#d8d2cb] px-4 py-2 text-sm font-semibold text-[#0d0f13]"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => acknowledgeOnlineOrder(onlineOrderModal.id)}
                disabled={!onlineOrderTicketsComplete(onlineOrderModal)}
                className="rounded-md bg-[#0d0f13] px-4 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {printingOnlineTicket && (
        <div className="admin-online-ticket-print">
          <RoundTicket
            kind={printingOnlineTicket.kind}
            orderNumber={printingOnlineTicket.order.order_number}
            orNumber=""
            items={printingOnlineTicket.items}
            notes={parseOrderTicketNotes(printingOnlineTicket.order.notes).notes || undefined}
            cashierName={activeCashier}
            customerName={printingOnlineTicket.order.customer_name}
            serviceType="PICKUP"
            createdAt={new Date(printingOnlineTicket.order.created_at)}
          />
        </div>
      )}
    </div>
  );
}
