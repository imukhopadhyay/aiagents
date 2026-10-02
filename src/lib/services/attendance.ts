import "server-only";

import type { z } from "zod";

import type { AttendanceStatus } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { clockInStatus, workedHours, zonedDateTime } from "@/lib/domain/attendance";
import { type DateKey, eachDay, fromDateKey, isWeekend, monthRange, todayIn, toDateKey } from "@/lib/domain/dates";
import { DomainError, NotFoundError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { AuthorizationError, can } from "@/lib/rbac/authorize";
import type { clockInSchema, correctionSchema, decisionSchema } from "@/lib/validation/time";

import { employeeAccessWhere } from "./employees";
import { notifyEmployees, notifyUsers, usersWithOrgWidePermission } from "./notifications";
import { holidaySet, requireOwnEmployee } from "./time-common";

async function ownForRecording(user: CurrentUser) {
  const employee = await requireOwnEmployee(user.employeeId);
  if (!can(user, "attendance:record", { employeeId: employee.id })) throw new AuthorizationError("attendance:record");
  return employee;
}

// ─── Clocking ────────────────────────────────────────────────────────────────

export async function getToday(user: CurrentUser) {
  if (!user.employeeId) return null;
  const employee = await requireOwnEmployee(user.employeeId).catch(() => null);
  if (!employee) return null;
  const today = todayIn(employee.timezone);
  const record = await db.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: fromDateKey(today) } },
  });
  return { today, timezone: employee.timezone, record };
}

export async function clockIn(user: CurrentUser, input: z.output<typeof clockInSchema>) {
  const employee = await ownForRecording(user);
  const now = new Date();
  const today = todayIn(employee.timezone, now);
  const date = fromDateKey(today);

  const existing = await db.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  });
  if (existing?.clockIn) throw new DomainError("You've already clocked in today.");

  const status: AttendanceStatus = input.remote ? "REMOTE" : clockInStatus(now, employee.timezone);
  await db.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: employee.id, date } },
    update: { clockIn: now, status },
    create: { employeeId: employee.id, date, clockIn: now, status },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", entity: "AttendanceRecord", entityId: employee.id, changes: { clockIn: now, status } });
  return status;
}

export async function clockOut(user: CurrentUser) {
  const employee = await ownForRecording(user);
  const now = new Date();
  const date = fromDateKey(todayIn(employee.timezone, now));
  const record = await db.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  });
  if (!record?.clockIn) throw new DomainError("Clock in before clocking out.");
  if (record.clockOut) throw new DomainError("You've already clocked out today.");
  await db.attendanceRecord.update({ where: { id: record.id }, data: { clockOut: now } });
  await recordAudit({ actorId: user.id, action: "UPDATE", entity: "AttendanceRecord", entityId: employee.id, changes: { clockOut: now } });
}

// ─── Corrections ─────────────────────────────────────────────────────────────

