import { getSaikoStatus } from "./hours";

export interface PickupSlot {
  value: string;        // ISO-ish key, e.g., "today-14:30"
  label: string;        // "Today, 2:30 PM"
  date: Date;
  isAsap?: boolean;
  isTomorrow?: boolean;
}

const PREP_MINUTES = 45;
const SLOT_INTERVAL = 15;

function manilaNow(): Date {
  // Returns a Date object whose UTC fields represent the current Manila wall time.
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return new Date(Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  ));
}

function isWeekendDay(date: Date): boolean {
  const day = date.getUTCDay(); // Sun=0, Fri=5, Sat=6
  return day === 0 || day === 5 || day === 6;
}

function formatSlotLabel(date: Date, dayPrefix: "Today" | "Tomorrow"): string {
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  const meridiem = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dayPrefix}, ${h12}:${m.toString().padStart(2, "0")} ${meridiem}`;
}

function ceilToInterval(date: Date, intervalMin: number): Date {
  const result = new Date(date);
  const m = result.getUTCMinutes();
  const remainder = m % intervalMin;
  if (remainder === 0) return result;
  result.setUTCMinutes(m + (intervalMin - remainder), 0, 0);
  return result;
}

export interface PickupOptions {
  slots: PickupSlot[];
  isClosedToday: boolean;
  showPreOrderNotice: boolean;
  prepMinutes: number;
}

export function getPickupOptions(): PickupOptions {
  const now = manilaNow();
  const status = getSaikoStatus(new Date());
  const slots: PickupSlot[] = [];

  if (status.open) {
    const earliest = new Date(now.getTime() + PREP_MINUTES * 60_000);
    const closeHour = isWeekendDay(now) ? 22 : 21;
    const close = new Date(now);
    close.setUTCHours(closeHour, 0, 0, 0);

    if (earliest < close) {
      slots.push({
        value: "asap",
        label: `ASAP (ready in ~${PREP_MINUTES} min)`,
        date: earliest,
        isAsap: true,
      });

      let cursor = ceilToInterval(earliest, SLOT_INTERVAL);
      while (cursor <= close) {
        slots.push({
          value: `today-${cursor.toISOString()}`,
          label: formatSlotLabel(cursor, "Today"),
          date: new Date(cursor),
        });
        cursor = new Date(cursor.getTime() + SLOT_INTERVAL * 60_000);
      }
    }

    return { slots, isClosedToday: false, showPreOrderNotice: false, prepMinutes: PREP_MINUTES };
  }

  // Closed: build pre-order slots for next open day.
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowClose = isWeekendDay(tomorrow) ? 22 : 21;

  const start = new Date(tomorrow);
  start.setUTCHours(10, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setUTCHours(tomorrowClose, 0, 0, 0);

  let cursor = new Date(start);
  while (cursor <= end) {
    slots.push({
      value: `tomorrow-${cursor.toISOString()}`,
      label: formatSlotLabel(cursor, "Tomorrow"),
      date: new Date(cursor),
      isTomorrow: true,
    });
    cursor = new Date(cursor.getTime() + SLOT_INTERVAL * 60_000);
  }

  return { slots, isClosedToday: true, showPreOrderNotice: true, prepMinutes: PREP_MINUTES };
}
