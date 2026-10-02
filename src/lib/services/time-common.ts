import "server-only";

import { db } from "@/lib/db";
import { type DateKey, fromDateKey, toDateKey } from "@/lib/domain/dates";
import { DomainError } from "@/lib/errors";

/** The signed-in user's employee record with the time zone of their location. */
export async function requireOwnEmployee(employeeId: string | null) {
  if (!employeeId) throw new DomainError("Your account isn't linked to an employee record.");
  const employee = await db.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: { location: { select: { timezone: true } } },
  });
  if (!employee || employee.employmentStatus === "TERMINATED") {
    throw new DomainError("Your employee record isn't active.");
  }
  return { ...employee, timezone: employee.location?.timezone ?? "UTC" };
}

/** Holiday date keys between two dates that apply to a location (or everywhere). */
export async function holidaySet(start: DateKey, end: DateKey, locationId: string | null): Promise<Set<DateKey>> {
  const holidays = await db.holiday.findMany({
    where: {
      date: { gte: fromDateKey(start), lte: fromDateKey(end) },
      OR: [{ locationId: null }, ...(locationId ? [{ locationId }] : [])],
    },
    select: { date: true },
  });
  return new Set(holidays.map((h) => toDateKey(h.date)));
}
