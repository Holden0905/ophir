import "server-only";

// en-CA produces YYYY-MM-DD; we anchor everything in the US trading session
// regardless of where the cron runs.
const NY_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function nyDate(d: Date = new Date()): string {
  return NY_DATE_FMT.format(d);
}

/** YYYY-MM-DD → epoch-ms at midnight UTC (sufficient for date arithmetic). */
export function dateStrToMs(s: string): number {
  return Date.parse(`${s}T00:00:00Z`);
}

/** Add N calendar days to a YYYY-MM-DD string. */
export function addCalendarDays(date: string, days: number): string {
  const ms = dateStrToMs(date) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
