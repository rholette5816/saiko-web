export type DateRangeKey = "today" | "yesterday" | "last7" | "thisMonth" | "custom";

export interface DateRange {
  key: DateRangeKey;
  startIso: string;
  endIso: string;
  label: string;
}

interface ManilaParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const MANILA_TZ = "Asia/Manila";
const DAY_MS = 24 * 60 * 60 * 1000;

function getManilaParts(now: Date): ManilaParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function manilaToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function parseYmd(dateString: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getRange(key: Exclude<DateRangeKey, "custom">): DateRange {
  const now = new Date();
  const ph = getManilaParts(now);
  const startOfTodayUtc = manilaToUtc(ph.year, ph.month, ph.day, 0, 0, 0);
  const nowUtcFromManilaClock = manilaToUtc(ph.year, ph.month, ph.day, ph.hour, ph.minute, ph.second);

  if (key === "today") {
    return {
      key,
      startIso: startOfTodayUtc.toISOString(),
      endIso: addDaysUtc(startOfTodayUtc, 1).toISOString(),
      label: "Today",
    };
  }

  if (key === "yesterday") {
    const start = addDaysUtc(startOfTodayUtc, -1);
    return {
      key,
      startIso: start.toISOString(),
      endIso: startOfTodayUtc.toISOString(),
      label: "Yesterday",
    };
  }

  if (key === "last7") {
    const start = new Date(nowUtcFromManilaClock.getTime() - 7 * DAY_MS);
    return {
      key,
      startIso: start.toISOString(),
      endIso: nowUtcFromManilaClock.toISOString(),
      label: "Last 7 Days",
    };
  }

  const startOfMonthUtc = manilaToUtc(ph.year, ph.month, 1, 0, 0, 0);
  const nextMonthYear = ph.month === 12 ? ph.year + 1 : ph.year;
  const nextMonth = ph.month === 12 ? 1 : ph.month + 1;
  const startOfNextMonthUtc = manilaToUtc(nextMonthYear, nextMonth, 1, 0, 0, 0);

  return {
    key,
    startIso: startOfMonthUtc.toISOString(),
    endIso: startOfNextMonthUtc.toISOString(),
    label: "This Month",
  };
}

export function getCustomRange(startDate: string, endDate: string): DateRange {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);

  if (!start || !end) {
    const fallback = getRange("today");
    return { ...fallback, key: "custom", label: "Custom" };
  }

  const startUtc = manilaToUtc(start.year, start.month, start.day, 0, 0, 0);
  const endUtcBase = manilaToUtc(end.year, end.month, end.day, 0, 0, 0);
  const normalizedEndBase = endUtcBase.getTime() < startUtc.getTime() ? startUtc : endUtcBase;
  const endExclusiveUtc = addDaysUtc(normalizedEndBase, 1);

  return {
    key: "custom",
    startIso: startUtc.toISOString(),
    endIso: endExclusiveUtc.toISOString(),
    label: "Custom",
  };
}
