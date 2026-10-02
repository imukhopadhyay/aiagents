import "server-only";

import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fromDateKey, todayIn, toDateKey } from "@/lib/domain/dates";
import {
  accruedDays,
  availableDays,
  carryOver,
  countLeaveDays,
  initialLeaveStatus,
  isCancellable,
  type LeaveStatus,
  nextLeaveStatus,
} from "@/lib/domain/leave";
import { DomainError, NotFoundError } from "@/lib/errors";
import { formatDate, formatDays } from "@/lib/format";
import { AuthorizationError, can } from "@/lib/rbac/authorize";
import type {
  balanceAdjustmentSchema,
  decisionSchema,
  holidaySchema,
  initializeYearSchema,
  leaveRequestSchema,
  leaveTypeSchema,
} from "@/lib/validation/time";

import { employeeAccessWhere } from "./employees";
import { notifyEmployees, notifyUsers, usersWithOrgWidePermission } from "./notifications";
import { holidaySet, requireOwnEmployee } from "./time-common";

const OPEN_STATUSES: LeaveStatus[] = ["PENDING", "MANAGER_APPROVED"];
const ACTIVE_STATUSES: LeaveStatus[] = ["PENDING", "MANAGER_APPROVED", "APPROVED"];

function assertManage(user: CurrentUser) {
  if (!can(user, "leave:manage")) throw new AuthorizationError("leave:manage");
}

export function canViewTeamLeave(user: CurrentUser) {
  const scope = user.permissions["leave:read"];
  return scope === "TEAM" || scope === "ALL";
}

// ─── Balances ────────────────────────────────────────────────────────────────

export interface BalanceSummary {
  leaveTypeId: string;
  name: string;
  code: string;
  accrualPeriod: string;
  allocated: number;
  accrued: number;
  carriedOver: number;
  used: number;
  pending: number;
  available: number;
}

/** Balances for every active leave type with an allowance, for one employee and year. */
export async function getBalances(
  employeeId: string,
  year: number,
  asOfMonth?: number,
): Promise<BalanceSummary[]> {
  const [types, balances, pending] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.leaveBalance.findMany({ where: { employeeId, year } }),
    db.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: {
        employeeId,
        status: { in: OPEN_STATUSES },
        startDate: { gte: fromDateKey(`${year}-01-01`), lte: fromDateKey(`${year}-12-31`) },
      },
      _sum: { days: true },
    }),
  ]);
  const month =
    asOfMonth ?? (new Date().getUTCFullYear() === year ? new Date().getUTCMonth() + 1 : 12);

  return types
    .filter((t) => Number(t.annualAllowance) > 0 || balances.some((b) => b.leaveTypeId === t.id))
    .map((type) => {
      const balance = balances.find((b) => b.leaveTypeId === type.id);
      const allocated = Number(balance?.allocated ?? 0);
      const carriedOver = Number(balance?.carriedOver ?? 0);
      const used = Number(balance?.used ?? 0);
      const pendingDays = Number(pending.find((p) => p.leaveTypeId === type.id)?._sum.days ?? 0);
      const accrued = accruedDays(allocated, type.accrualPeriod, month);
      return {
        leaveTypeId: type.id,
        name: type.name,
        code: type.code,
        accrualPeriod: type.accrualPeriod,
        allocated,
        accrued,
        carriedOver,
        used,
        pending: pendingDays,
        available: availableDays({ allocated: accrued, carriedOver, used }, pendingDays),
      };
    });
}

async function adjustUsed(
  tx: Prisma.TransactionClient,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  delta: number,
) {
  await tx.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    update: { used: { increment: delta } },
    create: { employeeId, leaveTypeId, year, used: delta },
  });
}

// ─── Requests ────────────────────────────────────────────────────────────────

