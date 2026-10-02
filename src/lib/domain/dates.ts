// Calendar-date helpers. Dates without a time (hire dates, leave days,
// attendance days) are handled as "YYYY-MM-DD" keys and stored as UTC
// midnight, matching Postgres `date` columns.

export type DateKey = string;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): value is DateKey {
  if (!DATE_KEY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function toDateKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

/** UTC midnight for a date key, the form Prisma expects for `@db.Date`. */
export function fromDateKey(key: DateKey): Date {
  return new Date(`${key}T00:00:00Z`);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

/** Inclusive list of date keys from `start` to `end`. */
export function eachDay(start: DateKey, end: DateKey): DateKey[] {
  const days: DateKey[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function isWeekend(key: DateKey): boolean {
  const weekday = fromDateKey(key).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** "YYYY-MM" → first and last day of that month. */
export function monthRange(month: string): { start: DateKey; end: DateKey } {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0));
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return toDateKey(date).slice(0, 7);
}

/** Today's date key in an IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): DateKey {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Minutes since local midnight for `date` in `timeZone`. */
export function minutesIntoDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function rangesOverlap(
  a: { start: DateKey; end: DateKey },
  b: { start: DateKey; end: DateKey },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}
