import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/dataCenter/Sparkline";

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  deltaPct?: number | null;
  deltaLabel?: string;
  trend?: number[];
  variant?: "default" | "warning" | "danger";
  onClick?: () => void;
}

function deltaText(deltaPct: number): string {
  const rounded = Math.abs(deltaPct).toFixed(1).replace(/\.0$/, "");
  return `${rounded}%`;
}

function tileClass(variant: KpiTileProps["variant"], clickable: boolean): string {
  const border =
    variant === "warning"
      ? "border-l-4 border-l-[#e88627]"
      : variant === "danger"
        ? "border-l-4 border-l-[#ac312d]"
        : "";
  const interaction = clickable ? "cursor-pointer hover:bg-[#faf8f6]" : "";
  return `relative min-h-[132px] rounded-lg border border-[#ebe9e6] bg-white p-4 text-left ${border} ${interaction}`;
}

export function KpiTile({
  label,
  value,
  hint,
  deltaPct = null,
  deltaLabel,
  trend,
  variant = "default",
  onClick,
}: KpiTileProps) {
  const showDelta = typeof deltaPct === "number" && Number.isFinite(deltaPct) && deltaPct !== 0;
  const isPositive = showDelta && deltaPct > 0;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="pr-16 text-xs font-bold uppercase tracking-wide text-[#705d48]">{label}</p>
        {showDelta && (
          <span
            className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
              isPositive ? "bg-[#ebe9e6] text-[#0d0f13]" : "bg-[#ac312d]/10 text-[#ac312d]"
            }`}
            title={deltaLabel}
          >
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {deltaText(deltaPct)}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-[#0d0f13] md:text-3xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-[#705d48]">{hint}</p>}
          {showDelta && deltaLabel && <p className="mt-1 text-[11px] text-[#705d48]">{deltaLabel}</p>}
        </div>
        {trend && <Sparkline values={trend} className="shrink-0" />}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={tileClass(variant, true)}>
        {content}
      </button>
    );
  }

  return <div className={tileClass(variant, false)}>{content}</div>;
}
