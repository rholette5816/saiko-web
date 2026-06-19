import { menuData } from "@/lib/menuData";

export type TicketKind = "kitchen" | "bar";

export interface TicketPrintStatus {
  printedAt: string | null;
  count: number;
}

export interface TicketRouteItem {
  item_id?: string | null;
  item_name: string;
  quantity: number | string;
}

export interface TicketStatusSource {
  notes?: string | null;
  kitchen_ticket_printed_at?: string | null;
  kitchen_ticket_print_count?: number | string | null;
  bar_ticket_printed_at?: string | null;
  bar_ticket_print_count?: number | string | null;
}

const PRINT_NOTE_PREFIX = "[printed:";

const categoryByItemId = new Map(
  menuData.flatMap((category) => category.items.map((item) => [item.id, category.id] as const)),
);

export function emptyTicketPrintStatus(): Record<TicketKind, TicketPrintStatus> {
  return {
    kitchen: { printedAt: null, count: 0 },
    bar: { printedAt: null, count: 0 },
  };
}

export function parseOrderTicketNotes(value: string | null | undefined): {
  notes: string;
  printStatus: Record<TicketKind, TicketPrintStatus>;
} {
  const printStatus = emptyTicketPrintStatus();
  const noteLines: string[] = [];

  (value ?? "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

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

  return { notes: noteLines.join("\n").trim(), printStatus };
}

export function cleanOrderNotes(value: string | null | undefined): string {
  return parseOrderTicketNotes(value).notes;
}

export function composeOrderTicketNotes(
  notes: string | null | undefined,
  printStatus: Record<TicketKind, TicketPrintStatus>,
): string | null {
  const cleanNotes = cleanOrderNotes(notes);
  const parts: string[] = [];

  (["kitchen", "bar"] as TicketKind[]).forEach((kind) => {
    const status = printStatus[kind];
    if (status.printedAt) parts.push(`[printed:${kind}|${status.printedAt}|${status.count}]`);
  });
  if (cleanNotes) parts.push(cleanNotes);

  return parts.length ? parts.join("\n") : null;
}

export function isDrinkItem(itemId: string | null | undefined): boolean {
  return categoryByItemId.get(itemId ?? "") === "drinks";
}

export function getTicketItems<T extends TicketRouteItem>(items: T[] | null | undefined, kind: TicketKind): T[] {
  return (items ?? [])
    .filter((item) => (kind === "bar" ? isDrinkItem(item.item_id) : !isDrinkItem(item.item_id)))
    .filter((item) => Number(item.quantity ?? 0) > 0);
}

export function getRequiredTicketKinds(items: TicketRouteItem[] | null | undefined): TicketKind[] {
  const kinds: TicketKind[] = [];
  if (getTicketItems(items, "kitchen").length > 0) kinds.push("kitchen");
  if (getTicketItems(items, "bar").length > 0) kinds.push("bar");
  return kinds;
}

export function getTicketStatus(order: TicketStatusSource, kind: TicketKind): TicketPrintStatus {
  const notesStatus = parseOrderTicketNotes(order.notes).printStatus[kind];
  const printedAt =
    kind === "kitchen" ? order.kitchen_ticket_printed_at ?? null : order.bar_ticket_printed_at ?? null;
  const rawCount = kind === "kitchen" ? order.kitchen_ticket_print_count : order.bar_ticket_print_count;
  const count = Number(rawCount ?? 0);

  if (printedAt || count > 0) {
    return { printedAt, count };
  }

  return notesStatus;
}

export function areRequiredTicketsSubmitted(
  order: TicketStatusSource,
  items: TicketRouteItem[] | null | undefined,
): boolean {
  return getRequiredTicketKinds(items).every((kind) => !!getTicketStatus(order, kind).printedAt);
}
