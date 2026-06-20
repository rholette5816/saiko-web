import {
  Activity,
  Download,
  Printer,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
import { defaultFilters, type DataCenterFilters } from "@/lib/dataCenterUrl";
import { rangeForPreset, rangeLabel, type PresetRange } from "@/lib/manilaDate";

interface DataCenterShellProps {
  filters: DataCenterFilters;
  onChangeFilters: (next: DataCenterFilters) => void;
  loading: boolean;
  scopeLabel: string;
  children: ReactNode;
  onPrint?: () => void;
  onExportCsv?: () => void;
  onRefresh?: () => void;
}

type TabKey = DataCenterFilters["tab"];

const tabs: Array<{ key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }> = [
  { key: "today", label: "Today", icon: Activity },
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "reconcile", label: "Reconcile", icon: Wallet },
  { key: "audit", label: "Audit", icon: ShieldAlert },
  { key: "export", label: "Export", icon: Download },
];

const presets: Array<{ key: PresetRange; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7" },
  { key: "last30", label: "Last 30" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

const channelLabels: Record<DataCenterFilters["channel"], string> = {
  counter: "Counter",
  web: "Web",
  both: "Both",
};

const statusLabels: Record<DataCenterFilters["status"], string> = {
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All status",
};

function chipClass(active: boolean): string {
  return `min-h-11 rounded-full px-3 text-sm font-bold ${
    active ? "bg-[#0d0f13] text-white" : "border border-[#ebe9e6] bg-white text-[#0d0f13]"
  }`;
}

function actionButtonClass(kind: "primary" | "outline"): string {
  if (kind === "primary") {
    return "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#ac312d] px-4 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60";
  }
  return "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#0d0f13] bg-white px-4 text-sm font-bold uppercase tracking-wide text-[#0d0f13] disabled:opacity-60";
}

function ScopeChips({
  filters,
  onOpen,
  scopeLabel,
}: {
  filters: DataCenterFilters;
  onOpen: () => void;
  scopeLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2" title={scopeLabel}>
      {[rangeLabel(filters.start, filters.end), channelLabels[filters.channel], statusLabels[filters.status]].map((label) => (
        <button
          key={label}
          type="button"
          onClick={onOpen}
          className="min-h-11 rounded-full border border-[#ebe9e6] bg-white px-3 text-xs font-bold uppercase tracking-wide text-[#705d48]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LoadingBar({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#ac312d]/30">
      <div className="h-full w-1/3 animate-pulse bg-[#ac312d]" />
    </div>
  );
}

function ActionButtons({
  onPrint,
  onExportCsv,
  onRefresh,
  loading,
}: {
  onPrint?: () => void;
  onExportCsv?: () => void;
  onRefresh?: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={loading} className={actionButtonClass("outline")}>
          <RefreshCw size={16} />
          Refresh
        </button>
      )}
      {onPrint && (
        <button type="button" onClick={onPrint} className={actionButtonClass("outline")}>
          <Printer size={16} />
          Print
        </button>
      )}
      {onExportCsv && (
        <button type="button" onClick={onExportCsv} disabled={loading} className={actionButtonClass("primary")}>
          <Download size={16} />
          Export
        </button>
      )}
    </div>
  );
}

function TabRow({ filters, onChangeFilters }: Pick<DataCenterShellProps, "filters" | "onChangeFilters">) {
  return (
    <nav className="flex overflow-x-auto border-b border-[#ebe9e6] bg-white" aria-label="Data Center tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = filters.tab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChangeFilters({ ...filters, tab: tab.key })}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-t-2 px-4 text-sm font-bold ${
              active ? "border-[#ac312d] text-[#ac312d]" : "border-transparent text-[#705d48]"
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function FilterSheetControls({
  draft,
  setDraft,
  onApply,
  onReset,
  onCancel,
}: {
  draft: DataCenterFilters;
  setDraft: (next: DataCenterFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => setDraft({ ...draft, ...rangeForPreset(preset.key) })}
            className={chipClass(false)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold uppercase tracking-wide text-[#705d48]">
          Start
          <input
            type="date"
            value={draft.start}
            onChange={(event) => setDraft({ ...draft, start: event.target.value })}
            className="mt-1 block min-h-11 w-full rounded-md border border-[#ebe9e6] bg-white px-3 text-sm text-[#0d0f13]"
          />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-[#705d48]">
          End
          <input
            type="date"
            value={draft.end}
            onChange={(event) => setDraft({ ...draft, end: event.target.value })}
            className="mt-1 block min-h-11 w-full rounded-md border border-[#ebe9e6] bg-white px-3 text-sm text-[#0d0f13]"
          />
        </label>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Channel</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["counter", "web", "both"] as DataCenterFilters["channel"][]).map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => setDraft({ ...draft, channel })}
              className={chipClass(draft.channel === channel)}
            >
              {channelLabels[channel]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Status</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["completed", "cancelled", "all"] as DataCenterFilters["status"][]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setDraft({ ...draft, status })}
              className={chipClass(draft.status === status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <button type="button" onClick={onApply} className={actionButtonClass("primary")}>
          Apply
        </button>
        <button type="button" onClick={onReset} className={actionButtonClass("outline")}>
          Reset
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-md px-4 text-sm font-bold uppercase tracking-wide text-[#705d48]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function DesktopFilterRail({
  filters,
  onChangeFilters,
}: Pick<DataCenterShellProps, "filters" | "onChangeFilters">) {
  const [customStart, setCustomStart] = useState(filters.start);
  const [customEnd, setCustomEnd] = useState(filters.end);

  useEffect(() => {
    setCustomStart(filters.start);
    setCustomEnd(filters.end);
  }, [filters.start, filters.end]);

  return (
    <aside className="rounded-lg border border-[#ebe9e6] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#0d0f13]">Filters</h2>
      <div className="mt-4 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Date Range</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onChangeFilters({ ...filters, ...rangeForPreset(preset.key) })}
                className={chipClass(false)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wide text-[#705d48]">
            Start
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-md border border-[#ebe9e6] bg-white px-3 text-sm text-[#0d0f13]"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-[#705d48]">
            End
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-md border border-[#ebe9e6] bg-white px-3 text-sm text-[#0d0f13]"
            />
          </label>
          <button
            type="button"
            onClick={() => onChangeFilters({ ...filters, start: customStart, end: customEnd })}
            className={actionButtonClass("primary")}
          >
            Apply
          </button>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Channel</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["counter", "web", "both"] as DataCenterFilters["channel"][]).map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => onChangeFilters({ ...filters, channel })}
                className={chipClass(filters.channel === channel)}
              >
                {channelLabels[channel]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#705d48]">Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["completed", "cancelled", "all"] as DataCenterFilters["status"][]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onChangeFilters({ ...filters, status })}
                className={chipClass(filters.status === status)}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function DataCenterShell({
  filters,
  onChangeFilters,
  loading,
  scopeLabel,
  children,
  onPrint,
  onExportCsv,
  onRefresh,
}: DataCenterShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const hasMobileActions = Boolean(onPrint || onExportCsv);

  function openSheet() {
    setDraft(filters);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  function applySheet() {
    onChangeFilters(draft);
    closeSheet();
  }

  function resetSheet() {
    setDraft(defaultFilters());
  }

  useEffect(() => {
    if (!sheetOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = sheetRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSheet();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((item) => !item.hasAttribute("disabled"));
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [sheetOpen]);

  return (
    <div className="relative min-h-[70vh]">
      <div className="sticky top-0 z-30 md:hidden">
        <div className="relative flex min-h-14 items-center justify-between border-b border-[#ebe9e6] bg-white px-3">
          <h1 className="font-poppins text-base font-bold uppercase tracking-wide text-[#0d0f13]">Data Center</h1>
          <button
            type="button"
            onClick={openSheet}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#ebe9e6] text-[#0d0f13]"
            aria-label="Open filters"
          >
            <SlidersHorizontal size={20} />
          </button>
          <LoadingBar loading={loading} />
        </div>
      </div>

      <div className="sticky top-14 z-20 border-b border-[#ebe9e6] bg-white px-3 py-2 md:hidden">
        <ScopeChips filters={filters} onOpen={openSheet} scopeLabel={scopeLabel} />
      </div>

      <div className="sticky top-0 z-30 hidden border-b border-[#ebe9e6] bg-white md:block lg:hidden">
        <div className="relative flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-poppins text-base font-bold uppercase tracking-wide text-[#0d0f13]">Data Center</h1>
            <ScopeChips filters={filters} onOpen={openSheet} scopeLabel={scopeLabel} />
          </div>
          <ActionButtons onPrint={onPrint} onExportCsv={onExportCsv} onRefresh={onRefresh} loading={loading} />
          <LoadingBar loading={loading} />
        </div>
        <TabRow filters={filters} onChangeFilters={onChangeFilters} />
      </div>

      <div className={`lg:hidden ${hasMobileActions ? "pb-32" : "pb-20"} pt-3 md:pb-0`}>{children}</div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <DesktopFilterRail filters={filters} onChangeFilters={onChangeFilters} />
        <section className="min-w-0">
          <div className="relative mb-3 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ebe9e6] bg-white px-4 py-2">
            <div>
              <h1 className="font-poppins text-base font-bold uppercase tracking-wide text-[#0d0f13]">Data Center</h1>
              <p className="text-xs font-semibold text-[#705d48]">{scopeLabel}</p>
            </div>
            <ActionButtons onPrint={onPrint} onExportCsv={onExportCsv} onRefresh={onRefresh} loading={loading} />
            <LoadingBar loading={loading} />
          </div>
          <TabRow filters={filters} onChangeFilters={onChangeFilters} />
          <div className="mt-4">{children}</div>
        </section>
      </div>

      {hasMobileActions && (
        <div className="fixed inset-x-0 z-40 border-t border-[#ebe9e6] bg-white p-3 md:hidden bottom-[calc(56px+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2">
            {onPrint && (
              <button type="button" onClick={onPrint} className={actionButtonClass("outline")}>
                <Printer size={16} />
                Print
              </button>
            )}
            {onExportCsv && (
              <button type="button" onClick={onExportCsv} disabled={loading} className={actionButtonClass("primary")}>
                <Download size={16} />
                Export
              </button>
            )}
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid min-h-14 grid-cols-5 border-t border-[#ebe9e6] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Data Center mobile tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = filters.tab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChangeFilters({ ...filters, tab: tab.key })}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-bold ${
                active ? "border-[#ac312d] text-[#ac312d]" : "border-transparent text-[#705d48]"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 md:flex md:items-end lg:hidden" onMouseDown={closeSheet}>
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Data Center filters"
            onMouseDown={(event) => event.stopPropagation()}
            className="fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-lg bg-white p-4 shadow-2xl transition-transform md:mx-auto md:max-w-xl"
          >
            <FilterSheetControls
              draft={draft}
              setDraft={setDraft}
              onApply={applySheet}
              onReset={resetSheet}
              onCancel={closeSheet}
            />
          </div>
        </div>
      )}
    </div>
  );
}
