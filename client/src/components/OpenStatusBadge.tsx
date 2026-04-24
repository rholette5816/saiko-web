import { useEffect, useState } from "react";
import { getSaikoStatus, type OpenStatus } from "@/lib/hours";

export function OpenStatusBadge({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<OpenStatus>(() => getSaikoStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(getSaikoStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (status.open) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="font-semibold text-sm">
          <span className="text-green-700">Open Now</span>
          <span className="text-[#705d48]"> · Closes {status.closesAt}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="inline-flex rounded-full h-2.5 w-2.5 bg-[#ac312d]" />
      <span className="font-semibold text-sm">
        <span className="text-[#ac312d]">Closed</span>
        <span className="text-[#705d48]">
          {" "}· {status.opensToday ? `Opens ${status.opensAt}` : `Opens ${status.opensAt} tomorrow`}
        </span>
      </span>
    </div>
  );
}
