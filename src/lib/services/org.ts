import "server-only";

import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { descendantIds, wouldCreateCycle } from "@/lib/domain/org";
import { DomainError, NotFoundError } from "@/lib/errors";
import { AuthorizationError, can } from "@/lib/rbac/authorize";
import type {
  archiveDepartmentSchema,
  departmentSchema,
  positionSchema,
  updateDepartmentSchema,
  updatePositionSchema,
} from "@/lib/validation/org";

import { diff } from "./audit-diff";

function assertManage(user: CurrentUser) {
  if (!can(user, "department:manage")) throw new AuthorizationError("department:manage");
}

async function departmentParents() {
  const rows = await db.department.findMany({
    where: { deletedAt: null },
    select: { id: true, parentId: true },
  });
  return rows;
}

async function assertValidHead(headId: string | null, departmentId?: string) {
  if (!headId) return;
  const head = await db.employee.findFirst({
    where: { id: headId, deletedAt: null, employmentStatus: { not: "TERMINATED" } },
    include: { headOfDepartment: { select: { id: true, name: true, deletedAt: true } } },
  });
  if (!head) throw new DomainError("Choose an active employee as head.", "headId");
  const current = head.headOfDepartment;
  if (current && current.id !== departmentId && !current.deletedAt) {
    throw new DomainError(`${head.firstName} ${head.lastName} already heads ${current.name}.`, "headId");
  }
}

export async function createDepartment(user: CurrentUser, input: z.output<typeof departmentSchema>) {
  assertManage(user);
  if (input.parentId) {
    const parent = await db.department.findFirst({ where: { id: input.parentId, deletedAt: null } });
    if (!parent) throw new DomainError("Parent department not found.", "parentId");
  }
  await assertValidHead(input.headId);

  const department = await db.department.create({ data: input });
  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "Department",
    entityId: department.id,
    changes: { after: input },
  });
  return department;
}

export async function updateDepartment(
  user: CurrentUser,
  input: z.output<typeof updateDepartmentSchema>,
) {
  assertManage(user);
  const { id, ...data } = input;
  const existing = await db.department.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Department");

  if (data.parentId) {
    const rows = await departmentParents();
    if (!rows.some((r) => r.id === data.parentId)) {
      throw new DomainError("Parent department not found.", "parentId");
    }
    const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
    if (wouldCreateCycle(id, data.parentId, parentOf)) {
      throw new DomainError("A department can't sit under itself or one of its sub-departments.", "parentId");
    }
  }
  await assertValidHead(data.headId, id);

  const updated = await db.department.update({ where: { id }, data });
  const changes = diff(existing, data);
  if (changes) {
    await recordAudit({ actorId: user.id, action: "UPDATE", entity: "Department", entityId: id, changes });
  }
  return updated;
}

/**
 * Archive a department, moving its members, sub-departments, positions and
 * open jobs to another department (its parent by default).
 */
export async function archiveDepartment(
  user: CurrentUser,
  input: z.output<typeof archiveDepartmentSchema>,
) {
  assertManage(user);
  const department = await db.department.findFirst({
    where: { id: input.id, deletedAt: null },
    include: {
      _count: {
        select: {
          employees: { where: { deletedAt: null } },
          children: { where: { deletedAt: null } },
          positions: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!department) throw new NotFoundError("Department");

  const targetId = input.reassignToId ?? department.parentId;
  const hasDependents = department._count.employees + department._count.children + department._count.positions > 0;

  if (targetId) {
    const rows = await departmentParents();
    if (!rows.some((r) => r.id === targetId)) {
      throw new DomainError("Target department not found.", "reassignToId");
    }
    if (targetId === department.id || descendantIds(department.id, rows).has(targetId)) {
      throw new DomainError("Move members to a department outside this one.", "reassignToId");
    }
  } else if (hasDependents) {
    throw new DomainError(
      "This top-level department still has members, sub-departments or positions. Choose where to move them.",
      "reassignToId",
    );
  }

  await db.$transaction([
    db.employee.updateMany({ where: { departmentId: department.id }, data: { departmentId: targetId } }),
    db.department.updateMany({ where: { parentId: department.id }, data: { parentId: targetId } }),
    db.position.updateMany({ where: { departmentId: department.id }, data: { departmentId: targetId } }),
    db.jobOpening.updateMany({ where: { departmentId: department.id }, data: { departmentId: targetId } }),
    db.department.update({
      where: { id: department.id },
      data: { deletedAt: new Date(), headId: null, code: `${department.code}~${Date.now().toString(36)}` },
    }),
  ]);

  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    entity: "Department",
    entityId: department.id,
    changes: { name: department.name, reassignedTo: targetId, moved: department._count },
  });
}

export async function createPosition(user: CurrentUser, input: z.output<typeof positionSchema>) {
  assertManage(user);
  const position = await db.position.create({ data: input });
  await recordAudit({ actorId: user.id, action: "CREATE", entity: "Position", entityId: position.id, changes: { after: input } });
  return position;
}

export async function updatePosition(user: CurrentUser, input: z.output<typeof updatePositionSchema>) {
  assertManage(user);
  const { id, ...data } = input;
  const existing = await db.position.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Position");
  await db.position.update({ where: { id }, data });
  const changes = diff(existing, data);
  if (changes) await recordAudit({ actorId: user.id, action: "UPDATE", entity: "Position", entityId: id, changes });
}

export async function archivePosition(user: CurrentUser, id: string) {
  assertManage(user);
  const position = await db.position.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
  });
  if (!position) throw new NotFoundError("Position");
  if (position._count.employees > 0) {
    throw new DomainError(
      `${position._count.employees} employee(s) still hold this position. Move them to another position first.`,
    );
  }
  await db.position.update({
    where: { id },
    data: { deletedAt: new Date(), code: `${position.code}~${Date.now().toString(36)}` },
  });
  await recordAudit({ actorId: user.id, action: "DELETE", entity: "Position", entityId: id, changes: { title: position.title } });
}

/** Options for selects across the app. */
export async function orgOptions() {
  const [departments, positions, locations, employees] = await Promise.all([
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.position.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" }, select: { id: true, title: true, departmentId: true } }),
    db.location.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({
      where: { deletedAt: null, employmentStatus: { not: "TERMINATED" } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    }),
  ]);
  return {
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    positions: positions.map((p) => ({ value: p.id, label: p.title })),
    locations: locations.map((l) => ({ value: l.id, label: l.name })),
    employees: employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeNumber})` })),
  };
}
export type OrgOptions = Awaited<ReturnType<typeof orgOptions>>;
