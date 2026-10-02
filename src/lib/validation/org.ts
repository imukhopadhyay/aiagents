import { z } from "zod";

import { code, optionalId, optionalText, requiredText } from "./common";

export const departmentSchema = z.object({
  name: requiredText("Name", 100),
  code,
  description: optionalText(1000),
  parentId: optionalId,
  headId: optionalId,
});
export type DepartmentInput = z.input<typeof departmentSchema>;

export const updateDepartmentSchema = departmentSchema.extend({ id: z.string().min(1) });

export const archiveDepartmentSchema = z.object({
  id: z.string().min(1),
  reassignToId: optionalId,
});

export const positionSchema = z.object({
  title: requiredText("Title", 100),
  code,
  description: optionalText(1000),
  level: z
    .union([z.number().int().min(1).max(20), z.nan()])
    .optional()
    .nullable()
    .transform((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null)),
  departmentId: optionalId,
});
export type PositionInput = z.input<typeof positionSchema>;

export const updatePositionSchema = positionSchema.extend({ id: z.string().min(1) });
