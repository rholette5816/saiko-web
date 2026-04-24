/*
  Saiko operating hours (Asia/Manila, GMT+8).
  Mon–Thu: 10:00–21:00
  Fri–Sun: 10:00–22:00
*/

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; opensToday: boolean };

export function getSaikoStatus(now: Date = new Date()): OpenStatus {
  // Convert local time to Asia/Manila regardless of user's timezone
  const phParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = phParts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parseInt(phParts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(phParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const minutesNow = hour * 60 + minute;

  const isWeekend = weekday === "Fri" || weekday === "Sat" || weekday === "Sun";
  const openMin = 10 * 60;
  const closeMin = isWeekend ? 22 * 60 : 21 * 60;

  if (minutesNow >= openMin && minutesNow < closeMin) {
    const h = Math.floor(closeMin / 60);
    const meridiem = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h;
    return { open: true, closesAt: `${h12}:00 ${meridiem}` };
  }

  return {
    open: false,
    opensAt: "10:00 AM",
    opensToday: minutesNow < openMin,
  };
}
