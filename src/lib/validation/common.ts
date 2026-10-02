import { z } from "zod";

import { isDateKey } from "@/lib/domain/dates";

/** Optional text input: trims, and turns "" into null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, { error: `${label} is required` }).max(max);

/** Optional id from a select: "" → null. */
export const optionalId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const dateKey = (label = "Date") =>
  z.string().refine(isDateKey, { error: `${label} must be a valid date` });

export const optionalDateKey = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isDateKey(v), { error: "Enter a valid date" });

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, { error: "Enter a valid email" });

export const code = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, { error: "Code is required" })
  .max(20)
  .regex(/^[A-Z0-9_-]+$/, { error: "Use letters, numbers, - and _ only" });
