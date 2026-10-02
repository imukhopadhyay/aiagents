import "server-only";

import type { z } from "zod";

import type { EmploymentStatus, EmploymentType, Prisma } from "@/generated/prisma/client";
import { appBaseUrl } from "@/lib/app-url";
import type { CurrentUser } from "@/lib/auth/session";
import { sendInvite } from "@/lib/auth/password-reset";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fromDateKey, isDateKey } from "@/lib/domain/dates";
import { wouldCreateCycle } from "@/lib/domain/org";
import { DomainError, NotFoundError } from "@/lib/errors";
import { AuthorizationError, can, employeeScopeFilter } from "@/lib/rbac/authorize";
import type { Permission, RoleKey } from "@/lib/rbac/permissions";
import { deleteStoredFile, fileUrl, saveFile } from "@/lib/storage";
import {
  type createEmployeeSchema,
  type documentUploadSchema,
  type emergencyContactSchema,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  type fileUploadSchema,
  type offboardSchema,
  type profileSchema,
  type updateEmployeeSchema,
} from "@/lib/validation/employee";

import { diff } from "./audit-diff";

// ─── Access helpers ──────────────────────────────────────────────────────────

/** Prisma filter limiting employees to those the user may access under `permission`. */
export function employeeAccessWhere(
  user: CurrentUser,
  permission: Permission,
): Prisma.EmployeeWhereInput {
  const filter = employeeScopeFilter(user, permission);
  if (filter.kind === "all") return {};
  if (filter.kind === "employees") return { id: { in: filter.ids } };
  return { id: { in: [] } };
}

function assertCan(user: CurrentUser, permission: Permission, employeeId?: string) {
  if (!can(user, permission, employeeId === undefined ? undefined : { employeeId })) {
    throw new AuthorizationError(permission);
  }
}

/** Self-service edits are allowed with profile:update or employee:update. */
function assertCanEditProfile(user: CurrentUser, employeeId: string) {
  if (can(user, "profile:update", { employeeId }) || can(user, "employee:update", { employeeId }))
    return;
  throw new AuthorizationError("profile:update");
}

async function findActive(id: string) {
  const employee = await db.employee.findFirst({ where: { id, deletedAt: null } });
  if (!employee) throw new NotFoundError("Employee");
  return employee;
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export const EMPLOYEE_SORTS = ["name", "number", "department", "hireDate", "status"] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];

export interface EmployeeFilters {
  q?: string;
  departmentId?: string;
  locationId?: string;
  /** A status, "current" (everyone not terminated) or "all". */
  status?: string;
}

export function employeeListWhere(
  user: CurrentUser,
  filters: EmployeeFilters,
): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput[] = [
    { deletedAt: null },
    employeeAccessWhere(user, "employee:read"),
  ];
  const q = filters.q?.trim();
  if (q) {
    const terms = q.split(/\s+/).slice(0, 4);
    for (const term of terms) {
      where.push({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { workEmail: { contains: term, mode: "insensitive" } },
          { employeeNumber: { contains: term, mode: "insensitive" } },
        ],
      });
    }
  }
  if (filters.departmentId) where.push({ departmentId: filters.departmentId });
  if (filters.locationId) where.push({ locationId: filters.locationId });
  const status = filters.status ?? "current";
  if (status === "current") where.push({ employmentStatus: { not: "TERMINATED" } });
  else if ((EMPLOYMENT_STATUSES as readonly string[]).includes(status)) {
    where.push({ employmentStatus: status as EmploymentStatus });
  }
  return { AND: where };
}

function orderBy(
  sort: EmployeeSort,
  dir: "asc" | "desc",
): Prisma.EmployeeOrderByWithRelationInput[] {
  switch (sort) {
    case "number":
      return [{ employeeNumber: dir }];
    case "department":
      return [{ department: { name: dir } }, { lastName: "asc" }];
    case "hireDate":
      return [{ hireDate: dir }, { lastName: "asc" }];
    case "status":
      return [{ employmentStatus: dir }, { lastName: "asc" }];
    default:
      return [{ lastName: dir }, { firstName: dir }];
  }
}

export async function listEmployees(
  user: CurrentUser,
  params: EmployeeFilters & {
    sort: EmployeeSort;
    dir: "asc" | "desc";
    page: number;
    pageSize: number;
  },
) {
  const where = employeeListWhere(user, params);
  const [rows, total] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        department: { select: { name: true } },
        position: { select: { title: true } },
        location: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    }),
    db.employee.count({ where }),
  ]);
  return { rows, total };
}

