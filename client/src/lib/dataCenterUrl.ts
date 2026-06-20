import { todayYmdManila } from "@/lib/manilaDate";

export interface DataCenterFilters {
  start: string;
  end: string;
  channel: "counter" | "web" | "both";
  status: "completed" | "cancelled" | "all";
  tab: "today" | "trends" | "reconcile" | "audit" | "export";
}

const channels = new Set<DataCenterFilters["channel"]>(["counter", "web", "both"]);
const statuses = new Set<DataCenterFilters["status"]>(["completed", "cancelled", "all"]);
const tabs = new Set<DataCenterFilters["tab"]>(["today", "trends", "reconcile", "audit", "export"]);

function isYmd(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function valueFromSet<T extends string>(value: string | null, options: Set<T>, fallback: T): T {
  return value && options.has(value as T) ? (value as T) : fallback;
}

function sameFilters(a: DataCenterFilters, b: DataCenterFilters): boolean {
  return a.tab === b.tab && a.start === b.start && a.end === b.end && a.channel === b.channel && a.status === b.status;
}

export function defaultFilters(): DataCenterFilters {
  const today = todayYmdManila();
  return {
    start: today,
    end: today,
    channel: "counter",
    status: "completed",
    tab: "today",
  };
}

export function filtersFromSearch(search: string): DataCenterFilters {
  const defaults = defaultFilters();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const start = isYmd(params.get("start")) ? params.get("start") ?? defaults.start : defaults.start;
  const end = isYmd(params.get("end")) ? params.get("end") ?? defaults.end : defaults.end;

  if (start > end) return defaults;

  return {
    tab: valueFromSet(params.get("tab"), tabs, defaults.tab),
    start,
    end,
    channel: valueFromSet(params.get("channel"), channels, defaults.channel),
    status: valueFromSet(params.get("status"), statuses, defaults.status),
  };
}

export function filtersToSearch(filters: DataCenterFilters): string {
  const defaults = defaultFilters();
  if (sameFilters(filters, defaults)) return "";

  const params = new URLSearchParams();
  params.set("tab", filters.tab);
  params.set("start", filters.start);
  params.set("end", filters.end);
  params.set("channel", filters.channel);
  params.set("status", filters.status);
  return `?${params.toString()}`;
}
