import { AdminLayout } from "@/components/AdminLayout";
import { RoundTicket } from "@/components/RoundTicket";
import { TableBill } from "@/components/TableBill";
import { useAuth } from "@/lib/auth";
import { useBusinessSettings } from "@/lib/businessSettings";
import { useActiveCashier } from "@/lib/cashier";
import {
  computeDiscountPreview,
  createDiscountHolderDraft,
  type DiscountHolderDraft,
  type DiscountPreviewLine,
  type DiscountableBillItem,
  type HolderType,
} from "@/lib/discountAllocations";
import { menuData } from "@/lib/menuData";
import { type BusinessSettings, supabase } from "@/lib/supabase";
import { TABLES, getTable, type TableDef } from "@/lib/tables";
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
  order_id: string;
  round_no?: number | string | null;
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
  round_id: string;
  vatable_sales: number | string;
  vat_amount: number | string;
}

interface OpenTableOrderRow {
  id: string;
  order_number: string;
  or_number: string | null;
  created_at: string;
  subtotal?: number | string | null;
  total_amount?: number | string | null;
  table_number?: string | null;
  linked_tables?: string[] | null;
  billed_out_at?: string | null;
}

interface OrderRoundRow {
  id: string;
  order_id: string;
  round_no: number | string | null;
  created_at: string;
  subtotal: number | string | null;
  status: string;
  notes: string | null;
  kitchen_ticket_printed_at?: string | null;
  kitchen_ticket_print_count?: number | string | null;
  bar_ticket_printed_at?: string | null;
  bar_ticket_print_count?: number | string | null;
  order_items?: RoundItemRow[] | null;
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
}

interface BillRound {
  order_number: string;
  or_number: string;
  created_at: string;
  subtotal: number;
  items: Array<{ item_name: string; quantity: number; unit_price: number; line_total: number }>;
}

type BillDiscountLine = DiscountPreviewLine;

interface CloseTableBillDiscountResponse {
  holder_ref?: string | null;
  holder_type?: HolderType | string | null;
  holder_name?: string | null;
  holder_id_number?: string | null;
  discount_rate?: number | string | null;
  order_id?: string | null;
  order_number?: string | null;
  order_item_id?: string | null;
  item_id?: string | null;
  item_name?: string | null;
  unit_price?: number | string | null;
  quantity?: number | string | null;
  gross_amount?: number | string | null;
  vat_removed_amount?: number | string | null;
  vat_exempt_sales?: number | string | null;
  discount_amount?: number | string | null;
  net_amount?: number | string | null;
}

interface CloseTableBillResponse {
  bill_group_id?: string;
  table_number?: string;
  rounds?: BillRound[];
  round_count?: number | string;
  or_first?: string | null;
  or_last?: string | null;
  subtotal?: number | string;
  discount_gross?: number | string;
  vat_removed_amount?: number | string;
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
  discounts?: CloseTableBillDiscountResponse[];
}

interface BillPayload {
  table: TableDef;
  rounds: BillRound[];
  subtotal: number;
  discountGross: number;
  vatRemovedAmount: number;
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
  discounts: BillDiscountLine[];
  settings: BusinessSettings;
  isFinal: boolean;
}
const WAITER_OPTIONS = ["Anfernee", "Angeline", "Bell", "Carin", "Kikay", "Sadam", "Melinda", "Shy"];
const WAITER_NOTE_PREFIX = "[waiter:";
const PRINT_NOTE_PREFIX = "[printed:";

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

interface TicketPrintStatus {
  printedAt: string | null;
  count: number;
}

interface RoundNoteMetadata {
  waiterName: string;
  notes: string;
  printStatus: Record<TicketKind, TicketPrintStatus>;
}

function emptyPrintStatus(): Record<TicketKind, TicketPrintStatus> {
  return {
    kitchen: { printedAt: null, count: 0 },
    bar: { printedAt: null, count: 0 },
  };
}

function parseRoundNotes(value: string | null | undefined): RoundNoteMetadata {
  const printStatus = emptyPrintStatus();
  const noteLines: string[] = [];
  let waiterName = "";

  (value ?? "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith(WAITER_NOTE_PREFIX) && trimmed.endsWith("]")) {
      waiterName = trimmed.slice(WAITER_NOTE_PREFIX.length, -1).trim();
      return;
    }

    if (lower.startsWith(PRINT_NOTE_PREFIX) && trimmed.endsWith("]")) {
      const [kind, printedAt, count] = trimmed.slice(PRINT_NOTE_PREFIX.length, -1).split("|");
      if (kind === "kitchen" || kind === "bar") {
        printStatus[kind] = {
          printedAt: printedAt || null,
          count: Number(count ?? 0),
        };
        return;
      }
    }

    noteLines.push(line);
  });

  return { waiterName, notes: noteLines.join("\n").trim(), printStatus };
}

function splitRoundNotes(value: string | null | undefined): { waiterName: string; notes: string } {
  const metadata = parseRoundNotes(value);
  return { waiterName: metadata.waiterName, notes: metadata.notes };
}

function composeRoundNotes(
  waiterName: string,
  notes: string,
  printStatus: Record<TicketKind, TicketPrintStatus> = emptyPrintStatus(),
): string | null {
  const cleanWaiter = waiterName.trim();
  const cleanNotes = notes.trim();
  const parts: string[] = [];

  if (cleanWaiter) parts.push(`[waiter:${cleanWaiter}]`);
  (["kitchen", "bar"] as TicketKind[]).forEach((kind) => {
    const status = printStatus[kind];
    if (status.printedAt) parts.push(`[printed:${kind}|${status.printedAt}|${status.count}]`);
  });
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
  const raw = kind === "kitchen" ? round.kitchen_ticket_printed_at : round.bar_ticket_printed_at;
  return raw ?? parseRoundNotes(round.notes).printStatus[kind].printedAt;
}

function ticketPrintCount(round: RoundWithItems, kind: TicketKind): number {
  const raw = kind === "kitchen" ? round.kitchen_ticket_print_count : round.bar_ticket_print_count;
  const columnCount = Number(raw ?? 0);
  return columnCount > 0 ? columnCount : parseRoundNotes(round.notes).printStatus[kind].count;
}

function ticketKey(orderId: string, kind: TicketKind): string {
  return `${orderId}-${kind}`;
}