// ─── Create / update ─────────────────────────────────────────────────────────

async function nextEmployeeNumber(tx: Prisma.TransactionClient = db): Promise<string> {
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("employeeNumber" FROM 2) AS INTEGER)) AS max
    FROM employees WHERE "employeeNumber" ~ '^E[0-9]+$'`;
  const next = (rows[0]?.max ?? 0) + 1;
  return `E${String(next).padStart(4, "0")}`;
}

async function assertReferences(input: {
  departmentId: string | null;
  positionId: string | null;
  locationId: string | null;
  managerId: string | null;
}) {
  const [department, position, location, manager] = await Promise.all([
    input.departmentId
      ? db.department.findFirst({ where: { id: input.departmentId, deletedAt: null } })
      : true,
    input.positionId
      ? db.position.findFirst({ where: { id: input.positionId, deletedAt: null } })
      : true,
    input.locationId
      ? db.location.findFirst({ where: { id: input.locationId, deletedAt: null } })
      : true,
    input.managerId
      ? db.employee.findFirst({
          where: { id: input.managerId, deletedAt: null, employmentStatus: { not: "TERMINATED" } },
        })
      : true,
  ]);
  if (!department) throw new DomainError("Department not found.", "departmentId");
  if (!position) throw new DomainError("Position not found.", "positionId");
  if (!location) throw new DomainError("Location not found.", "locationId");
  if (!manager) throw new DomainError("Choose an active employee as manager.", "managerId");
}

async function assertNoReportingCycle(employeeId: string, managerId: string | null) {
  if (!managerId) return;
  const rows = await db.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, managerId: true },
  });
  const parentOf = new Map(rows.map((r) => [r.id, r.managerId]));
  if (wouldCreateCycle(employeeId, managerId, parentOf)) {
    throw new DomainError(
      "An employee can't report to themselves or to someone in their own reporting line.",
      "managerId",
    );
  }
}

export async function createEmployee(
  user: CurrentUser,
  input: z.output<typeof createEmployeeSchema>,
) {
  assertCan(user, "employee:create");
  await assertReferences(input);

  // Only account administrators may grant roles beyond EMPLOYEE.
  const roles: RoleKey[] = can(user, "user:manage") ? input.roles : ["EMPLOYEE"];
  if (input.createAccount) {
    if (await db.user.findUnique({ where: { email: input.workEmail } })) {
      throw new DomainError("A user account with this email already exists.", "workEmail");
    }
  }

  const { createAccount, roles: _roles, dateOfBirth, hireDate, employeeNumber, ...fields } = input;
  void _roles;

  const employee = await db.$transaction(async (tx) => {
    let userId: string | null = null;
    if (createAccount) {
      const roleRows = await tx.role.findMany({ where: { key: { in: roles } } });
      const account = await tx.user.create({
        data: {
          email: input.workEmail,
          name: `${input.firstName} ${input.lastName}`,
          roles: { create: roleRows.map((r) => ({ roleId: r.id })) },
        },
      });
      userId = account.id;
    }
    return tx.employee.create({
      data: {
        ...fields,
        userId,
        employeeNumber: employeeNumber ?? (await nextEmployeeNumber(tx)),
        dateOfBirth: dateOfBirth ? fromDateKey(dateOfBirth) : null,
        hireDate: fromDateKey(hireDate),
      },
    });
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "Employee",
    entityId: employee.id,
    changes: { after: { ...input, roles } },
  });

  if (employee.userId) {
    await sendInvite(
      {
        id: employee.userId,
        email: employee.workEmail,
        name: `${employee.firstName} ${employee.lastName}`,
      },
      await appBaseUrl(),
    );
  }
  return employee;
}

export async function updateEmployee(
  user: CurrentUser,
  input: z.output<typeof updateEmployeeSchema>,
) {
  const { id, dateOfBirth, hireDate, employeeNumber, ...fields } = input;
  assertCan(user, "employee:update", id);
  const existing = await findActive(id);
  if (existing.employmentStatus === "TERMINATED") {
    throw new DomainError("Terminated employees can't be edited.");
  }
  await assertReferences(fields);
  await assertNoReportingCycle(id, fields.managerId);

  const data = {
    ...fields,
    ...(employeeNumber ? { employeeNumber } : {}),
    dateOfBirth: dateOfBirth ? fromDateKey(dateOfBirth) : null,
    hireDate: fromDateKey(hireDate),
  };

  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data });
    // Keep the login email and display name in sync with the employee record.
    if (existing.userId) {
      await tx.user.update({
        where: { id: existing.userId },
        data: { email: fields.workEmail, name: `${fields.firstName} ${fields.lastName}` },
      });
    }
  });

  const changes = diff(existing, data);
  if (changes)
    await recordAudit({
      actorId: user.id,
      action: "UPDATE",
      entity: "Employee",
      entityId: id,
      changes,
    });
}

export async function updateProfile(user: CurrentUser, input: z.output<typeof profileSchema>) {
  const { id, ...data } = input;
  assertCanEditProfile(user, id);
  const existing = await findActive(id);
  await db.employee.update({ where: { id }, data });
  const changes = diff(existing, data);
  if (changes)
    await recordAudit({
      actorId: user.id,
      action: "UPDATE",
      entity: "Employee",
      entityId: id,
      changes,
    });
}

// ─── Emergency contacts ──────────────────────────────────────────────────────

export async function saveEmergencyContact(
  user: CurrentUser,
  input: z.output<typeof emergencyContactSchema>,
) {
  const { id, employeeId, ...data } = input;
  assertCanEditProfile(user, employeeId);
  await findActive(employeeId);

  await db.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.emergencyContact.updateMany({ where: { employeeId }, data: { isPrimary: false } });
    }
    if (id) {
      const { count } = await tx.emergencyContact.updateMany({ where: { id, employeeId }, data });
      if (count === 0) throw new NotFoundError("Contact");
    } else {
      await tx.emergencyContact.create({ data: { ...data, employeeId } });
    }
  });
  await recordAudit({
    actorId: user.id,
    action: id ? "UPDATE" : "CREATE",
    entity: "EmergencyContact",
    entityId: employeeId,
    changes: { name: data.name },
  });
}

export async function deleteEmergencyContact(user: CurrentUser, id: string) {
  const contact = await db.emergencyContact.findUnique({ where: { id } });
  if (!contact) throw new NotFoundError("Contact");
  assertCanEditProfile(user, contact.employeeId);
  await db.emergencyContact.delete({ where: { id } });
  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    entity: "EmergencyContact",
    entityId: contact.employeeId,
    changes: { name: contact.name },
  });
}

// ─── Photos and documents ────────────────────────────────────────────────────

export async function uploadPhoto(user: CurrentUser, input: z.output<typeof fileUploadSchema>) {
  assertCanEditProfile(user, input.employeeId);
  const employee = await findActive(input.employeeId);
  const stored = await saveFile("photos", input.file);
  await db.employee.update({ where: { id: employee.id }, data: { photoUrl: fileUrl(stored.key) } });
  if (employee.photoUrl?.startsWith("/api/files/")) {
    await deleteStoredFile(employee.photoUrl.slice("/api/files/".length));
  }
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entity: "Employee",
    entityId: employee.id,
    changes: { photo: "updated" },
  });
}

export async function uploadDocument(
  user: CurrentUser,
  input: z.output<typeof documentUploadSchema>,
) {
  assertCan(user, "employee:update", input.employeeId);
  await findActive(input.employeeId);
  const stored = await saveFile("documents", input.file);
  const doc = await db.employeeDocument.create({
    data: {
      employeeId: input.employeeId,
      name: input.name ?? stored.name,
      category: input.category,
      fileKey: stored.key,
      mimeType: stored.mimeType,
      size: stored.size,
      uploadedById: user.employeeId,
    },
  });
  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "EmployeeDocument",
    entityId: input.employeeId,
    changes: { document: doc.name, category: doc.category },
  });
}

export async function deleteDocument(user: CurrentUser, id: string) {
  const doc = await db.employeeDocument.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("Document");
  assertCan(user, "employee:update", doc.employeeId);
  await db.employeeDocument.delete({ where: { id } });
  await deleteStoredFile(doc.fileKey);
  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    entity: "EmployeeDocument",
    entityId: doc.employeeId,
    changes: { document: doc.name },
  });
}

// ─── Offboarding and archiving ───────────────────────────────────────────────

export async function offboardEmployee(user: CurrentUser, input: z.output<typeof offboardSchema>) {
  assertCan(user, "employee:delete", input.id);
  const employee = await findActive(input.id);
  if (employee.employmentStatus === "TERMINATED")
    throw new DomainError("This employee is already offboarded.");
  if (input.terminationDate < employee.hireDate.toISOString().slice(0, 10)) {
    throw new DomainError("The last working day can't be before the hire date.", "terminationDate");
  }

  const newManagerId = input.reassignReportsToId ?? employee.managerId;
  if (newManagerId === employee.id)
    throw new DomainError("Choose someone else to take over the reports.", "reassignReportsToId");
  if (input.reassignReportsToId) {
    await assertReferences({
      departmentId: null,
      positionId: null,
      locationId: null,
      managerId: input.reassignReportsToId,
    });
  }

  const reports = await db.employee.count({ where: { managerId: employee.id, deletedAt: null } });

  await db.$transaction([
    db.employee.updateMany({
      where: { managerId: employee.id },
      data: { managerId: newManagerId },
    }),
    db.department.updateMany({ where: { headId: employee.id }, data: { headId: null } }),
    db.jobOpening.updateMany({
      where: { hiringManagerId: employee.id },
      data: { hiringManagerId: newManagerId },
    }),
    db.leaveRequest.updateMany({
      where: { employeeId: employee.id, status: { in: ["PENDING", "MANAGER_APPROVED"] } },
      data: { status: "CANCELLED", decisionComment: "Cancelled on offboarding" },
    }),
    db.employee.update({
      where: { id: employee.id },
      data: { employmentStatus: "TERMINATED", terminationDate: fromDateKey(input.terminationDate) },
    }),
    ...(employee.userId
      ? [db.user.update({ where: { id: employee.userId }, data: { isActive: false } })]
      : []),
  ]);

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entity: "Employee",
    entityId: employee.id,
    changes: {
      offboarded: true,
      terminationDate: input.terminationDate,
      reason: input.reason,
      reportsReassigned: reports,
      reportsReassignedTo: newManagerId,
      accountDeactivated: Boolean(employee.userId),
    },
  });
}

/** Soft delete a terminated employee's record so it no longer appears in lists. */
export async function archiveEmployee(user: CurrentUser, id: string) {
  assertCan(user, "employee:delete", id);
  const employee = await findActive(id);
  if (employee.employmentStatus !== "TERMINATED") {
    throw new DomainError("Offboard the employee before archiving their record.");
  }
  await db.employee.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: user.id, action: "DELETE", entity: "Employee", entityId: id });
}

// ─── CSV import ──────────────────────────────────────────────────────────────

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportPreview {
  valid: number;
  errors: ImportRowError[];
  rows: { row: number; name: string; email: string; department: string | null }[];
}

interface PreparedRow {
  row: number;
  data: Omit<Prisma.EmployeeUncheckedCreateInput, "managerId">;
  managerNumber: string | null;
}

async function prepareImport(records: Record<string, string>[]) {
  const [departments, positions, locations, existing] = await Promise.all([
    db.department.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
    }),
    db.position.findMany({ where: { deletedAt: null }, select: { id: true, code: true } }),
    db.location.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.employee.findMany({ select: { id: true, employeeNumber: true, workEmail: true } }),
  ]);
  const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
  const posByCode = new Map(positions.map((p) => [p.code.toUpperCase(), p.id]));
  const locByName = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]));
  const existingNumbers = new Set(existing.map((e) => e.employeeNumber));
  const existingEmails = new Set(existing.map((e) => e.workEmail));

  const errors: ImportRowError[] = [];
  const prepared: PreparedRow[] = [];
  const fileNumbers = new Set<string>();
  const fileEmails = new Set<string>();
  let nextNumber = Number((await nextEmployeeNumber()).slice(1));

  records.forEach((r, index) => {
    const row = index + 2; // header is row 1
    const problems: string[] = [];
    const firstName = r.first_name ?? "";
    const lastName = r.last_name ?? "";
    const email = (r.work_email ?? "").toLowerCase();
    if (!firstName) problems.push("first_name is required");
    if (!lastName) problems.push("last_name is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("work_email is invalid");
    else if (existingEmails.has(email) || fileEmails.has(email))
      problems.push(`work_email ${email} already exists`);

    let number = (r.employee_number ?? "").toUpperCase();
    if (number) {
      if (existingNumbers.has(number) || fileNumbers.has(number))
        problems.push(`employee_number ${number} already exists`);
    } else {
      number = `E${String(nextNumber++).padStart(4, "0")}`;
    }

    const dept = r.department_code ? deptByCode.get(r.department_code.toUpperCase()) : undefined;
    if (r.department_code && !dept) problems.push(`unknown department_code ${r.department_code}`);
    const positionId = r.position_code ? posByCode.get(r.position_code.toUpperCase()) : undefined;
    if (r.position_code && !positionId) problems.push(`unknown position_code ${r.position_code}`);
    const locationId = r.location ? locByName.get(r.location.toLowerCase()) : undefined;
    if (r.location && !locationId) problems.push(`unknown location ${r.location}`);

    const type = (r.employment_type || "FULL_TIME").toUpperCase().replace(/[\s-]/g, "_");
    if (!(EMPLOYMENT_TYPES as readonly string[]).includes(type))
      problems.push(`invalid employment_type ${r.employment_type}`);
    const status = (r.employment_status || "ACTIVE").toUpperCase().replace(/[\s-]/g, "_");
    if (!(EMPLOYMENT_STATUSES as readonly string[]).includes(status) || status === "TERMINATED") {
      problems.push(`invalid employment_status ${r.employment_status}`);
    }
    const hireDate = r.hire_date ?? "";
    if (!isDateKey(hireDate)) problems.push("hire_date must be YYYY-MM-DD");

    fileNumbers.add(number);
    if (email) fileEmails.add(email);

    if (problems.length) {
      errors.push({ row, message: problems.join("; ") });
      return;
    }
    prepared.push({
      row,
      managerNumber: r.manager_employee_number ? r.manager_employee_number.toUpperCase() : null,
      data: {
        firstName,
        lastName,
        workEmail: email,
        employeeNumber: number,
        departmentId: dept?.id ?? null,
        positionId: positionId ?? null,
        locationId: locationId ?? null,
        employmentType: type as EmploymentType,
        employmentStatus: status as EmploymentStatus,
        hireDate: fromDateKey(hireDate),
        phone: r.phone || null,
        personalEmail: r.personal_email?.toLowerCase() || null,
      },
    });
  });

  // Managers may be existing employees or other rows in the same file.
  const knownNumbers = new Set([...existingNumbers, ...prepared.map((p) => p.data.employeeNumber)]);
  // New rows can only be managed by existing employees or each other, so any
  // cycle must be among the rows in this file.
  const fileManagerOf = new Map(prepared.map((p) => [p.data.employeeNumber, p.managerNumber]));
  for (const p of prepared) {
    if (p.managerNumber && !knownNumbers.has(p.managerNumber)) {
      errors.push({ row: p.row, message: `unknown manager_employee_number ${p.managerNumber}` });
    } else if (wouldCreateCycle(p.data.employeeNumber, p.managerNumber, fileManagerOf)) {
      errors.push({ row: p.row, message: "manager_employee_number creates a reporting cycle" });
    }
  }

  return { prepared, errors: errors.sort((a, b) => a.row - b.row), existing, deptByCode };
}

export async function previewImport(
  user: CurrentUser,
  records: Record<string, string>[],
): Promise<ImportPreview> {
  assertCan(user, "employee:create");
  const { prepared, errors, deptByCode } = await prepareImport(records);
  const deptNames = new Map([...deptByCode.values()].map((d) => [d.id, d.name]));
  const errorRows = new Set(errors.map((e) => e.row));
  return {
    valid: prepared.filter((p) => !errorRows.has(p.row)).length,
    errors,
    rows: prepared.slice(0, 50).map((p) => ({
      row: p.row,
      name: `${p.data.firstName} ${p.data.lastName}`,
      email: p.data.workEmail,
      department: p.data.departmentId ? (deptNames.get(p.data.departmentId) ?? null) : null,
    })),
  };
}

/** Import all rows, or none if any row is invalid. */
export async function importEmployees(user: CurrentUser, records: Record<string, string>[]) {
  assertCan(user, "employee:create");
  if (records.length === 0) throw new DomainError("The file has no rows.");
  if (records.length > 1000) throw new DomainError("Import at most 1,000 rows at a time.");
  const { prepared, errors, existing } = await prepareImport(records);
  if (errors.length) throw new DomainError(`Fix ${errors.length} row error(s) before importing.`);

  const created = await db.$transaction(async (tx) => {
    const ids = new Map(existing.map((e) => [e.employeeNumber, e.id]));
    for (const p of prepared) {
      const employee = await tx.employee.create({ data: p.data });
      ids.set(employee.employeeNumber, employee.id);
    }
    for (const p of prepared) {
      if (!p.managerNumber) continue;
      await tx.employee.update({
        where: { employeeNumber: p.data.employeeNumber },
        data: { managerId: ids.get(p.managerNumber) ?? null },
      });
    }
    return prepared.length;
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "Employee",
    changes: { imported: created },
  });
  return created;
}
