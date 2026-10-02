import { minutesIntoDay } from "./dates";

export const WORKDAY_START = "09:00";
export const LATE_GRACE_MINUTES = 10;

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** PRESENT or LATE depending on the local clock-in time. */
export function clockInStatus(
  clockIn: Date,
  timeZone: string,
  workdayStart = WORKDAY_START,
  graceMinutes = LATE_GRACE_MINUTES,
): "PRESENT" | "LATE" {
  return minutesIntoDay(clockIn, timeZone) > parseTime(workdayStart) + graceMinutes
    ? "LATE"
    : "PRESENT";
}

/** Hours between clock-in and clock-out, rounded to 2 decimals; null if incomplete. */
export function workedHours(clockIn: Date | null, clockOut: Date | null): number | null {
  if (!clockIn || !clockOut || clockOut <= clockIn) return null;
  return Math.round(((clockOut.getTime() - clockIn.getTime()) / 3_600_000) * 100) / 100;
}

/**
 * Build a Date from a local date and "HH:MM" in a time zone. Used when a
 * correction specifies times as the employee sees them.
 */
export function zonedDateTime(dateKey: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number) as [number, number];
  // Start from the wall-clock time as if it were UTC, then subtract the zone offset.
  const guess = new Date(`${dateKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const offset = minutesIntoDay(guess, timeZone) - (h * 60 + m);
  // Normalise across day boundaries (offset is within ±14h).
  const normalised = ((offset + 720 + 1440) % 1440) - 720;
  return new Date(guess.getTime() - normalised * 60_000);
}

/** "HH:MM" in a time zone for display and form defaults. */
export function formatTimeIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
