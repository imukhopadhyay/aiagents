import { type DateKey, eachDay, isWeekend } from "./dates";

export interface LeaveSpan {
  start: DateKey;
  end: DateKey;
  /** Leave starts at midday on the first day. */
  startHalfDay?: boolean;
  /** Leave ends at midday on the last day. */
  endHalfDay?: boolean;
}

export function isWorkingDay(day: DateKey, holidays: ReadonlySet<DateKey>): boolean {
  return !isWeekend(day) && !holidays.has(day);
}

/**
 * Working days a request consumes: weekends and holidays are free, and each
 * half-day flag on a working day saves half a day. A single-day request with
 * either flag set costs half a day.
 */
export function countLeaveDays(span: LeaveSpan, holidays: ReadonlySet<DateKey>): number {
  if (span.end < span.start) return 0;
  const working = eachDay(span.start, span.end).filter((d) => isWorkingDay(d, holidays));
  if (working.length === 0) return 0;

  if (span.start === span.end) {
    return span.startHalfDay || span.endHalfDay ? 0.5 : 1;
  }

  let days = working.length;
  if (span.startHalfDay && isWorkingDay(span.start, holidays)) days -= 0.5;
  if (span.endHalfDay && isWorkingDay(span.end, holidays)) days -= 0.5;
  return days;
}

export interface BalanceLike {
  allocated: number;
  carriedOver: number;
  used: number;
}

/** Days still bookable once approved usage and pending requests are counted. */
export function availableDays(balance: BalanceLike, pendingDays: number): number {
  return balance.allocated + balance.carriedOver - balance.used - pendingDays;
}

export type LeaveStatus = "PENDING" | "MANAGER_APPROVED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveDecision = "approve" | "reject";

/**
 * Two-stage approval. A manager (team scope) moves PENDING to
 * MANAGER_APPROVED; HR (org-wide scope) gives the final approval from either
 * open state. Either can reject an open request.
 */
export function nextLeaveStatus(
  current: LeaveStatus,
  decision: LeaveDecision,
  approver: "manager" | "hr",
): LeaveStatus | null {
  const open = current === "PENDING" || current === "MANAGER_APPROVED";
  if (!open) return null;
  if (decision === "reject") return "REJECTED";
  if (approver === "hr") return "APPROVED";
  return current === "PENDING" ? "MANAGER_APPROVED" : null;
}

/** Status a new request starts in. */
export function initialLeaveStatus(opts: {
  requiresApproval: boolean;
  hasManager: boolean;
}): LeaveStatus {
  if (!opts.requiresApproval) return "APPROVED";
  return opts.hasManager ? "PENDING" : "MANAGER_APPROVED";
}

export function isCancellable(status: LeaveStatus, start: DateKey, today: DateKey): boolean {
  if (status === "PENDING" || status === "MANAGER_APPROVED") return true;
  return status === "APPROVED" && start > today;
}
