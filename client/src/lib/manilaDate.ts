export type PresetRange = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth";

const MANILA_TZ = "Asia/Manila";
const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TZ,
  month: "short",
  day: "numeric",
});

const SHORT_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TZ,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatYmdManila(date: Date): string {
  return YMD_FORMATTER.format(date);
}

function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function dateFromYmdNoonUtc(ymd: string): Date {
  const parsed = parseYmd(ymd) ?? parseYmd(todayYmdManila());
  if (!parsed) return new Date();
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0));
}

function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function monthStartFromOffset(ymd: string, offset: number): string {
  const parsed = parseYmd(ymd) ?? parseYmd(todayYmdManila());
  if (!parsed) return todayYmdManila();
  return formatYmdManila(new Date(Date.UTC(parsed.year, parsed.month - 1 + offset, 1, 12, 0, 0)));
}

function formatRangeDate(ymd: string, includeYear: boolean): string {
  const date = dateFromYmdNoonUtc(ymd);
  return includeYear ? SHORT_YEAR_FORMATTER.format(date) : SHORT_FORMATTER.format(date);
}

export function todayYmdManila(): string {
  return formatYmdManila(new Date());
}

export function shiftYmdManila(ymd: string, days: number): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return todayYmdManila();
  return formatYmdManila(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days, 12, 0, 0)));
}

export function rangeLabel(start: string, end: string): string {
  const today = todayYmdManila();
  const yesterday = shiftYmdManila(today, -1);
  const normalizedStart = start <= end ? start : end;
  const normalizedEnd = start <= end ? end : start;
  const currentYear = today.slice(0, 4);
  const sameYear = normalizedStart.slice(0, 4) === currentYear && normalizedEnd.slice(0, 4) === currentYear;
  const includeYear = !sameYear;

  if (normalizedStart === normalizedEnd) {
    if (normalizedStart === today) return "Today";
    if (normalizedStart === yesterday) return "Yesterday";
    return formatRangeDate(normalizedStart, includeYear);
  }

  return `${formatRangeDate(normalizedStart, includeYear)} to ${formatRangeDate(normalizedEnd, includeYear)}`;
}

export function rangeForPreset(preset: PresetRange): { start: string; end: string } {
  const today = todayYmdManila();

  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") {
    const yesterday = shiftYmdManila(today, -1);
    return { start: yesterday, end: yesterday };
  }
  if (preset === "last7") return { start: shiftYmdManila(today, -6), end: today };
  if (preset === "last30") return { start: shiftYmdManila(today, -29), end: today };
  if (preset === "thisMonth") return { start: firstOfMonth(today), end: today };

  const start = monthStartFromOffset(today, -1);
  const end = shiftYmdManila(monthStartFromOffset(today, 0), -1);
  return { start, end };
}
