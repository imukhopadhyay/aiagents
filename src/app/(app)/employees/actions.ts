"use server";

import { z } from "zod";

import { idSchema, runAction, success } from "@/lib/action";
import { appBaseUrl } from "@/lib/app-url";
import { sendInvite } from "@/lib/auth/password-reset";
import { db } from "@/lib/db";
import { parseCsvRecords } from "@/lib/domain/csv";
import { DomainError, NotFoundError } from "@/lib/errors";
import { AuthorizationError, can } from "@/lib/rbac/authorize";
import {
  archiveEmployee,
  createEmployee,
  deleteDocument,
  deleteEmergencyContact,
  importEmployees,
  offboardEmployee,
  previewImport,
  saveEmergencyContact,
  updateEmployee,
  updateProfile,
  uploadDocument,
  uploadPhoto,
} from "@/lib/services/employees";
import {
  IMPORT_COLUMNS,
  createEmployeeSchema,
  documentUploadSchema,
  emergencyContactSchema,
  fileUploadSchema,
  offboardSchema,
  profileSchema,
  updateEmployeeSchema,
} from "@/lib/validation/employee";

export async function createEmployeeAction(input: unknown) {
  return runAction(createEmployeeSchema, input, async (data, user) => {
    const employee = await createEmployee(user, data);
    return success(
      employee.userId ? "Employee created and invitation sent" : "Employee created",
      { id: employee.id },
    );
  });
}

export async function updateEmployeeAction(input: unknown) {
  return runAction(updateEmployeeSchema, input, async (data, user) => {
    await updateEmployee(user, data);
    return success("Employee updated", { id: data.id });
  });
}

export async function updateProfileAction(input: unknown) {
  return runAction(profileSchema, input, async (data, user) => {
    await updateProfile(user, data);
    return success("Profile updated");
  });
}

export async function saveEmergencyContactAction(input: unknown) {
  return runAction(emergencyContactSchema, input, async (data, user) => {
    await saveEmergencyContact(user, data);
    return success("Emergency contact saved");
  });
}

export async function deleteEmergencyContactAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    await deleteEmergencyContact(user, id);
    return success("Emergency contact removed");
  });
}

export async function uploadPhotoAction(formData: FormData) {
  return runAction(
    fileUploadSchema,
    { employeeId: formData.get("employeeId"), file: formData.get("file") },
    async (data, user) => {
      await uploadPhoto(user, data);
      return success("Photo updated");
    },
  );
}

export async function uploadDocumentAction(formData: FormData) {
  return runAction(
    documentUploadSchema,
    {
      employeeId: formData.get("employeeId"),
      file: formData.get("file"),
      name: formData.get("name") ?? undefined,
      category: formData.get("category") || undefined,
    },
    async (data, user) => {
      await uploadDocument(user, data);
      return success("Document uploaded");
    },
  );
}

export async function deleteDocumentAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    await deleteDocument(user, id);
    return success("Document deleted");
  });
}

export async function offboardEmployeeAction(input: unknown) {
  return runAction(offboardSchema, input, async (data, user) => {
    await offboardEmployee(user, data);
    return success("Employee offboarded");
  });
}

export async function archiveEmployeeAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    await archiveEmployee(user, id);
    return success("Employee record archived");
  });
}

export async function resendInviteAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    if (!can(user, "employee:update", { employeeId: id })) throw new AuthorizationError("employee:update");
    const employee = await db.employee.findFirst({ where: { id, deletedAt: null }, include: { user: true } });
    if (!employee?.user) throw new NotFoundError("User account");
    if (employee.user.passwordHash) throw new DomainError("This employee has already set a password.");
    if (!employee.user.isActive) throw new DomainError("This account is deactivated.");
    await sendInvite(employee.user, await appBaseUrl());
    return success("Invitation sent");
  });
}

const csvUpload = z.object({
  file: z
    .instanceof(File, { error: "Choose a CSV file" })
    .refine((f) => f.size > 0, { error: "The file is empty" })
    .refine((f) => f.size <= 2 * 1024 * 1024, { error: "The file must be under 2 MB" }),
});

async function readRecords(file: File) {
  const { headers, records } = parseCsvRecords(await file.text());
  const missing = ["first_name", "last_name", "work_email", "hire_date"].filter((c) => !headers.includes(c));
  if (missing.length) throw new DomainError(`Missing required column(s): ${missing.join(", ")}.`, "file");
  const unknown = headers.filter((h) => !(IMPORT_COLUMNS as readonly string[]).includes(h));
  if (unknown.length) throw new DomainError(`Unknown column(s): ${unknown.join(", ")}.`, "file");
  return records;
}

export async function previewImportAction(formData: FormData) {
  return runAction(csvUpload, { file: formData.get("file") }, async ({ file }, user) =>
    previewImport(user, await readRecords(file)),
  );
}

export async function importEmployeesAction(formData: FormData) {
  return runAction(csvUpload, { file: formData.get("file") }, async ({ file }, user) => {
    const count = await importEmployees(user, await readRecords(file));
    return success(`Imported ${count} employee${count === 1 ? "" : "s"}`, { count });
  });
}
