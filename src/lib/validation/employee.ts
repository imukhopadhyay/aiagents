import { z } from "zod";

import { ROLE_KEYS } from "@/lib/rbac/permissions";

import {
  dateKey,
  optionalDateKey,
  optionalEmail,
  optionalId,
  optionalText,
  requiredText,
} from "./common";

export const EMPLOYMENT_STATUSES = ["ACTIVE", "PROBATION", "ON_LEAVE", "SUSPENDED", "TERMINATED"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"] as const;
export const DOCUMENT_CATEGORIES = [
  "CONTRACT",
  "IDENTIFICATION",
  "PAYROLL",
  "CERTIFICATE",
  "PERFORMANCE",
  "OTHER",
] as const;

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+()\d\s.-]*$/, { error: "Use digits, spaces and + ( ) - only" })
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const employeeFields = {
  firstName: requiredText("First name", 100),
  lastName: requiredText("Last name", 100),
  workEmail: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email" })),
  personalEmail: optionalEmail,
  phone,
  dateOfBirth: optionalDateKey,
  address: optionalText(500),
  employeeNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .regex(/^[A-Z0-9-]*$/, { error: "Use letters, numbers and - only" })
    .optional()
    .transform((v) => (v ? v : null)),
  departmentId: optionalId,
  positionId: optionalId,
  locationId: optionalId,
  managerId: optionalId,
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).exclude(["TERMINATED"], {
    error: "Use offboarding to terminate an employee",
  }),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hireDate: dateKey("Hire date"),
};

export const createEmployeeSchema = z.object({
  ...employeeFields,
  createAccount: z.boolean().default(true),
  roles: z.array(z.enum(ROLE_KEYS)).default(["EMPLOYEE"]),
});
export type CreateEmployeeInput = z.input<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({ id: z.string().min(1), ...employeeFields });
export type UpdateEmployeeInput = z.input<typeof updateEmployeeSchema>;

export const profileSchema = z.object({
  id: z.string().min(1),
  phone,
  personalEmail: optionalEmail,
  address: optionalText(500),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const emergencyContactSchema = z.object({
  employeeId: z.string().min(1),
  id: z.string().optional(),
  name: requiredText("Name", 100),
  relationship: requiredText("Relationship", 50),
  phone: z.string().trim().min(1, { error: "Phone is required" }).max(30),
  email: optionalEmail,
  isPrimary: z.boolean().default(false),
});
export type EmergencyContactInput = z.input<typeof emergencyContactSchema>;

export const offboardSchema = z.object({
  id: z.string().min(1),
  terminationDate: dateKey("Last working day"),
  reason: optionalText(1000),
  reassignReportsToId: optionalId,
});
export type OffboardInput = z.input<typeof offboardSchema>;

export const fileUploadSchema = z.object({
  employeeId: z.string().min(1),
  file: z.instanceof(File, { error: "Choose a file" }),
});

export const documentUploadSchema = fileUploadSchema.extend({
  name: optionalText(200),
  category: z.enum(DOCUMENT_CATEGORIES).default("OTHER"),
});

/** Columns accepted by the CSV import, in template order. */
export const IMPORT_COLUMNS = [
  "first_name",
  "last_name",
  "work_email",
  "employee_number",
  "department_code",
  "position_code",
  "location",
  "manager_employee_number",
  "employment_type",
  "employment_status",
  "hire_date",
  "phone",
  "personal_email",
] as const;
