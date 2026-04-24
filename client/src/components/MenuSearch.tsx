import { Search, X } from "lucide-react";

interface MenuSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number | null;
}

export function MenuSearch({ value, onChange, resultCount }: MenuSearchProps) {
  return (
    <div className="max-w-lg mx-auto mb-10">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#705d48] pointer-events-none"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search ramen, sushi, bento..."
          className="w-full pl-11 pr-11 py-3 rounded-full border-2 border-[#ebe9e6] bg-white text-[#0d0f13] placeholder-[#705d48] focus:outline-none focus:border-[#c08643] focus:ring-2 focus:ring-[#c08643]/20 transition-all"
          aria-label="Search menu"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#ebe9e6] text-[#705d48]"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {value && resultCount !== null && (
        <p className="text-center text-sm text-[#705d48] mt-3">
          {resultCount === 0 ? (
            <>No matches for "<span className="text-[#ac312d] font-semibold">{value}</span>". Try another word.</>
          ) : (
            <><span className="font-semibold text-[#0d0f13]">{resultCount}</span> {resultCount === 1 ? "dish" : "dishes"} found</>
          )}
        </p>
      )}
    </div>
  );
}