function ticketKindLabel(kind: TicketKind): string {
  return kind === "kitchen" ? "Kitchen" : "Bar";
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

  const discounts: BillDiscountLine[] = Array.isArray(raw.discounts)
    ? raw.discounts.map((line) => ({
        holderRef: String(line.holder_ref ?? ""),
        holderType: line.holder_type === "pwd" ? "pwd" : "senior",
        holderName: String(line.holder_name ?? ""),
        holderIdNumber: String(line.holder_id_number ?? ""),
        discountRate: Number(line.discount_rate ?? 0),
        orderId: String(line.order_id ?? ""),
        orderNumber: String(line.order_number ?? ""),
        orderItemId: String(line.order_item_id ?? ""),
        itemId: String(line.item_id ?? ""),
        itemName: String(line.item_name ?? ""),
        unitPrice: Number(line.unit_price ?? 0),
        quantity: Number(line.quantity ?? 0),
        grossAmount: Number(line.gross_amount ?? 0),
        vatRemovedAmount: Number(line.vat_removed_amount ?? 0),
        vatExemptSales: Number(line.vat_exempt_sales ?? 0),
        discountAmount: Number(line.discount_amount ?? 0),
        netAmount: Number(line.net_amount ?? 0),
      }))
    : [];

  return {
    table,
    rounds,
    subtotal: Number(raw.subtotal ?? 0),
    discountGross: Number(raw.discount_gross ?? 0),
    vatRemovedAmount: Number(raw.vat_removed_amount ?? 0),
    vatableSales: Number(raw.vatable_sales ?? 0),
    vatAmount: Number(raw.vat_amount ?? 0),
    vatExemptSales: Number(raw.vat_exempt_sales ?? 0),
    seniorDiscount: Number(raw.senior_discount ?? 0),
    total: Number(raw.total ?? 0),
    paymentMethod: String(raw.payment_method ?? ""),
    amountReceived: Number(raw.amount_received ?? 0),
    change: Number(raw.change ?? 0),
    seniorPwd: Boolean(raw.senior_pwd) || discounts.length > 0,
    seniorPwdId: raw.senior_pwd_id ?? null,
    seniorPwdName: raw.senior_pwd_name ?? null,
    discounts,
    settings,
    isFinal: true,
  };
}
export default function AdminTableOrder({ tableId }: AdminTableOrderProps) {
  const [, navigate] = useLocation();
  const table = useMemo(() => getTable(tableId), [tableId]);
  const { loading: authLoading, role } = useAuth();
  const { activeCashier } = useActiveCashier();
  const { settings, loading: settingsLoading } = useBusinessSettings();
  const resolvedSettings = settings ?? DEFAULT_SETTINGS;
  const cashierName = activeCashier;
  const canManageBilling = !authLoading && role !== "staff";

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [orderItems, setOrderItems] = useState<TableCartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [waiterName, setWaiterName] = useState("");
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [openRounds, setOpenRounds] = useState<RoundWithItems[]>([]);
  const [openOrder, setOpenOrder] = useState<OpenTableOrderRow | null>(null);
  const [roundsLoading, setRoundsLoading] = useState(true);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [submittingRound, setSubmittingRound] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [printingTicket, setPrintingTicket] = useState<TicketPayload | null>(null);
  const [activePrintKind, setActivePrintKind] = useState<TicketKind | null>(null);
  const [printingTicketVoided, setPrintingTicketVoided] = useState(false);
  const [printingByTicket, setPrintingByTicket] = useState<Record<string, boolean>>({});
  const [billingOut, setBillingOut] = useState(false);
  const hasBilledOut = Boolean(openOrder?.billed_out_at);
  const [closing, setClosing] = useState(false);
  const [showBillOutModal, setShowBillOutModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState<CloseFormState>({
    paymentMethod: "cash",
    cashReceived: "",
  });
  const [discountHolders, setDiscountHolders] = useState<DiscountHolderDraft[]>([]);
  const [printingBill, setPrintingBill] = useState<BillPayload | null>(null);
  const [cancelRound, setCancelRound] = useState<RoundWithItems | null>(null);
  const [cancelReason, setCancelReason] = useState("Cancelled by staff");
  const [cancellingRoundId, setCancellingRoundId] = useState<string | null>(null);
  const [moveRound, setMoveRound] = useState<RoundWithItems | null>(null);
  const [selectedMoveTable, setSelectedMoveTable] = useState("");
  const [movingRoundId, setMovingRoundId] = useState<string | null>(null);
  const [occupiedTables, setOccupiedTables] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedMergeTable, setSelectedMergeTable] = useState("");
  const [merging, setMerging] = useState(false);
  const [unmergingTable, setUnmergingTable] = useState<string | null>(null);
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

  const itemById = useMemo(
    () => new Map(allItems.map((item) => [item.id, item])),
    [allItems],
  );

  const editingRound = useMemo(
    () => openRounds.find((round) => round.id === editingRoundId) ?? null,
    [editingRoundId, openRounds],
  );

  const moveTableOptions = useMemo(
    () => TABLES.filter((candidate) => candidate.id !== table?.id),
    [table?.id],
  );

  const linkedTables = openOrder?.linked_tables ?? [];

  const mergeTableOptions = useMemo(
    () =>
      TABLES.filter(
        (candidate) =>
          candidate.id !== table?.id &&
          candidate.id !== openOrder?.table_number &&
          !linkedTables.includes(candidate.id),
      ),
    [table?.id, openOrder?.table_number, linkedTables],
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

  const discountableBillItems = useMemo<DiscountableBillItem[]>(
    () =>
      openRounds
        .flatMap((round) =>
          (round.order_items ?? []).map((item) => ({
            orderId: round.order_id,
            orderNumber: round.order_number,
            orderItemId: item.id ? String(item.id) : "",
            itemId: String(item.item_id ?? ""),
            itemName: String(item.item_name ?? ""),
            unitPrice: Number(item.unit_price ?? 0),
            quantity: Number(item.quantity ?? 0),
          })),
        )
        .filter((item) => item.orderItemId && item.quantity > 0),
    [openRounds],
  );

  const openSince = openRounds.length
    ? openRounds.reduce((earliest, round) =>
        new Date(round.created_at).getTime() < new Date(earliest).getTime() ? round.created_at : earliest,
      openRounds[0].created_at)
    : null;

  const billPreview = useMemo(() => {
    const preview = computeDiscountPreview(
      discountableBillItems,
      discountHolders,
      runningSubtotal,
      Boolean(resolvedSettings.vat_registered),
      Number(resolvedSettings.vat_rate ?? 12),
    );
    const amountReceived = closeForm.paymentMethod === "cash" ? Number(closeForm.cashReceived || 0) : preview.total;
    return {
      ...preview,
      amountReceived,
      change: Math.max(0, round2(amountReceived - preview.total)),
    };
  }, [
    closeForm.cashReceived,
    closeForm.paymentMethod,
    discountHolders,
    discountableBillItems,
    resolvedSettings.vat_rate,
    resolvedSettings.vat_registered,
    runningSubtotal,
  ]);
  const roundManagementDisabled = hasBilledOut || showBillOutModal || showCloseModal || billingOut || closing;
  const roundManagementTitle = hasBilledOut
    ? "This table has already been billed out"
    : showBillOutModal || showCloseModal || billingOut || closing
      ? "Close and bill is in progress"
      : undefined;

  function buildOrderItemPayload() {
    return orderItems.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: round2(item.price * item.quantity),
    }));
  }

  function buildBillRounds(): BillRound[] {
    return openRounds.map((round) => ({
      order_number: openOrder?.order_number ?? round.order_number,
      or_number: openOrder?.or_number ?? round.or_number ?? "",
      created_at: round.created_at,
      subtotal: roundSubtotal(round),
      items: (round.order_items ?? []).map((item) => ({
        item_name: String(item.item_name ?? ""),
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        line_total: Number(item.line_total ?? 0),
      })),
    }));
  }

  function buildBillPayload(isFinal: boolean, paymentMethod = "", amountReceived = 0, change = 0): BillPayload {
    if (!table) throw new Error("Table is required");
    return {
      table,
      rounds: buildBillRounds(),
      subtotal: runningSubtotal,
      discountGross: billPreview.discountGross,
      vatRemovedAmount: billPreview.vatRemovedAmount,
      vatableSales: billPreview.vatableSales,
      vatAmount: billPreview.vatAmount,
      vatExemptSales: billPreview.vatExemptSales,
      seniorDiscount: billPreview.discountAmount,
      total: billPreview.total,
      paymentMethod,
      amountReceived,
      change,
      seniorPwd: billPreview.lines.length > 0,
      seniorPwdId: Array.from(new Set(billPreview.lines.map((line) => line.holderIdNumber).filter(Boolean))).join(", ") || null,
      seniorPwdName: Array.from(new Set(billPreview.lines.map((line) => line.holderName).filter(Boolean))).join(", ") || null,
      discounts: billPreview.lines,
      settings: resolvedSettings,
      isFinal,
    };
  }

  function buildDiscountAllocationPayload() {
    return billPreview.lines.map((line) => ({
      holder_ref: line.holderRef,
      holder_type: line.holderType,
      holder_name: line.holderName,
      holder_id_number: line.holderIdNumber,
      discount_rate: line.discountRate,
      order_item_id: line.orderItemId,
      quantity: line.quantity,
    }));
  }

  function addDiscountHolder() {
    setDiscountHolders((current) => [...current, createDiscountHolderDraft()]);
  }

  function updateDiscountHolder(
    holderId: string,
    patch: Partial<Pick<DiscountHolderDraft, "holderType" | "holderName" | "holderIdNumber" | "discountRate">>,
  ) {
    setDiscountHolders((current) => current.map((holder) => (holder.id === holderId ? { ...holder, ...patch } : holder)));
  }

  function removeDiscountHolder(holderId: string) {
    setDiscountHolders((current) => current.filter((holder) => holder.id !== holderId));
  }

  function updateDiscountAllocation(holderId: string, orderItemId: string, value: string) {
    setDiscountHolders((current) =>
      current.map((holder) => {
        if (holder.id !== holderId) return holder;
        const allocations = { ...holder.allocations };
        if (!value || Number(value) <= 0) {
          delete allocations[orderItemId];
        } else {
          allocations[orderItemId] = value;
        }
        return { ...holder, allocations };
      }),
    );
  }
  function renderDiscountPanel() {
    return (
      <div className="rounded-lg border border-[#d8d2cb] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#0d0f13]">Senior/PWD IDs</p>
            <p className="text-xs font-semibold text-[#705d48]">Item-level discounts</p>
          </div>
          <button
            type="button"
            onClick={addDiscountHolder}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0d0f13] px-3 text-xs font-bold uppercase tracking-wide text-white"
          >
            Add ID
          </button>
        </div>

        {discountHolders.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[#f6f2ed] px-3 py-2 text-sm font-semibold text-[#705d48]">
            No Senior/PWD IDs applied.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {discountHolders.map((holder, holderIndex) => (
              <div key={holder.id} className="rounded-lg border border-[#d8d2cb] bg-[#fbfaf8] p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-[#0d0f13]">ID Holder {holderIndex + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeDiscountHolder(holder.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#d8d2cb] text-[#ac312d]"
                    title="Remove ID holder"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_100px]">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-[#705d48]">Type</label>
                    <select
                      value={holder.holderType}
                      onChange={(event) => updateDiscountHolder(holder.id, { holderType: event.target.value as HolderType })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d8d2cb] bg-white px-2 text-sm font-semibold"
                    >
                      <option value="senior">Senior</option>
                      <option value="pwd">PWD</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-[#705d48]">Name</label>
                    <input
                      type="text"
                      value={holder.holderName}
                      onChange={(event) => updateDiscountHolder(holder.id, { holderName: event.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d8d2cb] px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-[#705d48]">ID Number</label>
                    <input
                      type="text"
                      value={holder.holderIdNumber}
                      onChange={(event) => updateDiscountHolder(holder.id, { holderIdNumber: event.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d8d2cb] px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-[#705d48]">Rate %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={holder.discountRate}
                      onChange={(event) => updateDiscountHolder(holder.id, { discountRate: event.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d8d2cb] px-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {discountableBillItems.map((item) => (
                    <div
                      key={`${holder.id}-${item.orderItemId}`}
                      className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-2 rounded-md bg-white px-2 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0d0f13]">{item.itemName}</p>
                        <p className="text-xs text-[#705d48]">
                          {currencyPhp(item.unitPrice)} | max {item.quantity}
                        </p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        step="1"
                        value={holder.allocations[item.orderItemId] ?? ""}
                        onChange={(event) => updateDiscountAllocation(holder.id, item.orderItemId, event.target.value)}
                        className="h-9 w-full rounded-lg border border-[#d8d2cb] px-2 text-right text-sm font-semibold"
                        aria-label={`Discount quantity for ${item.itemName}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {billPreview.errors.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg border border-[#ac312d]/30 bg-[#ac312d]/5 p-2">
            {billPreview.errors.map((previewError) => (
              <p key={previewError} className="text-xs font-semibold text-[#ac312d]">
                {previewError}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderBillSummary(includePayment: boolean) {
    return (
      <div className="rounded-lg border border-[#d8d2cb] p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-[#705d48]">Subtotal</span>
          <span className="font-semibold">{currencyPhp(runningSubtotal)}</span>
        </div>
        {billPreview.discountGross > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-[#705d48]">Discounted Item Gross</span>
            <span className="font-semibold">{currencyPhp(billPreview.discountGross)}</span>
          </div>
        )}
        {billPreview.vatRemovedAmount > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-[#705d48]">VAT Removed</span>
            <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(billPreview.vatRemovedAmount)}</span>
          </div>
        )}
        {billPreview.discountAmount > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-[#705d48]">Senior/PWD Discount</span>
            <span className="font-semibold text-[#2d7a3e]">-{currencyPhp(billPreview.discountAmount)}</span>
          </div>
        )}
        {billPreview.vatExemptSales > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-[#705d48]">VAT-Exempt Sales</span>
            <span className="font-semibold">{currencyPhp(billPreview.vatExemptSales)}</span>
          </div>
        )}
        {resolvedSettings.vat_registered && (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-[#705d48]">VAT-able Sales</span>
              <span className="font-semibold">{currencyPhp(billPreview.vatableSales)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#705d48]">VAT</span>
              <span className="font-semibold">{currencyPhp(billPreview.vatAmount)}</span>
            </div>
          </>
        )}
        <div className="mt-2 flex justify-between gap-3 text-base">
          <span className="font-bold uppercase tracking-wide text-[#705d48]">Total</span>
          <span className="font-bold text-[#ac312d]">{currencyPhp(billPreview.total)}</span>
        </div>
        {includePayment && (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-[#705d48]">Payment</span>
              <span className="font-semibold">{currencyPhp(billPreview.amountReceived)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#705d48]">Change</span>
              <span className="font-semibold">{currencyPhp(billPreview.change)}</span>
            </div>
          </>
        )}
      </div>
    );
  }
  function cartItemsFromRound(round: RoundWithItems): TableCartItem[] {
    return (round.order_items ?? [])
      .map((item, index) => {
        const itemId = item.item_id ?? item.id ?? `${round.id}-${index}`;
        const menuItem = itemById.get(itemId);
        return {
          id: itemId,
          name: item.item_name,
          price: Number(item.unit_price ?? 0),
          quantity: Number(item.quantity ?? 0),
          image: menuItem?.image,
          category: menuItem?.categoryId ?? itemCategoryById.get(itemId) ?? "all",
        };
      })
      .filter((item) => item.quantity > 0);
  }

  function printedTicketKinds(round: RoundWithItems): TicketKind[] {
    return (["kitchen", "bar"] as TicketKind[]).filter((kind) => {
      return ticketPrintedAt(round, kind) !== null && getRoundTicketItems(round, kind).length > 0;
    });
  }

  async function loadRounds() {
    if (!table) return;
    setError(null);
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, or_number, created_at, subtotal, total_amount, table_number, linked_tables, billed_out_at")
      .or(`table_number.eq.${table.id},linked_tables.cs.{${table.id}}`)
      .in("status", ["preparing", "ready"])
      .order("created_at", { ascending: true })
      .limit(1);

    if (orderError) {
      setError(orderError.message);
      setOpenOrder(null);
      setOpenRounds([]);
      setRoundsLoading(false);
      return;
    }

    const orderRow = ((orderData ?? []) as OpenTableOrderRow[])[0] ?? null;
    setOpenOrder(orderRow);
    if (!orderRow) {
      setOpenRounds([]);
      setRoundsLoading(false);
      return;
    }

    const { data: roundData, error: roundError } = await supabase
      .from("order_rounds")
      .select("*, order_items(*)")
      .eq("order_id", orderRow.id)
      .eq("status", "active")
      .order("round_no", { ascending: true });

    if (roundError) {
      setError(roundError.message);
      setOpenRounds([]);
      setRoundsLoading(false);
      return;
    }

    const rows = ((roundData ?? []) as OrderRoundRow[])
      .map((round) => ({
        id: round.id,
        order_id: orderRow.id,
        round_no: round.round_no,
        order_number: orderRow.order_number,
        or_number: orderRow.or_number,
        created_at: round.created_at,
        subtotal: round.subtotal,
        total_amount: round.subtotal,
        status: round.status,
        notes: round.notes,
        kitchen_ticket_printed_at: round.kitchen_ticket_printed_at,
        kitchen_ticket_print_count: round.kitchen_ticket_print_count,
        bar_ticket_printed_at: round.bar_ticket_printed_at,
        bar_ticket_print_count: round.bar_ticket_print_count,
        order_items: round.order_items ?? [],
      }))
      .sort((a, b) => {
        const byRound = Number(a.round_no ?? 0) - Number(b.round_no ?? 0);
        return byRound || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    setOpenRounds(rows);
    setRoundsLoading(false);
  }

  useEffect(() => {
    if (!table) return;
    setRoundsLoading(true);
    void loadRounds();
    const channel = supabase
      .channel(`table-rounds-${table.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void loadRounds();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_rounds" }, () => {
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
    const { error: markError } = await supabase.rpc("mark_table_ticket_printed", {
      p_order_id: orderId,
      p_kind: kind,
    });

    if (markError) {
      setError(markError.message);
      return;
    }

    await loadRounds();
  }

  function printTicket(payload: TicketPayload, kind: TicketKind, options: { voided?: boolean } = {}) {
    const items = kind === "kitchen" ? payload.kitchenItems : payload.barItems;
    if (items.length === 0) return Promise.resolve();

    const previousTitle = document.title;
    const key = ticketKey(payload.orderId, kind);
    const title = kind === "kitchen" ? "KITCHEN TICKET" : "BAR TICKET";
    document.title = options.voided ? `VOID ${title}` : title;
    setPrintingByTicket((current) => ({ ...current, [key]: true }));
    setPrintingTicket(payload);
    setActivePrintKind(kind);
    setPrintingTicketVoided(!!options.voided);

    return new Promise<void>((resolve) => {
      // Give React time to commit the print container before opening the dialog.
      window.setTimeout(() => {
        window.print();
        // Defer cleanup + DB write so the print preview keeps the ticket DOM intact
        // even on browsers where window.print() returns immediately.
        window.setTimeout(() => {
          document.title = previousTitle;
          setActivePrintKind(null);
          setPrintingTicket(null);
          setPrintingTicketVoided(false);
          setPrintingByTicket((current) => ({ ...current, [key]: false }));
          if (options.voided) {
            resolve();
            return;
          }
          void markTicketPrinted(payload.orderId, kind).finally(resolve);
        }, 600);
      }, 300);
    });
  }

  useEffect(() => {
    if (!printingBill) return;
    const isBillOut = printingBill.isFinal === false;
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 300);
    // Bill Out (not final): dismiss after print, stay on the table so staff can keep working.
    // Settle & Close (final): navigate back to the tables grid.
    const followUpTimer = window.setTimeout(() => {
      if (isBillOut) {
        setPrintingBill(null);
      } else {
        navigate("/admin/tables");
      }
    }, 1200);
    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(followUpTimer);
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
      p_items: buildOrderItemPayload(),
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmittingRound(false);
      return;
    }

    const rows = Array.isArray(data) ? (data as PlaceTableRoundRow[]) : data ? [data as PlaceTableRoundRow] : [];
    const row = rows[0];
    if (!row?.order_number || !row?.round_id) {
      setError("Table round was saved but round details were not returned.");
      setSubmittingRound(false);
      return;
    }

    setOrderItems([]);
    setNotes("");
    setExpandedRounds((current) => new Set(current).add(row.round_id));
    setSubmittingRound(false);
    setDiscountHolders([]);
    await loadRounds();
  }

  function beginEditRound(round: RoundWithItems) {
    if (!canManageBilling) {
      setError("Only the cashier can edit this round.");
      return;
    }
    if (roundManagementDisabled) {
      setError(roundManagementTitle ?? "This round cannot be edited now.");
      return;
    }

    setEditingRoundId(round.id);
    setOrderItems(cartItemsFromRound(round));
    setError(null);
  }

  async function handleEditRound(round: RoundWithItems) {
    if (!orderItems.length || submittingRound) return;
    if (!canManageBilling) {
      setError("Only the cashier can edit this round.");
      return;
    }
    if (roundManagementDisabled) {
      setError(roundManagementTitle ?? "This round cannot be edited now.");
      return;
    }

    setSubmittingRound(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("update_table_round_items", {
      p_round_id: round.id,
      p_items: buildOrderItemPayload(),
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmittingRound(false);
      return;
    }

    setEditingRoundId(null);
    setOrderItems([]);
    setNotes("");
    setSubmittingRound(false);
    setDiscountHolders([]);
    await loadRounds();
  }

  function beginCancelRound(round: RoundWithItems) {
    if (!canManageBilling) {
      setError("Only the cashier can cancel this round.");
      return;
    }
    if (roundManagementDisabled) {
      setError(roundManagementTitle ?? "This round cannot be cancelled now.");
      return;
    }

    setCancelRound(round);
    setCancelReason("Cancelled by staff");
    setError(null);
  }

  async function handleConfirmCancelRound() {
    if (!cancelRound || cancellingRoundId) return;
    if (!canManageBilling) {
      setError("Only the cashier can cancel this round.");
      return;
    }
    if (roundManagementDisabled) {
      setError(roundManagementTitle ?? "This round cannot be cancelled now.");
      return;
    }

    const voidKinds = printedTicketKinds(cancelRound);
    const voidPayload = voidKinds.length ? buildRoundTicketPayload(cancelRound) : null;
    setCancellingRoundId(cancelRound.id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("cancel_table_round", {
      p_round_id: cancelRound.id,
      p_reason: cancelReason.trim() || "Cancelled by staff",
    });

    if (rpcError) {
      setError(rpcError.message);
      setCancellingRoundId(null);
      return;
    }

    if (editingRoundId === cancelRound.id) {
      setEditingRoundId(null);
      setOrderItems([]);
    }
    setCancelRound(null);
    setCancellingRoundId(null);
    await loadRounds();

    if (voidPayload) {
      for (const kind of voidKinds) {
        await printTicket(voidPayload, kind, { voided: true });
      }
    }
  }

  async function loadOccupiedTables() {
    const { data, error: occupiedError } = await supabase
      .from("orders")
      .select("table_number, linked_tables")
      .in("status", ["preparing", "ready"])
      .not("table_number", "is", null);

    if (occupiedError) return;
    const next = new Set<string>();
    for (const row of data ?? []) {
      if (row.table_number) next.add(String(row.table_number));
      for (const linked of (row.linked_tables ?? []) as string[]) {
        if (linked) next.add(String(linked));
      }
    }
    setOccupiedTables(next);
  }

  function beginMergeTable() {
    if (!canManageBilling) {
      setError("Only the cashier can merge tables.");
      return;
    }
    if (roundManagementDisabled || !openOrder) {
      setError(roundManagementTitle ?? "This table order cannot be merged now.");
      return;
    }

    setSelectedMergeTable("");
    setShowMergeModal(true);
    setError(null);
    void loadOccupiedTables();
  }

  async function handleConfirmMergeTable() {
    if (!openOrder || !selectedMergeTable || merging) return;
    if (!canManageBilling) {
      setError("Only the cashier can merge tables.");
      return;
    }

    setMerging(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("merge_table_into_order", {
      p_order_id: openOrder.id,
      p_table_number: selectedMergeTable,
    });

    if (rpcError) {
      setError(rpcError.message);
      setMerging(false);
      return;
    }

    setShowMergeModal(false);
    setSelectedMergeTable("");
    setMerging(false);
    await loadRounds();
  }

  async function handleUnmergeTable(tableId: string) {
    if (!openOrder || unmergingTable) return;
    if (!canManageBilling) {
      setError("Only the cashier can unmerge tables.");
      return;
    }

    setUnmergingTable(tableId);
    setError(null);

    const { error: rpcError } = await supabase.rpc("unmerge_table_from_order", {
      p_order_id: openOrder.id,
      p_table_number: tableId,
    });

    if (rpcError) {
      setError(rpcError.message);
      setUnmergingTable(null);
      return;
    }

    setUnmergingTable(null);
    await loadRounds();
  }

  function beginMoveRound(round: RoundWithItems) {
    if (!canManageBilling) {
      setError("Only the cashier can move this table order.");
      return;
    }
    if (roundManagementDisabled) {
      setError(roundManagementTitle ?? "This table order cannot be moved now.");
      return;
    }

    setMoveRound(round);
    setSelectedMoveTable("");
    setError(null);
    void loadOccupiedTables();
  }

  async function handleConfirmMoveRound() {
    if (!moveRound || !selectedMoveTable || movingRoundId) return;
    if (!canManageBilling) {
      setError("Only the cashier can move this table order.");
      return;
    }
    if (roundManagementDisabled) {
      setError(roundManagementTitle ?? "This table order cannot be moved now.");
      return;
    }

    setMovingRoundId(moveRound.id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("transfer_table_round", {
      p_round_id: moveRound.id,
      p_new_table_number: selectedMoveTable,
    });

    if (rpcError) {
      setError(rpcError.message);
      setMovingRoundId(null);
      return;
    }

    const destination = selectedMoveTable;
    if (editingRoundId === moveRound.id) {
      setEditingRoundId(null);
      setOrderItems([]);
    }
    setMoveRound(null);
    setMovingRoundId(null);
    await loadRounds();
    navigate(`/admin/tables/${destination}`);
  }

  function openCloseBill() {
    if (!canManageBilling) {
      setError("Only the cashier can settle this table.");
      return;
    }
    if (!allRequiredTicketsPrinted) {
      setError("Print all kitchen and bar tickets before settling this table.");
      return;
    }
    if (!hasBilledOut) {
      setError("Bill out this table before settling it.");
      return;
    }
    setCloseError(null);
    setShowCloseModal(true);
  }

  const allRequiredTicketsPrinted = useMemo(() => {
    if (!openRounds.length) return false;
    return openRounds.every((round) => {
      const hasKitchen = getRoundTicketItems(round, "kitchen").length > 0;
      const hasBar = getRoundTicketItems(round, "bar").length > 0;
      const kitchenOk = !hasKitchen || ticketPrintedAt(round, "kitchen") !== null;
      const barOk = !hasBar || ticketPrintedAt(round, "bar") !== null;
      return kitchenOk && barOk;
    });
  }, [openRounds]);

  function openBillOutModal() {
    if (!table || !openRounds.length || billingOut) return;
    setError(null);
    setCloseError(null);
    if (!canManageBilling) {
      setError("Only the cashier can bill out this table.");
      return;
    }
    if (!allRequiredTicketsPrinted) {
      setError("Print all kitchen and bar tickets before bill out.");
      return;
    }
    if (hasBilledOut) {
      setError("This table has already been billed out. Settle it to close.");
      return;
    }
    setShowBillOutModal(true);
  }

  async function handleBillOut() {
    if (!table || !openRounds.length || billingOut) return;
    setError(null);
    setCloseError(null);
    if (!canManageBilling) {
      setError("Only the cashier can bill out this table.");
      return;
    }
    if (!allRequiredTicketsPrinted) {
      setError("Print all kitchen and bar tickets before bill out.");
      return;
    }
    if (hasBilledOut) {
      setError("This table has already been billed out. Settle it to close.");
      return;
    }
    if (billPreview.errors.length > 0) {
      setCloseError(billPreview.errors[0]);
      return;
    }
    setBillingOut(true);
    const { error: rpcError } = await supabase.rpc("mark_table_billed_out", {
      p_table_number: table.id,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBillingOut(false);
      return;
    }
    setPrintingBill(buildBillPayload(false));
    setShowBillOutModal(false);
    setBillingOut(false);
    await loadRounds();
  }
  async function handleConfirmCloseBill() {
    if (!table || closing) return;
    setCloseError(null);

    if (!canManageBilling) {
      setCloseError("Only the cashier can settle this table.");
      return;
    }

    if (!hasBilledOut) {
      setCloseError("Bill out this table before settling it.");
      return;
    }

    if (!openRounds.length) {
      setCloseError("There are no open rounds for this table.");
      return;
    }

    if (!allRequiredTicketsPrinted) {
      setCloseError("Print all kitchen and bar tickets before settling this table.");
      return;
    }

    if (billPreview.errors.length > 0) {
      setCloseError(billPreview.errors[0]);
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
      p_discount_allocations: buildDiscountAllocationPayload(),
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
          onClick={() => void printTicket(buildRoundTicketPayload(round), kind)}
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

  function renderRoundManagementActions(round: RoundWithItems) {
    if (!canManageBilling) return null;

    const busy = submittingRound || cancellingRoundId !== null;
    const disabled = roundManagementDisabled || busy;
    const editLabel = editingRoundId === round.id ? "Editing" : "Edit";
    const cancelLabel = cancellingRoundId === round.id ? "Cancelling..." : "Cancel";

    return (
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => beginEditRound(round)}
          disabled={disabled}
          title={roundManagementTitle}
          className="inline-flex h-9 items-center justify-center rounded-md border border-[#0d0f13] bg-white px-3 text-xs font-bold uppercase tracking-wide text-[#0d0f13] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editLabel}
        </button>
        <button
          type="button"
          onClick={() => beginCancelRound(round)}
          disabled={disabled}
          title={roundManagementTitle}
          className="inline-flex h-9 items-center justify-center rounded-md border border-[#ac312d] bg-white px-3 text-xs font-bold uppercase tracking-wide text-[#ac312d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    );
  }

  const cancelVoidKinds = cancelRound ? printedTicketKinds(cancelRound) : [];
  const cancelVoidLabel = cancelVoidKinds.map(ticketKindLabel).join(" and ");
  const selectedMoveTableDef = TABLES.find((candidate) => candidate.id === selectedMoveTable);

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
      <section className="space-y-2 md:h-[calc(100vh-8.75rem)] md:overflow-hidden">
        <style>{`
          .print-tickets-root, .print-bill-root { display: none; }
          @media print {
            html, body, #root { margin: 0 !important; padding: 0 !important; width: 3in !important; min-height: 0 !important; background: white !important; }
            .table-order-screen { display: none !important; }
            .print-tickets-root, .print-bill-root {
              display: block !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 3in !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `}</style>

        <div className="table-order-screen md:h-full md:flex md:flex-col">
          <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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
              {linkedTables.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[#705d48]">
                  <span className="font-semibold">Merged with:</span>
                  {linkedTables.map((linkedId) => {
                    const linkedDef = TABLES.find((candidate) => candidate.id === linkedId);
                    return (
                      <span
                        key={linkedId}
                        className="inline-flex items-center gap-1 rounded-full bg-[#c08643]/10 px-2 py-0.5 text-xs font-bold text-[#c08643]"
                      >
                        Table {linkedDef?.number ?? linkedId}
                        {canManageBilling && !hasBilledOut && (
                          <button
                            type="button"
                            onClick={() => void handleUnmergeTable(linkedId)}
                            disabled={unmergingTable === linkedId}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#c08643]/20 disabled:opacity-50"
                            title={`Unmerge Table ${linkedDef?.number ?? linkedId}`}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {canManageBilling && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={beginMergeTable}
                  disabled={!openRounds.length || roundsLoading || settingsLoading || hasBilledOut}
                  title={hasBilledOut ? "This table has already been billed out" : undefined}
                  className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-[#c08643] bg-white px-5 text-sm font-bold uppercase tracking-wide text-[#c08643] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Merge Table
                </button>
                <button
                  type="button"
                  onClick={() => openRounds[0] && beginMoveRound(openRounds[0])}
                  disabled={!openRounds.length || roundsLoading || settingsLoading || hasBilledOut || movingRoundId !== null}
                  title={hasBilledOut ? "This table has already been billed out" : undefined}
                  className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-[#c08643] bg-white px-5 text-sm font-bold uppercase tracking-wide text-[#c08643] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Move Table
                </button>
                <button
                  type="button"
                  onClick={openBillOutModal}
                  disabled={!openRounds.length || roundsLoading || settingsLoading || billingOut || !allRequiredTicketsPrinted || hasBilledOut}
                  title={
                    hasBilledOut
                      ? "This table has already been billed out"
                      : !allRequiredTicketsPrinted && openRounds.length
                        ? "Print all kitchen and bar tickets first"
                        : undefined
                  }
                  className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-[#c08643] bg-white px-5 text-sm font-bold uppercase tracking-wide text-[#c08643] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {billingOut ? "Printing..." : "Bill Out"}
                </button>
                <button
                  type="button"
                  onClick={openCloseBill}
                  disabled={!openRounds.length || roundsLoading || settingsLoading || !allRequiredTicketsPrinted || !hasBilledOut}
                  title={
                    !allRequiredTicketsPrinted && openRounds.length
                      ? "Print all kitchen and bar tickets first"
                      : !hasBilledOut && openRounds.length
                        ? "Bill out this table first"
                        : undefined
                  }
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#ac312d] px-5 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Settle & Close
                </button>
              </div>
            )}
          </div>

          {canManageBilling && openRounds.length > 0 && !allRequiredTicketsPrinted && (
            <div className="mb-2 rounded-lg border border-[#ac312d]/30 bg-[#ac312d]/5 p-2 text-xs font-semibold text-[#ac312d]">
              Print all kitchen and bar tickets before this table can be billed out or settled.
            </div>
          )}

          {canManageBilling && openRounds.length > 0 && allRequiredTicketsPrinted && !hasBilledOut && (
            <div className="mb-2 rounded-lg border border-[#ac312d]/30 bg-[#ac312d]/5 p-2 text-xs font-semibold text-[#ac312d]">
              Bill out this table before settling it.
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-lg border border-[#ac312d]/30 bg-white p-3 text-sm font-semibold text-[#ac312d]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1.8fr)_minmax(400px,0.9fr)] lg:grid-cols-[minmax(0,2.1fr)_minmax(430px,0.9fr)] xl:gap-4">
            <div className="rounded-xl border border-[#d8d2cb] bg-white p-3 md:flex md:h-full md:min-h-0 md:flex-col">
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

              <div className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:min-h-0 md:flex-1 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToOrder(item)}
                    className="min-h-[104px] rounded-lg border border-[#ebe9e6] bg-white p-2.5 text-left transition-colors hover:border-[#c08643] md:min-h-[96px]"
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
                      {renderRoundManagementActions(round)}
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
                <h2 className="text-base font-bold uppercase tracking-wide text-[#0d0f13]">
                  {editingRound ? "Edit Round" : "Current Round"}
                </h2>
                <p className="mt-1 text-xs text-[#705d48]">
                  {editingRound ? `${editingRound.order_number} | ${orderItems.length} line items` : `${orderItems.length} line items`}
                </p>

                <div className="mt-2 max-h-[30vh] space-y-2 overflow-y-auto pr-1 xl:max-h-[34vh]">
                  {orderItems.length === 0 ? (
                    <p className="py-3 text-sm text-[#705d48]">
                      {editingRound ? "Tap menu items to update this round." : "Tap menu items to start this round."}
                    </p>
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

                {!editingRound && (
                  <>
                    <div className="mt-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Waiter</label>
                      <button
                        type="button"
                        onClick={() => setShowWaiterModal(true)}
                        className={`mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                          waiterName
                            ? "border-[#2d7a3e] bg-[#2d7a3e]/10 text-[#0d0f13]"
                            : "border-[#d8d2cb] bg-white text-[#705d48]"
                        }`}
                      >
                        <span>{waiterName || "Choose waiter"}</span>
                        <ChevronRight size={16} />
                      </button>
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
                  </>
                )}

                <div className="mt-3 border-t border-[#ebe9e6] pt-3">
                  <div className="mb-3 flex items-center justify-between text-base">
                    <span className="font-semibold uppercase tracking-wide text-[#705d48]">Round Total</span>
                    <span className="font-bold text-[#ac312d]">{currencyPhp(currentSubtotal)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingRound) {
                        void handleEditRound(editingRound);
                        return;
                      }
                      void handleSubmitRound();
                    }}
                    disabled={!orderItems.length || submittingRound || (!editingRound && !waiterName.trim())}
                    className="h-11 w-full rounded-lg bg-[#ac312d] text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingRound ? (editingRound ? "Saving..." : "Submitting...") : editingRound ? "Save Changes" : "Submit Round"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showWaiterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Choose Waiter</h2>
                  <p className="mt-1 text-sm text-[#705d48]">Select the waiter before submitting this round.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWaiterModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WAITER_OPTIONS.map((waiter) => (
                  <button
                    key={waiter}
                    type="button"
                    onClick={() => {
                      setWaiterName(waiter);
                      setError(null);
                      setShowWaiterModal(false);
                    }}
                    className={`min-h-[72px] rounded-lg border px-3 py-3 text-center text-sm font-bold ${
                      waiterName === waiter
                        ? "border-[#ac312d] bg-[#ac312d] text-white"
                        : "border-[#d8d2cb] bg-[#f6f2ed] text-[#0d0f13]"
                    }`}
                  >
                    {waiter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {showBillOutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Bill Out</h2>
                  <p className="mt-1 text-sm text-[#705d48]">
                    Table {table.number} | {openRounds.length} rounds | {currencyPhp(runningSubtotal)} subtotal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBillOutModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13]"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {renderDiscountPanel()}
                {renderBillSummary(false)}

                {closeError && <p className="text-sm font-semibold text-[#ac312d]">{closeError}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleBillOut}
                    disabled={billingOut || billPreview.errors.length > 0}
                    className="h-11 rounded-lg bg-[#ac312d] text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {billingOut ? "Printing..." : "Print Billout"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBillOutModal(false)}
                    disabled={billingOut}
                    className="h-11 rounded-lg border border-[#0d0f13] text-sm font-semibold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Settle & Close</h2>
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

                {renderDiscountPanel()}
                {renderBillSummary(true)}

                {closeError && <p className="text-sm font-semibold text-[#ac312d]">{closeError}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmCloseBill}
                    disabled={closing || billPreview.errors.length > 0}
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
        {cancelRound && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Cancel Round</h2>
                  <p className="mt-1 text-sm text-[#705d48]">
                    {cancelRound.order_number} | {countRoundItems(cancelRound)} items | {currencyPhp(roundSubtotal(cancelRound))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelRound(null)}
                  disabled={cancellingRoundId === cancelRound.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13] disabled:opacity-50"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-sm text-[#705d48]">
                  {cancelVoidKinds.length > 0
                    ? `This round has printed tickets. A VOID ticket will print for ${cancelVoidLabel}.`
                    : "This sets the round status to cancelled. No VOID ticket will print because no ticket has been printed."}
                </p>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Reason</label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    placeholder="Cancelled by staff"
                    className="mt-1 h-11 w-full rounded-lg border border-[#d8d2cb] px-3 text-sm"
                  />
                </div>

                {error && <p className="text-sm font-semibold text-[#ac312d]">{error}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirmCancelRound()}
                    disabled={cancellingRoundId === cancelRound.id}
                    className="h-11 rounded-lg bg-[#ac312d] text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {cancellingRoundId === cancelRound.id ? "Cancelling..." : "Confirm Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelRound(null)}
                    disabled={cancellingRoundId === cancelRound.id}
                    className="h-11 rounded-lg border border-[#0d0f13] text-sm font-semibold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
                  >
                    Keep Round
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {moveRound && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Move Table</h2>
                  <p className="mt-1 text-sm text-[#705d48]">
                    {moveRound.order_number} | From Table {table.number}
                  </p>
                  <p className="mt-1 text-sm text-[#705d48]">This moves the entire table order. Occupied tables can't be chosen.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMoveRound(null)}
                  disabled={movingRoundId === moveRound.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13] disabled:opacity-50"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
                  {moveTableOptions.map((option) => {
                    const isOccupied = occupiedTables.has(option.id);
                    const isSelected = selectedMoveTable === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isOccupied || movingRoundId === moveRound.id}
                        onClick={() => setSelectedMoveTable(option.id)}
                        className={`min-h-[88px] rounded-lg border p-2 text-left transition-colors ${
                          isOccupied
                            ? "cursor-not-allowed border-[#d8d2cb] bg-[#f6f2ed] opacity-60"
                            : isSelected
                              ? "border-[#c08643] bg-[#c08643]/10"
                              : "border-[#d8d2cb] bg-white hover:border-[#c08643]"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Table</p>
                        <p className="text-2xl font-bold text-[#0d0f13]">{option.number}</p>
                        <p className="text-xs font-semibold text-[#705d48]">{option.capacity}</p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isOccupied ? "bg-[#705d48] text-white" : "bg-[#ebe9e6] text-[#705d48]"
                          }`}
                        >
                          {isOccupied ? "Occupied" : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedMoveTableDef && (
                  <p className="text-xs text-[#705d48]">
                    Moving to Table {selectedMoveTableDef.number} | {selectedMoveTableDef.capacity}
                  </p>
                )}

                {error && <p className="text-sm font-semibold text-[#ac312d]">{error}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirmMoveRound()}
                    disabled={!selectedMoveTable || movingRoundId === moveRound.id}
                    className="h-11 rounded-lg bg-[#c08643] text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {movingRoundId === moveRound.id ? "Moving..." : "Confirm Move"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveRound(null)}
                    disabled={movingRoundId === moveRound.id}
                    className="h-11 rounded-lg border border-[#0d0f13] text-sm font-semibold uppercase tracking-wide text-[#0d0f13] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMergeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0f13]/60 p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0d0f13]">Merge Table</h2>
                  <p className="mt-1 text-sm text-[#705d48]">
                    {openOrder?.order_number} | Into Table {table.number}
                  </p>
                  <p className="mt-1 text-sm text-[#705d48]">
                    Merged tables share this one bill. Occupied tables can't be chosen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  disabled={merging}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d2cb] text-[#0d0f13] disabled:opacity-50"
                  title="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
                  {mergeTableOptions.map((option) => {
                    const isOccupied = occupiedTables.has(option.id);
                    const isSelected = selectedMergeTable === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isOccupied || merging}
                        onClick={() => setSelectedMergeTable(option.id)}
                        className={`min-h-[88px] rounded-lg border p-2 text-left transition-colors ${
                          isOccupied
                            ? "cursor-not-allowed border-[#d8d2cb] bg-[#f6f2ed] opacity-60"
                            : isSelected
                              ? "border-[#c08643] bg-[#c08643]/10"
                              : "border-[#d8d2cb] bg-white hover:border-[#c08643]"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#705d48]">Table</p>
                        <p className="text-2xl font-bold text-[#0d0f13]">{option.number}</p>
                        <p className="text-xs font-semibold text-[#705d48]">{option.capacity}</p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isOccupied ? "bg-[#705d48] text-white" : "bg-[#ebe9e6] text-[#705d48]"
                          }`}
                        >
                          {isOccupied ? "Occupied" : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {error && <p className="text-sm font-semibold text-[#ac312d]">{error}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirmMergeTable()}
                    disabled={!selectedMergeTable || merging}
                    className="h-11 rounded-lg bg-[#c08643] text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {merging ? "Merging..." : "Confirm Merge"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMergeModal(false)}
                    disabled={merging}
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
              serviceType="DINE IN"
              voided={printingTicketVoided}
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
              serviceType="DINE IN"
              voided={printingTicketVoided}
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
              discountGross={printingBill.discountGross}
              vatRemovedAmount={printingBill.vatRemovedAmount}
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
              discounts={printingBill.discounts}
              settings={printingBill.settings}
              cashierName={cashierName}
              isFinal={printingBill.isFinal}
            />
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
