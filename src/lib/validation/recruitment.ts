import { z } from "zod";

import { EMPLOYMENT_TYPES } from "./employee";
import { dateKey, optionalDateKey, optionalId, optionalText, requiredText } from "./common";

export const JOB_STATUSES = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED", "FILLED"] as const;
export const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
export const INTERVIEW_TYPES = ["PHONE", "VIDEO", "ONSITE", "TECHNICAL", "HR"] as const;
export const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export const RECOMMENDATIONS = ["strong_yes", "yes", "no", "strong_no"] as const;
export const OFFER_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"] as const;

export const jobSchema = z.object({
  id: z.string().optional(),
  title: requiredText("Title", 150),
  description: requiredText("Description", 10_000),
  requirements: optionalText(10_000),
  departmentId: optionalId,
  positionId: optionalId,
  locationId: optionalId,
  hiringManagerId: optionalId,
  employmentType: z.enum(EMPLOYMENT_TYPES),
  headcount: z.number({ error: "Enter a number" }).int().min(1).max(100),
});
export type JobInput = z.input<typeof jobSchema>;

export const jobStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["DRAFT", "OPEN", "ON_HOLD", "CLOSED"]),
});

const url = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), { error: "Enter a full URL starting with https://" });

export const candidateSchema = z.object({
  id: z.string().optional(),
  firstName: requiredText("First name", 100),
  lastName: requiredText("Last name", 100),
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email" })),
  phone: optionalText(30),
  linkedinUrl: url,
  source: optionalText(100),
  /** Comma-separated in the form. */
  tags: z
    .string()
    .optional()
    .transform((v) =>
      [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
    ),
  notes: optionalText(10_000),
  jobOpeningId: optionalId,
});
export type CandidateInput = z.input<typeof candidateSchema>;

export const applySchema = z.object({
  candidateId: z.string().min(1),
  jobOpeningId: z.string().min(1, { error: "Choose a job" }),
});

export const moveStageSchema = z.object({
  applicationId: z.string().min(1),
  stage: z.enum(STAGES),
  rejectionReason: optionalText(500),
});

export const interviewSchema = z.object({
  applicationId: z.string().min(1),
  type: z.enum(INTERVIEW_TYPES),
  date: dateKey(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Use HH:MM" }),
  durationMinutes: z.number().int().min(15).max(480),
  location: optionalText(300),
  interviewerIds: z.array(z.string()).min(1, { error: "Choose at least one interviewer" }).max(10),
});
export type InterviewInput = z.input<typeof interviewSchema>;

export const interviewStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(INTERVIEW_STATUSES),
});

export const feedbackSchema = z.object({
  interviewId: z.string().min(1),
  rating: z.number({ error: "Choose a rating" }).int().min(1).max(5),
  recommendation: z.enum(RECOMMENDATIONS),
  strengths: optionalText(5000),
  concerns: optionalText(5000),
  notes: optionalText(5000),
});
export type FeedbackInput = z.input<typeof feedbackSchema>;

export const offerSchema = z.object({
  applicationId: z.string().min(1),
  salary: z.number({ error: "Enter a salary" }).min(0).max(100_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { error: "Use a 3-letter currency code" }),
  startDate: dateKey("Start date"),
  expiresAt: optionalDateKey,
  notes: optionalText(5000),
});
export type OfferInput = z.input<typeof offerSchema>;

export const offerStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["SENT", "ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"]),
});

export const hireSchema = z.object({
  applicationId: z.string().min(1),
  createAccount: z.boolean().default(true),
});

export const resumeUploadSchema = z.object({
  candidateId: z.string().min(1),
  file: z.instanceof(File, { error: "Choose a file" }),
});
