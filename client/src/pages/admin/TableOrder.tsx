import { AdminLayout } from "@/components/AdminLayout";
import { RoundTicket } from "@/components/RoundTicket";
import { TableBill } from "@/components/TableBill";
import { useBusinessSettings } from "@/lib/businessSettings";
import { useAuth } from "@/lib/auth";
import { menuData } from "@/lib/menuData";
import { type BusinessSettings, supabase } from "@/lib/supabase";
import { getTable, type TableDef } from "@/lib/tables";
import { ArrowLeft, ChevronDown, ChevronRight, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type PaymentMethod = "cash" | "gcash" | "card";
type TicketKind = "kitchen" | "bar";

interface AdminTableOrderProps {
  tableId: string;
}

interface TableMenuItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  categoryId: string;
}

interface TableCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category: string;
}

interface RoundItemRow {
  id?: string;
  item_id?: string;
  item_name: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
}

interface RoundWithItems {
  id: string;
  order_number: string;
  or_number: string | null;
  created_at: string;
  subtotal: number | string | null;
  total_amount: number | string | null;
  status: string;
  notes: string | null;
  kitchen_ticket_printed_at?: string | null;
  kitchen_ticket_print_count?: number | string | null;
  bar_ticket_printed_at?: string | null;
  bar_ticket_print_count?: number | string | null;
  order_items?: RoundItemRow[] | null;
}

interface PlaceTableRoundRow {
  order_id: string;
  order_number: string;
  or_number: string | null;
  vatable_sales: number | string;
  vat_amount: number | string;
}

interface TicketPayload {
  orderId: string;
  table: TableDef;
  orderNumber: string;
  orNumber: string;
  kitchenItems: { name: string; quantity: number }[];
  barItems: { name: string; quantity: number }[];
  notes: string;
  waiterName: string;
  createdAt: Date;
}

interface CloseFormState {
  paymentMethod: PaymentMethod;
  cashReceived: string;
  senior: boolean;
  seniorId: string;
  seniorName: string;
}

interface BillRound {
  order_number: string;
  or_number: string;
  created_at: string;
  subtotal: number;
  items: Array<{ item_name: string; quantity: number; unit_price: number; line_total: number }>;
}

interface CloseTableBillResponse {
  table_number?: string;
  rounds?: BillRound[];
  round_count?: number | string;
  or_first?: string | null;
  or_last?: string | null;
  subtotal?: number | string;
  senior_discount?: number | string;
  vatable_sales?: number | string;
  vat_amount?: number | string;
  vat_exempt_sales?: number | string;
  total?: number | string;
  payment_method?: string | null;
  amount_received?: number | string;
  change?: number | string;
  senior_pwd?: boolean;
  senior_pwd_id?: string | null;
  senior_pwd_name?: string | null;
}

interface BillPayload {
  table: TableDef;
  rounds: BillRound[];
  subtotal: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  seniorDiscount: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  seniorPwd: boolean;
  seniorPwdId?: string | null;
  seniorPwdName?: string | null;
  settings: BusinessSettings;
}

const WAITER_OPTIONS = ["Anfernee", "Angeline", "Bell", "Carin", "Kikay", "Sadam", "Melinda", "Shy"];
const WAITER_NOTE_PREFIX = "[waiter:";

const DEFAULT_SETTINGS: BusinessSettings = {
  id: "default",
  business_name: "SAIKO RAMEN & SUSHI",
  business_tin: null,
  business_address: null,
  business_contact: null,
  vat_registered: false,
  vat_rate: 12,
  or_prefix: "SAIKO-OR",
  or_next_number: 1,
  receipt_footer: null,
  is_bir_accredited: false,
  updated_at: "",
};

