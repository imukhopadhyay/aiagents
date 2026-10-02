import "server-only";

import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  type AuthzUser,
  type OwnedResource,
  AuthorizationError,
  can,
  mergeGrants,
} from "@/lib/rbac/authorize";
import type { Permission } from "@/lib/rbac/permissions";

export interface CurrentUser extends AuthzUser {
  email: string;
  name: string | null;
  image: string | null;
}

/** Ids of every employee who reports to `managerId`, directly or indirectly. */
async function loadTeamEmployeeIds(managerId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE team AS (
      SELECT id FROM employees WHERE "managerId" = ${managerId} AND "deletedAt" IS NULL
      UNION
      SELECT e.id FROM employees e
      JOIN team t ON e."managerId" = t.id
      WHERE e."deletedAt" IS NULL
    )
    SELECT id FROM team`;
  return rows.map((row) => row.id);
}

/**
 * The signed-in user with roles and permissions loaded fresh from the
 * database, or null. Cached for the duration of a request.
 *
 * Reading from the database (not the JWT) means role changes and account
 * deactivation take effect on the next request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      employee: { select: { id: true, deletedAt: true } },
      roles: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  });
  if (!user || !user.isActive || user.deletedAt) return null;

  const permissions = mergeGrants(
    user.roles.flatMap(({ role }) =>
      role.permissions.map((rp) => ({
        permission: rp.permission.key as Permission,
        scope: rp.scope,
      })),
    ),
  );

  const employeeId = user.employee && !user.employee.deletedAt ? user.employee.id : null;
  const needsTeam = Object.values(permissions).includes("TEAM");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    employeeId,
    roles: user.roles.map(({ role }) => role.key),
    permissions,
    teamEmployeeIds: needsTeam && employeeId ? await loadTeamEmployeeIds(employeeId) : [],
  };
});

/** For pages and layouts: the current user, or a redirect to sign in. */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * For pages, layouts, server actions and route handlers: the current user if
 * they hold `permission` (for `resource`, when given). Signed-out users are
 * redirected to sign in; signed-in users without access get a 403.
 */
export async function requirePermission(
  permission: Permission,
  resource?: OwnedResource,
): Promise<CurrentUser> {
  const user = await requireAuth();
  if (!can(user, permission, resource)) forbidden();
  return user;
}

/**
 * Like {@link requirePermission} but throws {@link AuthorizationError}
 * instead of rendering a 403, for service code that reports errors itself.
 */
export async function assertPermission(
  permission: Permission,
  resource?: OwnedResource,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!can(user, permission, resource)) throw new AuthorizationError(permission);
  return user!;
}
