"use server";

import { idSchema, runAction, success } from "@/lib/action";
import {
  adjustBalance,
  cancelLeaveRequest,
  decideLeaveRequest,
  deleteHoliday,
  initializeYear,
  saveHoliday,
  saveLeaveType,
  submitLeaveRequest,
} from "@/lib/services/leave";
import { formatDays } from "@/lib/format";
import {
  balanceAdjustmentSchema,
  decisionSchema,
  holidaySchema,
  initializeYearSchema,
  leaveRequestSchema,
  leaveTypeSchema,
} from "@/lib/validation/time";

export async function submitLeaveRequestAction(input: unknown) {
  return runAction(leaveRequestSchema, input, async (data, user) => {
    const { days, status } = await submitLeaveRequest(user, data);
    return success(
      status === "APPROVED"
        ? `Leave booked (${formatDays(days)})`
        : `Request submitted for approval (${formatDays(days)})`,
    );
  });
}

export async function decideLeaveRequestAction(input: unknown) {
  return runAction(decisionSchema, input, async (data, user) => {
    const status = await decideLeaveRequest(user, data);
    return success(
      status === "REJECTED"
        ? "Request rejected"
        : status === "APPROVED"
          ? "Leave approved"
          : "Approved and sent to HR",
    );
  });
}

export async function cancelLeaveRequestAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    await cancelLeaveRequest(user, id);
    return success("Request cancelled");
  });
}

export async function saveLeaveTypeAction(input: unknown) {
  return runAction(leaveTypeSchema, input, async (data, user) => {
    await saveLeaveType(user, data);
    return success("Leave type saved");
  });
}

export async function saveHolidayAction(input: unknown) {
  return runAction(holidaySchema, input, async (data, user) => {
    await saveHoliday(user, data);
    return success("Holiday saved");
  });
}

export async function deleteHolidayAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    await deleteHoliday(user, id);
    return success("Holiday removed");
  });
}

export async function adjustBalanceAction(input: unknown) {
  return runAction(balanceAdjustmentSchema, input, async (data, user) => {
    await adjustBalance(user, data);
    return success("Balance updated");
  });
}

export async function initializeYearAction(input: unknown) {
  return runAction(initializeYearSchema, input, async (data, user) => {
    const count = await initializeYear(user, data);
    return success(
      count
        ? `Created ${count} balance(s) for ${data.year}`
        : `Balances for ${data.year} already exist`,
    );
  });
}