export async function requestCorrection(user: CurrentUser, input: z.output<typeof correctionSchema>) {
  const employee = await ownForRecording(user);
  if (input.date > todayIn(employee.timezone)) throw new DomainError("You can't correct a future date.", "date");
  if (["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(input.status) && !input.clockIn) {
    throw new DomainError("Enter the clock-in time.", "clockIn");
  }

  const date = fromDateKey(input.date);
  const pending = await db.attendanceCorrection.findFirst({
    where: { employeeId: employee.id, date, status: "PENDING" },
  });
  if (pending) throw new DomainError("You already have a pending correction for this day.", "date");

  const record = await db.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  });
  const correction = await db.attendanceCorrection.create({
    data: {
      employeeId: employee.id,
      attendanceRecordId: record?.id,
      date,
      requestedClockIn: input.clockIn ? zonedDateTime(input.date, input.clockIn, employee.timezone) : null,
      requestedClockOut: input.clockOut ? zonedDateTime(input.date, input.clockOut, employee.timezone) : null,
      requestedStatus: input.status,
      reason: input.reason,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", entity: "AttendanceCorrection", entityId: correction.id, changes: input });

  const notification = {
    type: "attendance.correction_requested",
    title: `${employee.firstName} ${employee.lastName} requested an attendance correction`,
    body: `${formatDate(input.date)}: ${input.reason}`,
    link: "/approvals?tab=attendance",
  };
  await notifyEmployees([employee.managerId], notification);
  await notifyUsers(await usersWithOrgWidePermission("attendance:manage"), notification);
}

export async function reviewCorrection(user: CurrentUser, input: z.output<typeof decisionSchema>) {
  const correction = await db.attendanceCorrection.findUnique({ where: { id: input.id } });
  if (!correction) throw new NotFoundError("Correction");
  if (!can(user, "attendance:manage", { employeeId: correction.employeeId })) {
    throw new AuthorizationError("attendance:manage");
  }
  if (correction.employeeId === user.employeeId) throw new DomainError("You can't review your own correction.");
  if (correction.status !== "PENDING") throw new DomainError("This correction has already been reviewed.");

  const approve = input.decision === "approve";
  await db.$transaction(async (tx) => {
    const { count } = await tx.attendanceCorrection.updateMany({
      where: { id: correction.id, status: "PENDING" },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewerId: user.employeeId,
        reviewComment: input.comment,
        reviewedAt: new Date(),
      },
    });
    if (count === 0) throw new DomainError("This correction was just reviewed by someone else.");
    if (approve) {
      const values = {
        clockIn: correction.requestedClockIn,
        clockOut: correction.requestedClockOut,
        status: correction.requestedStatus,
        notes: `Corrected: ${correction.reason}`,
      };
      await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: correction.employeeId, date: correction.date } },
        update: values,
        create: { employeeId: correction.employeeId, date: correction.date, ...values },
      });
    }
  });

  await recordAudit({
    actorId: user.id,
    action: approve ? "APPROVE" : "REJECT",
    entity: "AttendanceCorrection",
    entityId: correction.id,
    changes: { comment: input.comment },
  });
  await notifyEmployees([correction.employeeId], {
    type: `attendance.correction_${approve ? "approved" : "rejected"}`,
    title: `Your attendance correction was ${approve ? "approved" : "rejected"}`,
    body: `${formatDate(correction.date)}${input.comment ? ` — “${input.comment}”` : ""}`,
    link: "/attendance",
  });
}

export async function pendingCorrections(user: CurrentUser) {
  if (!user.permissions["attendance:manage"]) return [];
  return db.attendanceCorrection.findMany({
    where: {
      status: "PENDING",
      employee: { ...employeeAccessWhere(user, "attendance:manage"), deletedAt: null },
      ...(user.employeeId ? { employeeId: { not: user.employeeId } } : {}),
    },
    orderBy: { date: "asc" },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, photoUrl: true, location: { select: { timezone: true } } } },
      attendanceRecord: true,
    },
  });
}

// ─── Views and reports ───────────────────────────────────────────────────────

export type DayStatus = AttendanceStatus | "WEEKEND" | "HOLIDAY" | "FUTURE" | "NONE";

export interface DayView {
  date: DateKey;
  status: DayStatus;
  clockIn: Date | null;
  clockOut: Date | null;
  hours: number | null;
}

/**
 * Resolve each day of a range for one employee: recorded attendance first,
 * then approved leave, holidays and weekends; past working days with nothing
 * recorded count as absent.
 */
function resolveDays(opts: {
  days: DateKey[];
  today: DateKey;
  hireDate: DateKey;
  records: Map<DateKey, { clockIn: Date | null; clockOut: Date | null; status: AttendanceStatus }>;
  leaveDays: Set<DateKey>;
  holidays: Set<DateKey>;
}): DayView[] {
  return opts.days.map((date) => {
    const record = opts.records.get(date);
    if (record) {
      return { date, status: record.status, clockIn: record.clockIn, clockOut: record.clockOut, hours: workedHours(record.clockIn, record.clockOut) };
    }
    const base = { date, clockIn: null, clockOut: null, hours: null };
    if (opts.leaveDays.has(date) && !isWeekend(date) && !opts.holidays.has(date)) return { ...base, status: "ON_LEAVE" };
    if (opts.holidays.has(date)) return { ...base, status: "HOLIDAY" };
    if (isWeekend(date)) return { ...base, status: "WEEKEND" };
    if (date > opts.today) return { ...base, status: "FUTURE" };
    if (date < opts.hireDate) return { ...base, status: "NONE" };
    if (date === opts.today) return { ...base, status: "NONE" }; // the day isn't over yet
    return { ...base, status: "ABSENT" };
  });
}