export async function submitLeaveRequest(
  user: CurrentUser,
  input: z.output<typeof leaveRequestSchema>,
) {
  const employee = await requireOwnEmployee(user.employeeId);
  if (!can(user, "leave:request", { employeeId: employee.id }))
    throw new AuthorizationError("leave:request");

  const type = await db.leaveType.findFirst({ where: { id: input.leaveTypeId, isActive: true } });
  if (!type) throw new DomainError("Choose an active leave type.", "leaveTypeId");
  if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
    throw new DomainError("Split requests that span two calendar years.", "endDate");
  }

  const holidays = await holidaySet(input.startDate, input.endDate, employee.locationId);
  const days = countLeaveDays(
    {
      start: input.startDate,
      end: input.endDate,
      startHalfDay: input.startHalfDay,
      endHalfDay: input.endHalfDay,
    },
    holidays,
  );
  if (days <= 0)
    throw new DomainError("The selected dates are all weekends or holidays.", "startDate");

  const overlapping = await db.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ACTIVE_STATUSES },
      startDate: { lte: fromDateKey(input.endDate) },
      endDate: { gte: fromDateKey(input.startDate) },
    },
  });
  if (overlapping) {
    throw new DomainError(
      `This overlaps your ${overlapping.status === "APPROVED" ? "approved" : "pending"} leave from ${formatDate(overlapping.startDate)} to ${formatDate(overlapping.endDate)}.`,
      "startDate",
    );
  }

  const year = Number(input.startDate.slice(0, 4));
  if (Number(type.annualAllowance) > 0) {
    const month = Number(input.endDate.slice(5, 7));
    const balance = (await getBalances(employee.id, year, month)).find(
      (b) => b.leaveTypeId === type.id,
    );
    const available = balance?.available ?? 0;
    if (days > available) {
      throw new DomainError(
        `This needs ${formatDays(days)} but only ${formatDays(available)} of ${type.name} ${type.accrualPeriod === "MONTHLY" ? "will have accrued" : "is available"}.`,
        "leaveTypeId",
      );
    }
  }

  const status = initialLeaveStatus({
    requiresApproval: type.requiresApproval,
    hasManager: Boolean(employee.managerId),
  });
  const request = await db.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: type.id,
        startDate: fromDateKey(input.startDate),
        endDate: fromDateKey(input.endDate),
        startHalfDay: input.startHalfDay,
        endHalfDay: input.endHalfDay,
        days,
        reason: input.reason,
        status,
        ...(status === "APPROVED"
          ? { decidedAt: new Date(), decisionComment: "Approval not required" }
          : {}),
      },
    });
    if (status === "APPROVED") await adjustUsed(tx, employee.id, type.id, year, days);
    return created;
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "LeaveRequest",
    entityId: request.id,
    changes: { type: type.code, start: input.startDate, end: input.endDate, days, status },
  });

  const who = `${employee.firstName} ${employee.lastName}`;
  const summary = `${type.name}, ${formatDate(input.startDate)} – ${formatDate(input.endDate)} (${formatDays(days)})`;
  if (status === "PENDING") {
    await notifyEmployees([employee.managerId], {
      type: "leave.submitted",
      title: `${who} requested leave`,
      body: summary,
      link: "/approvals",
    });
  } else if (status === "MANAGER_APPROVED") {
    await notifyUsers(await usersWithOrgWidePermission("leave:approve"), {
      type: "leave.submitted",
      title: `${who} requested leave`,
      body: summary,
      link: "/approvals",
    });
  }
  return { request, days, status };
}

