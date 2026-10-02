import { z } from "zod";

import { code, dateKey, optionalId, optionalText, requiredText } from "./common";

const time = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), { error: "Use HH:MM" });

const days = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .min(0)
    .max(365)
    .refine((n) => Number.isInteger(n * 2), { error: "Use whole or half days" });

// ─── Leave ───────────────────────────────────────────────────────────────────

export const leaveRequestSchema = z
  .object({
    leaveTypeId: z.string().min(1, { error: "Choose a leave type" }),
    startDate: dateKey("Start date"),
    endDate: dateKey("End date"),
    startHalfDay: z.boolean().default(false),
    endHalfDay: z.boolean().default(false),
    reason: optionalText(1000),
  })
  .refine((v) => v.endDate >= v.startDate, {
    error: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type LeaveRequestInput = z.input<typeof leaveRequestSchema>;

export const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  comment: optionalText(1000),
});
export type DecisionInput = z.input<typeof decisionSchema>;

export const ACCRUAL_PERIODS = ["NONE", "MONTHLY", "YEARLY"] as const;

export const leaveTypeSchema = z.object({
  id: z.string().optional(),
  name: requiredText("Name", 100),
  code,
  description: optionalText(500),
  annualAllowance: days("Allowance"),
  accrualPeriod: z.enum(ACCRUAL_PERIODS),
  maxCarryOver: days("Carry-over"),
  isPaid: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type LeaveTypeInput = z.input<typeof leaveTypeSchema>;

export const holidaySchema = z.object({
  id: z.string().optional(),
  name: requiredText("Name", 100),
  date: dateKey(),
  locationId: optionalId,
});
export type HolidayInput = z.input<typeof holidaySchema>;

export const balanceAdjustmentSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  allocated: days("Allocation"),
  carriedOver: days("Carry-over"),
  note: optionalText(500),
});
export type BalanceAdjustmentInput = z.input<typeof balanceAdjustmentSchema>;

export const initializeYearSchema = z.object({ year: z.number().int().min(2000).max(2100) });

// ─── Attendance ──────────────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "REMOTE",
  "ON_LEAVE",
] as const;

export const clockInSchema = z.object({ remote: z.boolean().default(false) });

export const correctionSchema = z
  .object({
    date: dateKey(),
    clockIn: time,
    clockOut: time,
    status: z.enum(ATTENDANCE_STATUSES),
    reason: requiredText("Reason", 1000),
  })
  .refine((v) => !v.clockIn || !v.clockOut || v.clockOut > v.clockIn, {
    error: "Clock-out must be after clock-in",
    path: ["clockOut"],
  });
export type CorrectionInput = z.input<typeof correctionSchema>;