async function approvedLeaveDays(employeeIds: string[], start: DateKey, end: DateKey) {
  const leaves = await db.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: "APPROVED",
      startDate: { lte: fromDateKey(end) },
      endDate: { gte: fromDateKey(start) },
    },
    select: { employeeId: true, startDate: true, endDate: true },
  });
  const byEmployee = new Map<string, Set<DateKey>>();
  for (const leave of leaves) {
    const set = byEmployee.get(leave.employeeId) ?? new Set<DateKey>();
    const from = toDateKey(leave.startDate) < start ? start : toDateKey(leave.startDate);
    const to = toDateKey(leave.endDate) > end ? end : toDateKey(leave.endDate);
    for (const day of eachDay(from, to)) set.add(day);
    byEmployee.set(leave.employeeId, set);
  }
  return byEmployee;
}

async function employeesInScope(user: CurrentUser, extra: { departmentId?: string; employeeId?: string } = {}) {
  return db.employee.findMany({
    where: {
      ...employeeAccessWhere(user, "attendance:read"),
      deletedAt: null,
      employmentStatus: { not: "TERMINATED" },
      ...(extra.departmentId ? { departmentId: extra.departmentId } : {}),
      ...(extra.employeeId ? { id: extra.employeeId } : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      hireDate: true,
      locationId: true,
      department: { select: { name: true } },
      location: { select: { timezone: true } },
    },
  });
}

/** Day-by-day view of one month for each employee in scope. */
export async function monthlyAttendance(
  user: CurrentUser,
  month: string,
  filter: { departmentId?: string; employeeId?: string } = {},
) {
  const { start, end } = monthRange(month);
  const employees = await employeesInScope(user, filter);
  const ids = employees.map((e) => e.id);
  const [records, leave] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { employeeId: { in: ids }, date: { gte: fromDateKey(start), lte: fromDateKey(end) } },
    }),
    approvedLeaveDays(ids, start, end),
  ]);
  const holidaysByLocation = new Map<string | null, Set<DateKey>>();
  for (const locationId of new Set(employees.map((e) => e.locationId))) {
    holidaysByLocation.set(locationId, await holidaySet(start, end, locationId));
  }

  const days = eachDay(start, end);
  return employees.map((employee) => {
    const own = new Map(
      records.filter((r) => r.employeeId === employee.id).map((r) => [toDateKey(r.date), r] as const),
    );
    const resolved = resolveDays({
      days,
      today: todayIn(employee.location?.timezone ?? "UTC"),
      hireDate: toDateKey(employee.hireDate),
      records: own,
      leaveDays: leave.get(employee.id) ?? new Set(),
      holidays: holidaysByLocation.get(employee.locationId) ?? new Set(),
    });
    const count = (s: DayStatus) => resolved.filter((d) => d.status === s).length;
    return {
      employee,
      days: resolved,
      summary: {
        present: count("PRESENT") + count("REMOTE") + count("LATE") + count("HALF_DAY"),
        late: count("LATE"),
        remote: count("REMOTE"),
        absent: count("ABSENT"),
        onLeave: count("ON_LEAVE"),
        hours: Math.round(resolved.reduce((sum, d) => sum + (d.hours ?? 0), 0) * 10) / 10,
      },
    };
  });
}

/** Everyone in scope on one day. */
export async function dailyAttendance(user: CurrentUser, date: DateKey, departmentId?: string) {
  const employees = await employeesInScope(user, { departmentId });
  const ids = employees.map((e) => e.id);
  const [records, leave] = await Promise.all([
    db.attendanceRecord.findMany({ where: { employeeId: { in: ids }, date: fromDateKey(date) } }),
    approvedLeaveDays(ids, date, date),
  ]);
  const holidaysByLocation = new Map<string | null, Set<DateKey>>();
  for (const locationId of new Set(employees.map((e) => e.locationId))) {
    holidaysByLocation.set(locationId, await holidaySet(date, date, locationId));
  }
  return employees.map((employee) => {
    const record = records.find((r) => r.employeeId === employee.id);
    const [day] = resolveDays({
      days: [date],
      today: todayIn(employee.location?.timezone ?? "UTC"),
      hireDate: toDateKey(employee.hireDate),
      records: new Map(record ? [[date, record]] : []),
      leaveDays: leave.get(employee.id) ?? new Set(),
      holidays: holidaysByLocation.get(employee.locationId) ?? new Set(),
    });
    return { employee, day: day!, notes: record?.notes ?? null };
  });
}

export function canViewTeamAttendance(user: CurrentUser) {
  const scope = user.permissions["attendance:read"];
  return scope === "TEAM" || scope === "ALL";
}
