const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const monthFmt = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });

/** Format a calendar date (stored as UTC midnight). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value);
}

export function formatDateTime(value: Date | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  return timeZone
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(value)
    : dateTimeFmt.format(value);
}

export function formatMonth(month: string): string {
  return monthFmt.format(new Date(`${month}-01T00:00:00Z`));
}

export function formatDays(days: number | { toString(): string }): string {
  const n = Number(days);
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? "day" : "days"}`;
}

/** "FULL_TIME" → "Full time" */
export function labelize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}

export function formatMoney(amount: number | { toString(): string } | null, currency = "USD"): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(amount),
  );
}