function currencyPhp(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function splitRoundNotes(value: string | null | undefined): { waiterName: string; notes: string } {
  const raw = value ?? "";
  const lines = raw.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";

  if (first.toLowerCase().startsWith(WAITER_NOTE_PREFIX) && first.endsWith("]")) {
    return {
      waiterName: first.slice(WAITER_NOTE_PREFIX.length, -1).trim(),
      notes: lines.slice(1).join("\n").trim(),
    };
  }

  return { waiterName: "", notes: raw.trim() };
}

function composeRoundNotes(waiterName: string, notes: string): string | null {
  const cleanWaiter = waiterName.trim();
  const cleanNotes = notes.trim();
  const parts: string[] = [];

  if (cleanWaiter) parts.push(`[waiter:${cleanWaiter}]`);
  if (cleanNotes) parts.push(cleanNotes);

  return parts.length ? parts.join("\n") : null;
}

function roundSubtotal(round: RoundWithItems): number {
  return Number(round.subtotal ?? round.total_amount ?? 0);
}

function countRoundItems(round: RoundWithItems): number {
  return (round.order_items ?? []).reduce((total, item) => total + Number(item.quantity ?? 0), 0);
}

function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ticketPrintedAt(round: RoundWithItems, kind: TicketKind): string | null {
  return kind === "kitchen" ? round.kitchen_ticket_printed_at ?? null : round.bar_ticket_printed_at ?? null;
}

function ticketPrintCount(round: RoundWithItems, kind: TicketKind): number {
  const raw = kind === "kitchen" ? round.kitchen_ticket_print_count : round.bar_ticket_print_count;
  return Number(raw ?? 0);
}

function ticketKey(orderId: string, kind: TicketKind): string {
  return `${orderId}-${kind}`;
}

function parseBillPayload(data: unknown, table: TableDef, settings: BusinessSettings): BillPayload {
  const raw = (data ?? {}) as CloseTableBillResponse;
  const rounds = Array.isArray(raw.rounds)
    ? raw.rounds.map((round) => ({
        order_number: String(round.order_number ?? ""),
        or_number: String(round.or_number ?? ""),
        created_at: String(round.created_at ?? new Date().toISOString()),
        subtotal: Number(round.subtotal ?? 0),
        items: Array.isArray(round.items)
          ? round.items.map((item) => ({
              item_name: String(item.item_name ?? ""),
              quantity: Number(item.quantity ?? 0),
              unit_price: Number(item.unit_price ?? 0),
              line_total: Number(item.line_total ?? 0),
            }))
          : [],
      }))
    : [];

  return {
    table,
    rounds,
    subtotal: Number(raw.subtotal ?? 0),
    vatableSales: Number(raw.vatable_sales ?? 0),
    vatAmount: Number(raw.vat_amount ?? 0),
    vatExemptSales: Number(raw.vat_exempt_sales ?? 0),
    seniorDiscount: Number(raw.senior_discount ?? 0),
    total: Number(raw.total ?? 0),
    paymentMethod: String(raw.payment_method ?? ""),
    amountReceived: Number(raw.amount_received ?? 0),
    change: Number(raw.change ?? 0),
    seniorPwd: Boolean(raw.senior_pwd),
    seniorPwdId: raw.senior_pwd_id ?? null,
    seniorPwdName: raw.senior_pwd_name ?? null,
    settings,
  };
}

export default function AdminTableOrder({ tableId }: AdminTableOrderProps) {
  const [, navigate] = useLocation();
  const table = useMemo(() => getTable(tableId), [tableId]);
  const { session } = useAuth();
  const { settings, loading: settingsLoading } = useBusinessSettings();
  const resolvedSettings = settings ?? DEFAULT_SETTINGS;
  const cashierName = session?.user?.email?.split("@")[0] ?? "admin";

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [orderItems, setOrderItems] = useState<TableCartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [openRounds, setOpenRounds] = useState<RoundWithItems[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(true);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [submittingRound, setSubmittingRound] = useState(false);
  const [printingTicket, setPrintingTicket] = useState<TicketPayload | null>(null);
  const [activePrintKind, setActivePrintKind] = useState<TicketKind | null>(null);
  const [printingByTicket, setPrintingByTicket] = useState<Record<string, boolean>>({});
  const [closing, setClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState<CloseFormState>({
    paymentMethod: "cash",
    cashReceived: "",
    senior: false,
    seniorId: "",
    seniorName: "",
  });
  const [printingBill, setPrintingBill] = useState<BillPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      { id: "all", name: "All", emoji: "All" },
      ...menuData.map((category) => ({ id: category.id, name: category.name, emoji: category.emoji })),
    ],
    [],
  );

  const allItems = useMemo<TableMenuItem[]>(
    () =>
      menuData.flatMap((category) =>
        category.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          categoryId: category.id,
        })),
      ),
    [],
  );

  const itemCategoryById = useMemo(
    () => new Map(allItems.map((item) => [item.id, item.categoryId])),
    [allItems],
  );

  const filteredItems = useMemo(() => {
    const q = normalize(search);
    if (q) return allItems.filter((item) => normalize(item.name).includes(q));
    if (activeCategory === "all") return allItems;
    return allItems.filter((item) => item.categoryId === activeCategory);
  }, [activeCategory, allItems, search]);

  const currentSubtotal = useMemo(
    () => round2(orderItems.reduce((total, item) => total + item.price * item.quantity, 0)),
    [orderItems],
  );

  const runningSubtotal = useMemo(
    () => round2(openRounds.reduce((total, round) => total + roundSubtotal(round), 0)),
    [openRounds],
  );

  const openSince = openRounds.length
    ? openRounds.reduce((earliest, round) =>
        new Date(round.created_at).getTime() < new Date(earliest).getTime() ? round.created_at : earliest,
      openRounds[0].created_at)
    : null;

  const billPreview = useMemo(() => {
    const seniorDiscount = closeForm.senior ? round2(runningSubtotal * 0.2) : 0;
    const total = closeForm.senior ? round2(runningSubtotal - seniorDiscount) : runningSubtotal;
    const amountReceived = closeForm.paymentMethod === "cash" ? Number(closeForm.cashReceived || 0) : total;
    return {
      seniorDiscount,
      total,
      amountReceived,
      change: Math.max(0, round2(amountReceived - total)),
    };
  }, [closeForm.cashReceived, closeForm.paymentMethod, closeForm.senior, runningSubtotal]);

  async function loadRounds() {
    if (!table) return;
    setError(null);
    const { data, error: loadError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("table_number", table.id)
      .in("status", ["preparing", "ready"]);

    if (loadError) {
      setError(loadError.message);
      setOpenRounds([]);
    } else {
      const rows = ((data ?? []) as RoundWithItems[]).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      setOpenRounds(rows);
    }
    setRoundsLoading(false);
  }

  useEffect(() => {
    if (!table) return;
    setRoundsLoading(true);
    void loadRounds();
    const channel = supabase
      .channel(`table-rounds-${table.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `table_number=eq.${table.id}` }, () => {
        void loadRounds();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table?.id]);

  function getRoundTicketItems(round: RoundWithItems, kind: TicketKind) {
    return (round.order_items ?? [])
      .filter((item) => {
        const category = itemCategoryById.get(item.item_id ?? "");
        const isDrink = category === "drinks";
        return kind === "bar" ? isDrink : !isDrink;
      })
      .map((item) => ({ name: item.item_name, quantity: Number(item.quantity ?? 0) }))
      .filter((item) => item.quantity > 0);
  }

  function buildRoundTicketPayload(round: RoundWithItems): TicketPayload {
    if (!table) throw new Error("Table is required");
    const roundNotes = splitRoundNotes(round.notes);
    return {
      orderId: round.id,
      table,
      orderNumber: round.order_number,
      orNumber: round.or_number ?? "",
      kitchenItems: getRoundTicketItems(round, "kitchen"),
      barItems: getRoundTicketItems(round, "bar"),
      notes: roundNotes.notes,
      waiterName: roundNotes.waiterName,
      createdAt: new Date(round.created_at),
    };
  }

  async function markTicketPrinted(orderId: string, kind: TicketKind) {
    const round = openRounds.find((item) => item.id === orderId);
    const nextCount = round ? ticketPrintCount(round, kind) + 1 : 1;
    const printedAt = new Date().toISOString();
    const update =
      kind === "kitchen"
        ? { kitchen_ticket_printed_at: printedAt, kitchen_ticket_print_count: nextCount }
        : { bar_ticket_printed_at: printedAt, bar_ticket_print_count: nextCount };

    const { error: markError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);

    if (markError) {
      setError(markError.message);
      return;
    }

    await loadRounds();
  }

  function printTicket(payload: TicketPayload, kind: TicketKind) {
    const items = kind === "kitchen" ? payload.kitchenItems : payload.barItems;
    if (items.length === 0) return;

    const previousTitle = document.title;
    const key = ticketKey(payload.orderId, kind);
    document.title = kind === "kitchen" ? "KITCHEN TICKET" : "BAR TICKET";
    setPrintingByTicket((current) => ({ ...current, [key]: true }));
    setPrintingTicket(payload);
    setActivePrintKind(kind);
    window.setTimeout(() => {
      window.print();
      void markTicketPrinted(payload.orderId, kind).finally(() => {
        document.title = previousTitle;
        setActivePrintKind(null);
        setPrintingTicket(null);
        setPrintingByTicket((current) => ({ ...current, [key]: false }));
      });
    }, 80);
  }

  useEffect(() => {
    if (!printingBill) return;
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 200);
    const navigateTimer = window.setTimeout(() => {
      navigate("/admin/tables");
    }, 900);
    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(navigateTimer);
    };
  }, [navigate, printingBill]);

  function addToOrder(item: TableMenuItem) {
    setOrderItems((current) => {
      const existing = current.find((orderItem) => orderItem.id === item.id);
      if (existing) {
        return current.map((orderItem) =>
          orderItem.id === item.id ? { ...orderItem, quantity: orderItem.quantity + 1 } : orderItem,
        );
      }
      return [
        ...current,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          quantity: 1,
          category: item.categoryId,
        },
      ];
    });
  }

  function updateQuantity(itemId: string, nextQuantity: number) {
    if (nextQuantity <= 0) {
      setOrderItems((current) => current.filter((item) => item.id !== itemId));
      return;
    }
    setOrderItems((current) => current.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item)));
  }

  function removeItem(itemId: string) {
    setOrderItems((current) => current.filter((item) => item.id !== itemId));
  }

  function toggleRound(roundId: string) {
    setExpandedRounds((current) => {
      const next = new Set(current);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  }

  async function handleSubmitRound() {
    if (!table || !orderItems.length || submittingRound) return;
    const selectedWaiter = waiterName.trim();
    if (!selectedWaiter) {
      setError("Choose a waiter before submitting this round.");
      return;
    }
    setSubmittingRound(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("place_table_round", {
      p_table_number: table.id,
      p_subtotal: currentSubtotal,
      p_notes: composeRoundNotes(selectedWaiter, notes),
      p_items: orderItems.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        line_total: round2(item.price * item.quantity),
      })),
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmittingRound(false);
      return;
    }

    const rows = Array.isArray(data) ? (data as PlaceTableRoundRow[]) : data ? [data as PlaceTableRoundRow] : [];
    const row = rows[0];
    if (!row?.order_number) {
      setError("Table round was saved but order number was not returned.");
      setSubmittingRound(false);
      return;
    }

    setOrderItems([]);
    setNotes("");
    setSubmittingRound(false);
    await loadRounds();
  }

  function openCloseBill() {
    setCloseError(null);
    setShowCloseModal(true);
  }

  async function handleConfirmCloseBill() {
    if (!table || closing) return;
    setCloseError(null);

    if (!openRounds.length) {
      setCloseError("There are no open rounds for this table.");
      return;
    }

    if (closeForm.paymentMethod === "cash" && Number(closeForm.cashReceived || 0) < billPreview.total) {
      setCloseError("Cash received is less than the total.");
      return;
    }

    setClosing(true);
    const amountReceived = closeForm.paymentMethod === "cash" ? Number(closeForm.cashReceived || 0) : billPreview.total;
    const { data, error: rpcError } = await supabase.rpc("close_table_bill", {
      p_table_number: table.id,
      p_payment_method: closeForm.paymentMethod,
      p_amount_received: amountReceived,
      p_senior_pwd: closeForm.senior,
      p_senior_pwd_id: closeForm.senior ? closeForm.seniorId.trim() || null : null,
      p_senior_pwd_name: closeForm.senior ? closeForm.seniorName.trim() || null : null,
    });

    if (rpcError) {
      setCloseError(rpcError.message);
      setClosing(false);
      return;
    }

    setPrintingBill(parseBillPayload(data, table, resolvedSettings));
    setShowCloseModal(false);
    setClosing(false);
  }

  function renderTicketAction(round: RoundWithItems, kind: TicketKind) {
    const items = getRoundTicketItems(round, kind);
    if (items.length === 0) return null;

    const printedAt = ticketPrintedAt(round, kind);
    const printCount = ticketPrintCount(round, kind);
    const label = kind === "kitchen" ? "Kitchen" : "Bar";
    const key = ticketKey(round.id, kind);
    const isPrinting = !!printingByTicket[key];
    const statusText = printedAt
      ? `Printed ${formatTime(printedAt)}${printCount > 1 ? ` (${printCount}x)` : ""}`
      : "Pending";

    return (
      <div className="flex flex-col gap-2 rounded-md border border-[#ebe9e6] bg-[#f6f2ed] p-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">{label} Ticket</p>
          <p className={`text-xs font-semibold ${printedAt ? "text-[#2d7a3e]" : "text-[#ac312d]"}`}>
            {statusText}
          </p>
        </div>
        <button
          type="button"
          onClick={() => printTicket(buildRoundTicketPayload(round), kind)}
          disabled={isPrinting}
          className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold uppercase tracking-wide ${
            printedAt
              ? "border border-[#0d0f13] bg-white text-[#0d0f13]"
              : kind === "kitchen"
                ? "bg-[#ac312d] text-white"
                : "bg-[#c08643] text-white"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isPrinting ? "Printing..." : printedAt ? `Reprint ${label}` : `Submit ${label}`}
        </button>
      </div>
    );
  }

  if (!table) {
    return (
      <AdminLayout>
        <section className="space-y-4">
          <Link href="/admin/tables" className="inline-flex items-center gap-2 text-sm font-semibold text-[#705d48]">
            <ArrowLeft size={16} />
            Back to tables
          </Link>
          <div className="rounded-lg border border-[#d8d2cb] bg-white p-6">
            <h1 className="text-2xl font-bold text-[#0d0f13]">Table not found</h1>
            <p className="mt-2 text-sm text-[#705d48]">Choose a table from the Tables grid.</p>
          </div>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <section className="space-y-3 md:h-[calc(100vh-10.5rem)] md:overflow-hidden">
        <style>{`
          .print-tickets-root, .print-bill-root { display: none; }
          @media print {
            .table-order-screen { display: none !important; }
            .print-tickets-root, .print-bill-root { display: block !important; }
          }
        `}</style>

        <div className="table-order-screen md:h-full md:flex md:flex-col">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/admin/tables" className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-[#705d48]">
                <ArrowLeft size={16} />
                Back to tables
              </Link>
              <h1 className="text-2xl font-bold text-[#0d0f13]">
                Table {table.number} <span className="text-[#705d48]">| {table.capacity}</span>
              </h1>
              <p className="text-sm text-[#705d48]">
                {openRounds.length > 0
                  ? `Open since ${formatTime(openSince ?? new Date())} | ${currencyPhp(runningSubtotal)} running`
                  : "No open rounds yet."}
              </p>
            </div>
            <button
              type="button"
              onClick={openCloseBill}
              disabled={!openRounds.length || roundsLoading || settingsLoading}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#ac312d] px-5 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close & Bill
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-[#ac312d]/30 bg-white p-3 text-sm font-semibold text-[#ac312d]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.5fr)_minmax(380px,1fr)]">
            <div className="rounded-xl border border-[#d8d2cb] bg-white p-3 md:flex md:h-full md:min-h-0 md:flex-col md:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`h-11 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
                        activeCategory === category.id ? "bg-[#0d0f13] text-white" : "bg-[#ebe9e6] text-[#0d0f13]"
                      }`}
                    >
                      {category.emoji} {category.name}
                    </button>
                  ))}
                </div>
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#705d48]" size={16} />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search dish name..."
                    className="h-11 w-full rounded-lg border border-[#d8d2cb] bg-white pl-10 pr-3 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1 md:min-h-0 md:flex-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToOrder(item)}
                    className="min-h-[108px] rounded-lg border border-[#ebe9e6] bg-white p-2.5 text-left transition-colors hover:border-[#c08643] md:min-h-[100px]"
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="mb-1.5 h-12 w-full rounded-md object-cover" loading="lazy" />
                    ) : (
                      <div className="mb-1.5 h-12 w-full rounded-md bg-[#f6f2ed]" />
                    )}
                    <p className="line-clamp-2 text-xs font-semibold leading-tight text-[#0d0f13] md:text-sm">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-[#ac312d] md:text-sm">{currencyPhp(item.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#d8d2cb] bg-white p-3 md:h-full md:min-h-0 md:overflow-y-auto">
              <div>
                <h2 className="text-base font-bold uppercase tracking-wide text-[#0d0f13]">Open Rounds</h2>
                <p className="mt-1 text-xs text-[#705d48]">
                  {roundsLoading ? "Loading rounds..." : `${openRounds.length} open ${openRounds.length === 1 ? "round" : "rounds"}`}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {!roundsLoading && openRounds.length === 0 && (
                  <div className="rounded-lg border border-[#ebe9e6] p-3 text-sm text-[#705d48]">
                    Submitted rounds will appear here.
                  </div>
                )}
                {openRounds.map((round, index) => {
                  const expanded = expandedRounds.has(round.id);
                  return (
                    <div key={round.id} className="rounded-lg border border-[#ebe9e6]">
                      <button
                        type="button"
                        onClick={() => toggleRound(round.id)}
                        className="flex w-full items-center justify-between gap-2 p-3 text-left"
                      >
                        <span>
                          <span className="block text-sm font-bold text-[#0d0f13]">Round {index + 1}</span>
                          <span className="block text-xs text-[#705d48]">
                            {formatTime(round.created_at)} | {countRoundItems(round)} items | {currencyPhp(roundSubtotal(round))}
                          </span>
                        </span>
                        {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </button>
                      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                        {renderTicketAction(round, "kitchen")}
                        {renderTicketAction(round, "bar")}
                      </div>
                      {expanded && (
                        <div className="border-t border-[#ebe9e6] p-3 pt-2">
                          {(round.order_items ?? []).map((item, itemIndex) => (
                            <div key={`${round.id}-${item.item_name}-${itemIndex}`} className="flex justify-between gap-3 py-1 text-sm">
                              <span className="text-[#0d0f13]">
                                {Number(item.quantity)}x {item.item_name}
                              </span>
                              <span className="font-semibold text-[#705d48]">{currencyPhp(Number(item.line_total ?? 0))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-[#ebe9e6] pt-4">
                <h2 className="text-base font-bold uppercase tracking-wide text-[#0d0f13]">Current Round</h2>
                <p className="mt-1 text-xs text-[#705d48]">{orderItems.length} line items</p>

                <div className="mt-2 max-h-[28vh] space-y-2 overflow-y-auto pr-1">
                  {orderItems.length === 0 ? (
                    <p className="py-3 text-sm text-[#705d48]">Tap menu items to start this round.</p>
                  ) : (
                    orderItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-[#ebe9e6] p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0d0f13]">{item.name}</p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d8d2cb] text-[#705d48]"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-full border border-[#d8d2cb]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="inline-flex h-9 w-9 items-center justify-center text-[#0d0f13]"
                              aria-label={`Decrease ${item.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="min-w-[32px] text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="inline-flex h-9 w-9 items-center justify-center text-[#0d0f13]"
                              aria-label={`Increase ${item.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="text-sm font-bold text-[#0d0f13]">{currencyPhp(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Waiter</label>
                  <select
                    value={waiterName}
                    onChange={(event) => setWaiterName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d8d2cb] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Choose waiter</option>
                    {WAITER_OPTIONS.map((waiter) => (
                      <option key={waiter} value={waiter}>
                        {waiter}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Round Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    placeholder="Optional kitchen notes"
                    className="mt-1 w-full resize-none rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm"
                  />
                </div>

                <div className="mt-3 border-t border-[#ebe9e6] pt-3">
                  <div className="mb-3 flex items-center justify-between text-base">
                    <span className="font-semibold uppercase tracking-wide text-[#705d48]">Round Total</span>
                    <span className="font-bold text-[#ac312d]">{currencyPhp(currentSubtotal)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitRound}
                    disabled={!orderItems.length || submittingRound || !waiterName.trim()}
                    className="h-11 w-full rounded-lg bg-[#ac312d] text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingRound ? "Submitting..." : "Submit Round"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Close & Bill</h2>
                  <p className="mt-1 text-sm text-[#705d48]">
                    Table {table.number} | {openRounds.length} rounds | {currencyPhp(runningSubtotal)} subtotal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#705d48]">Payment Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["cash", "gcash", "card"] as PaymentMethod[]).map((method) => (
                      <label
                        key={method}
                        className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-sm font-semibold ${
                          closeForm.paymentMethod === method
                            ? "border-[#ac312d] bg-[#ac312d] text-white"
                            : "border-[#d8d2cb] text-[#0d0f13]"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="table-payment"
                          value={method}
                          checked={closeForm.paymentMethod === method}
                          onChange={() => setCloseForm((current) => ({ ...current, paymentMethod: method }))}
                        />
                        {method.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>

                {closeForm.paymentMethod === "cash" && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Cash Received</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={closeForm.cashReceived}
                      onChange={(event) => setCloseForm((current) => ({ ...current, cashReceived: event.target.value }))}
                      placeholder="0.00"
                      className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm font-semibold text-[#0d0f13]">
                  <input
                    type="checkbox"
                    checked={closeForm.senior}
                    onChange={(event) => setCloseForm((current) => ({ ...current, senior: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  Senior/PWD discount
                </label>

                {closeForm.senior && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">ID Number</label>
                      <input
                        type="text"
                        value={closeForm.seniorId}
                        onChange={(event) => setCloseForm((current) => ({ ...current, seniorId: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Full Name</label>
                      <input
                        type="text"
                        value={closeForm.seniorName}
                        onChange={(event) => setCloseForm((current) => ({ ...current, seniorName: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#d8d2cb] px-3 py-2 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[#d8d2cb] p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#705d48]">Subtotal</span>
                    <span className="font-semibold">{currencyPhp(runningSubtotal)}</span>
                  </div>
                  {closeForm.senior && (
                    <div className="flex justify-between gap-3">
                      <span className="text-[#705d48]">Senior/PWD (-20%)</span>
                      <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(billPreview.seniorDiscount)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between gap-3 text-base">
                    <span className="font-bold uppercase tracking-wide text-[#705d48]">Total</span>
                    <span className="font-bold text-[#ac312d]">{currencyPhp(billPreview.total)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#705d48]">Payment</span>
                    <span className="font-semibold">{currencyPhp(billPreview.amountReceived)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#705d48]">Change</span>
                    <span className="font-semibold">{currencyPhp(billPreview.change)}</span>
                  </div>
                </div>

                {closeError && <p className="text-sm font-semibold text-[#ac312d]">{closeError}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmCloseBill}
                    disabled={closing}
                    className="h-11 rounded-lg bg-[#ac312d] text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {closing ? "Closing..." : "Confirm & Print"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    disabled={closing}
                    className="h-11 rounded-lg border border-[#0d0f13] text-sm font-semibold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {printingTicket && activePrintKind === "kitchen" && printingTicket.kitchenItems.length > 0 && (
          <div className="print-tickets-root">
            <RoundTicket
              kind="kitchen"
              tableNumber={String(printingTicket.table.number)}
              capacity={printingTicket.table.capacity}
              orderNumber={printingTicket.orderNumber}
              orNumber={printingTicket.orNumber}
              items={printingTicket.kitchenItems}
              notes={printingTicket.notes || undefined}
              waiterName={printingTicket.waiterName}
              cashierName={cashierName}
              createdAt={printingTicket.createdAt}
            />
          </div>
        )}

        {printingTicket && activePrintKind === "bar" && printingTicket.barItems.length > 0 && (
          <div className="print-tickets-root">
            <RoundTicket
              kind="bar"
              tableNumber={String(printingTicket.table.number)}
              capacity={printingTicket.table.capacity}
              orderNumber={printingTicket.orderNumber}
              orNumber={printingTicket.orNumber}
              items={printingTicket.barItems}
              notes={printingTicket.notes || undefined}
              waiterName={printingTicket.waiterName}
              cashierName={cashierName}
              createdAt={printingTicket.createdAt}
            />
          </div>
        )}

        {printingBill && (
          <div className="print-bill-root">
            <TableBill
              table={printingBill.table}
              rounds={printingBill.rounds}
              subtotal={printingBill.subtotal}
              vatableSales={printingBill.vatableSales}
              vatAmount={printingBill.vatAmount}
              vatExemptSales={printingBill.vatExemptSales}
              seniorDiscount={printingBill.seniorDiscount}
              total={printingBill.total}
              paymentMethod={printingBill.paymentMethod}
              amountReceived={printingBill.amountReceived}
              change={printingBill.change}
              seniorPwd={printingBill.seniorPwd}
              seniorPwdId={printingBill.seniorPwdId}
              seniorPwdName={printingBill.seniorPwdName}
              settings={printingBill.settings}
              cashierName={cashierName}
            />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
