import { type OrGapRow } from "@/lib/dataCenter";

interface OrGapPanelProps {
  gaps: OrGapRow[];
  max?: number;
}

export function OrGapPanel({ gaps, max = 10 }: OrGapPanelProps) {
  if (gaps.length === 0) return null;

  const visible = gaps.slice(0, max);

  return (
    <div className="rounded-lg border border-[#ebe9e6] border-l-4 border-l-[#ac312d] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#0d0f13]">OR Gaps ({gaps.length})</h2>
      <ul className="mt-3 space-y-1 text-sm text-[#0d0f13]">
        {visible.map((gap) => (
          <li key={`${gap.prev_or}-${gap.or_number}-${gap.next_or}`}>
            {gap.or_number} missing between {gap.prev_or} and {gap.next_or}
          </li>
        ))}
        {gaps.length > max && <li className="text-[#705d48]">and {gaps.length - max} more</li>}
      </ul>
    </div>
  );
}