export async function decideLeaveRequest(
  user: CurrentUser,
  input: z.output<typeof decisionSchema>,
) {
  const request = await db.leaveRequest.findUnique({
    where: { id: input.id },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!request) throw new NotFoundError("Leave request");
  if (!can(user, "leave:approve", { employeeId: request.employeeId }))
    throw new AuthorizationError("leave:approve");
  if (request.employeeId === user.employeeId)
    throw new DomainError("You can't approve your own leave.");

  const approverLevel = user.permissions["leave:approve"] === "ALL" ? "hr" : "manager";
  const next = nextLeaveStatus(request.status, input.decision, approverLevel);
  if (!next) {
    throw new DomainError(
      request.status === "MANAGER_APPROVED"
        ? "This request is waiting for HR approval."
        : "This request has already been decided.",
    );
  }

  const now = new Date();
  const stage =
    approverLevel === "manager"
      ? { managerApproverId: user.employeeId, managerComment: input.comment, managerDecidedAt: now }
      : { approverId: user.employeeId, decisionComment: input.comment, decidedAt: now };

  await db.$transaction(async (tx) => {
    // Guard against a concurrent decision on the same request.
    const { count } = await tx.leaveRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: { status: next, ...stage },
    });
    if (count === 0)
      throw new DomainError(
        "This request was just updated by someone else. Refresh and try again.",
      );
    if (next === "APPROVED") {
      await adjustUsed(
        tx,
        request.employeeId,
        request.leaveTypeId,
        request.startDate.getUTCFullYear(),
        Number(request.days),
      );
    }
  });

  await recordAudit({
    actorId: user.id,
    action: input.decision === "approve" ? "APPROVE" : "REJECT",
    entity: "LeaveRequest",
    entityId: request.id,
    changes: { from: request.status, to: next, comment: input.comment },
  });

  const summary = `${request.leaveType.name}, ${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;
  const outcome =
    next === "REJECTED"
      ? "rejected"
      : next === "APPROVED"
        ? "approved"
        : "approved by your manager";
  await notifyEmployees([request.employeeId], {
    type: `leave.${next.toLowerCase()}`,
    title: `Your leave was ${outcome}`,
    body: input.comment ? `${summary} — “${input.comment}”` : summary,
    link: "/leave",
  });
  if (next === "MANAGER_APPROVED") {
    await notifyUsers(await usersWithOrgWidePermission("leave:approve"), {
      type: "leave.manager_approved",
      title: `Leave for ${request.employee.firstName} ${request.employee.lastName} needs HR approval`,
      body: summary,
      link: "/approvals",
    });
  }
  return next;
}

export async function cancelLeaveRequest(user: CurrentUser, id: string) {
  const request = await db.leaveRequest.findUnique({
    where: { id },
    include: { employee: { include: { location: { select: { timezone: true } } } } },
  });
  if (!request) throw new NotFoundError("Leave request");
  const own =
    request.employeeId === user.employeeId &&
    can(user, "leave:request", { employeeId: request.employeeId });
  if (!own && !can(user, "leave:manage")) throw new AuthorizationError("leave:request");

  const today = todayIn(request.employee.location?.timezone ?? "UTC");
  if (!isCancellable(request.status, toDateKey(request.startDate), today)) {
    throw new DomainError(
      "Only open requests or approved leave that hasn't started can be cancelled.",
    );
  }

  await db.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, status: request.status },
      data: { status: "CANCELLED" },
    });
    if (count === 0) throw new DomainError("This request was just updated. Refresh and try again.");
    if (request.status === "APPROVED") {
      await adjustUsed(
        tx,
        request.employeeId,
        request.leaveTypeId,
        request.startDate.getUTCFullYear(),
        -Number(request.days),
      );
    }
  });
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entity: "LeaveRequest",
    entityId: id,
    changes: { from: request.status, to: "CANCELLED" },
  });
}

/** Open requests the user can act on right now. */
export async function pendingLeaveApprovals(user: CurrentUser) {
  const scope = user.permissions["leave:approve"];
  if (!scope) return [];
  // Managers act on PENDING (stage 1); HR can act on either open stage.
  const statuses: LeaveStatus[] = scope === "ALL" ? OPEN_STATUSES : ["PENDING"];
  return db.leaveRequest.findMany({
    where: {
      status: { in: statuses },
      employee: { ...employeeAccessWhere(user, "leave:approve"), deletedAt: null },
      ...(user.employeeId ? { employeeId: { not: user.employeeId } } : {}),
    },
    orderBy: { startDate: "asc" },
    include: {
      leaveType: { select: { name: true } },
      employee: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      managerApprover: { select: { firstName: true, lastName: true } },
    },
  });
}

// ─── Settings: types, holidays, balances ─────────────────────────────────────

export async function saveLeaveType(user: CurrentUser, input: z.output<typeof leaveTypeSchema>) {
  assertManage(user);
  const { id, ...data } = input;
  const type = id
    ? await db.leaveType.update({ where: { id }, data })
    : await db.leaveType.create({ data });
  await recordAudit({
    actorId: user.id,
    action: id ? "UPDATE" : "CREATE",
    entity: "LeaveType",
    entityId: type.id,
    changes: { after: data },
  });
}

export async function saveHoliday(user: CurrentUser, input: z.output<typeof holidaySchema>) {
  assertManage(user);
  const { id, date, ...rest } = input;
  const data = { ...rest, date: fromDateKey(date) };
  const holiday = id
    ? await db.holiday.update({ where: { id }, data })
    : await db.holiday.create({ data });
  await recordAudit({
    actorId: user.id,
    action: id ? "UPDATE" : "CREATE",
    entity: "Holiday",
    entityId: holiday.id,
    changes: { name: input.name, date },
  });
}

export async function deleteHoliday(user: CurrentUser, id: string) {
  assertManage(user);
  const holiday = await db.holiday.delete({ where: { id } });
  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    entity: "Holiday",
    entityId: id,
    changes: { name: holiday.name },
  });
}

export async function adjustBalance(
  user: CurrentUser,
  input: z.output<typeof balanceAdjustmentSchema>,
) {
  assertManage(user);
  const { employeeId, leaveTypeId, year, allocated, carriedOver, note } = input;
  const before = await db.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
  });
  await db.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    update: { allocated, carriedOver },
    create: { employeeId, leaveTypeId, year, allocated, carriedOver },
  });
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entity: "LeaveBalance",
    entityId: employeeId,
    changes: {
      leaveTypeId,
      year,
      before: before
        ? { allocated: Number(before.allocated), carriedOver: Number(before.carriedOver) }
        : null,
      after: { allocated, carriedOver },
      note,
    },
  });
}

/**
 * Create balances for a new year for every current employee: the full
 * allowance plus capped carry-over from the previous year. Existing balances
 * are left untouched, so this is safe to run more than once.
 */
export async function initializeYear(
  user: CurrentUser,
  input: z.output<typeof initializeYearSchema>,
) {
  assertManage(user);
  const [types, employees, previous] = await Promise.all([
    db.leaveType.findMany({ where: { isActive: true, annualAllowance: { gt: 0 } } }),
    db.employee.findMany({
      where: { deletedAt: null, employmentStatus: { not: "TERMINATED" } },
      select: { id: true },
    }),
    db.leaveBalance.findMany({ where: { year: input.year - 1 } }),
  ]);
  const prev = new Map(previous.map((b) => [`${b.employeeId}:${b.leaveTypeId}`, b]));

  const data = employees.flatMap((e) =>
    types.map((t) => {
      const last = prev.get(`${e.id}:${t.id}`);
      return {
        employeeId: e.id,
        leaveTypeId: t.id,
        year: input.year,
        allocated: t.annualAllowance,
        carriedOver: last
          ? carryOver(
              {
                allocated: Number(last.allocated),
                carriedOver: Number(last.carriedOver),
                used: Number(last.used),
              },
              Number(t.maxCarryOver),
            )
          : 0,
      };
    }),
  );
  const { count } = await db.leaveBalance.createMany({ data, skipDuplicates: true });
  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "LeaveBalance",
    changes: { initializedYear: input.year, created: count },
  });
  return count;
}
