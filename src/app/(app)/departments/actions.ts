"use server";

import { idSchema, runAction, success } from "@/lib/action";
import {
  archiveDepartment,
  archivePosition,
  createDepartment,
  createPosition,
  updateDepartment,
  updatePosition,
} from "@/lib/services/org";
import {
  archiveDepartmentSchema,
  departmentSchema,
  positionSchema,
  updateDepartmentSchema,
  updatePositionSchema,
} from "@/lib/validation/org";

export async function createDepartmentAction(input: unknown) {
  return runAction(departmentSchema, input, async (data, user) => {
    const department = await createDepartment(user, data);
    return success("Department created", { id: department.id });
  });
}

export async function updateDepartmentAction(input: unknown) {
  return runAction(updateDepartmentSchema, input, async (data, user) => {
    await updateDepartment(user, data);
    return success("Department updated", { id: data.id });
  });
}

export async function archiveDepartmentAction(input: unknown) {
  return runAction(archiveDepartmentSchema, input, async (data, user) => {
    await archiveDepartment(user, data);
    return success("Department archived");
  });
}

export async function createPositionAction(input: unknown) {
  return runAction(positionSchema, input, async (data, user) => {
    await createPosition(user, data);
    return success("Position created");
  });
}

export async function updatePositionAction(input: unknown) {
  return runAction(updatePositionSchema, input, async (data, user) => {
    await updatePosition(user, data);
    return success("Position updated");
  });
}

export async function archivePositionAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, user) => {
    await archivePosition(user, id);
    return success("Position archived");
  });
}
