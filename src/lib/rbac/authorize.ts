// Pure authorization logic: no database or framework imports, so it can run
// anywhere and is unit tested directly.

import type { Permission, Scope } from "./permissions";

export type PermissionGrants = Partial<Record<Permission, Scope>>;

export interface AuthzUser {
  id: string;
  /** The employee record linked to this user, if any. */
  employeeId: string | null;
  roles: string[];
  /** Effective scope per permission, merged across all of the user's roles. */
  permissions: PermissionGrants;
  /** Ids of the user's direct and indirect reports (empty if not a manager). */
  teamEmployeeIds: string[];
}

/** A record being accessed, identified by the employee it belongs to. */
export interface OwnedResource {
  employeeId: string | null | undefined;
}

const SCOPE_RANK: Record<Scope, number> = { OWN: 1, TEAM: 2, ALL: 3 };

export function widestScope(a: Scope | undefined, b: Scope): Scope {
  return a && SCOPE_RANK[a] >= SCOPE_RANK[b] ? a : b;
}

/** Merge grants from several roles; the widest scope for each permission wins. */
export function mergeGrants(
  grants: Iterable<{ permission: Permission; scope: Scope }>,
): PermissionGrants {
  const merged: PermissionGrants = {};
  for (const { permission, scope } of grants) {
    merged[permission] = widestScope(merged[permission], scope);
  }
  return merged;
}

/**
 * Whether the user may perform `permission`.
 *
 * Without a resource this answers "does the user hold the permission at any
 * scope?" — use it for navigation and entry points, then narrow queries with
 * {@link employeeScopeFilter}. With a resource it checks the record itself
 * against the user's scope.
 */
export function can(
  user: AuthzUser | null | undefined,
  permission: Permission,
  resource?: OwnedResource,
): boolean {
  if (!user) return false;
  const scope = user.permissions[permission];
  if (!scope) return false;
  if (scope === "ALL" || resource === undefined) return true;

  const target = resource.employeeId;
  if (!target) return false;
  if (target === user.employeeId) return true;
  return scope === "TEAM" && user.teamEmployeeIds.includes(target);
}

export type EmployeeScopeFilter =
  { kind: "all" } | { kind: "employees"; ids: string[] } | { kind: "none" };

/** Which employees' records the user may access under `permission`. */
export function employeeScopeFilter(
  user: AuthzUser | null | undefined,
  permission: Permission,
): EmployeeScopeFilter {
  const scope = user?.permissions[permission];
  if (!user || !scope) return { kind: "none" };
  if (scope === "ALL") return { kind: "all" };

  const ids = user.employeeId ? [user.employeeId] : [];
  if (scope === "TEAM") ids.push(...user.teamEmployeeIds);
  return ids.length ? { kind: "employees", ids } : { kind: "none" };
}

export class AuthorizationError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "AuthorizationError";
  }
}
