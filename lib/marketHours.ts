// True while the NYSE regular session is open (Mon-Fri 09:30-16:00 ET).
// Used to gate live-quote polling for stocks/ETFs — outside the session
// the underlying values aren't moving, so polling burns Yahoo quota for
// stale data. Crypto polling ignores this and runs 24/7.
//
// Holidays aren't modeled — Yahoo will just return yesterday's close on a
// holiday, which is fine to display while we keep polling at the cost of
// a single round-trip per minute.
export function isUsEquityMarketOpen(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  if (weekday === "Sat" || weekday === "Sun") return false;

  const minutes = hour * 60 + minute;
  const open = 9 * 60 + 30; // 09:30 ET
  const close = 16 * 60; // 16:00 ET
  return minutes >= open && minutes < close;
}
