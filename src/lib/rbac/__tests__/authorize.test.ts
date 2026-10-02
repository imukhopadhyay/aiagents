import { describe, expect, it } from "vitest";

import {
  type AuthzUser,
  can,
  employeeScopeFilter,
  mergeGrants,
  widestScope,
} from "@/lib/rbac/authorize";
import { ALL_PERMISSIONS, ROLES, type RoleKey } from "@/lib/rbac/permissions";

function userWithRoles(roles: RoleKey[], overrides: Partial<AuthzUser> = {}): AuthzUser {
  return {
    id: "user-1",
    employeeId: "emp-self",
    roles,
    permissions: mergeGrants(
      roles.flatMap((role) =>
        Object.entries(ROLES[role].grants).map(([permission, scope]) => ({
          permission: permission as (typeof ALL_PERMISSIONS)[number],
          scope,
        })),
      ),
    ),
    teamEmployeeIds: [],
    ...overrides,
  };
}

describe("widestScope / mergeGrants", () => {
  it("keeps the widest scope", () => {
    expect(widestScope(undefined, "OWN")).toBe("OWN");
    expect(widestScope("OWN", "TEAM")).toBe("TEAM");
    expect(widestScope("ALL", "OWN")).toBe("ALL");
  });

  it("merges grants across roles", () => {
    const grants = mergeGrants([
      { permission: "employee:read", scope: "OWN" },
      { permission: "employee:read", scope: "TEAM" },
      { permission: "leave:approve", scope: "TEAM" },
      { permission: "leave:approve", scope: "OWN" },
    ]);
    expect(grants).toEqual({ "employee:read": "TEAM", "leave:approve": "TEAM" });
  });
});

describe("can", () => {
  it("denies when there is no user", () => {
    expect(can(null, "dashboard:view")).toBe(false);
    expect(can(undefined, "dashboard:view")).toBe(false);
  });

  it("denies permissions the user does not hold", () => {
    const employee = userWithRoles(["EMPLOYEE"]);
    expect(can(employee, "employee:create")).toBe(false);
    expect(can(employee, "leave:approve")).toBe(false);
    expect(can(employee, "audit:read")).toBe(false);
  });

  it("grants SUPER_ADMIN every permission on every record", () => {
    const admin = userWithRoles(["SUPER_ADMIN"], { employeeId: null });
    for (const permission of ALL_PERMISSIONS) {
      expect(can(admin, permission)).toBe(true);
      expect(can(admin, permission, { employeeId: "anyone" })).toBe(true);
    }
  });

  it("keeps role management away from HR_ADMIN", () => {
    expect(can(userWithRoles(["HR_ADMIN"]), "role:manage")).toBe(false);
    expect(can(userWithRoles(["HR_ADMIN"]), "user:manage")).toBe(true);
  });

  describe("OWN scope", () => {
    const employee = userWithRoles(["EMPLOYEE"]);

    it("allows the user's own records", () => {
      expect(can(employee, "employee:read", { employeeId: "emp-self" })).toBe(true);
      expect(can(employee, "leave:request", { employeeId: "emp-self" })).toBe(true);
    });

    it("denies other people's records", () => {
      expect(can(employee, "employee:read", { employeeId: "emp-other" })).toBe(false);
    });

    it("denies records without an owner", () => {
      expect(can(employee, "employee:read", { employeeId: null })).toBe(false);
    });

    it("denies everything resource-scoped for users without an employee record", () => {
      const noEmployee = userWithRoles(["EMPLOYEE"], { employeeId: null });
      expect(can(noEmployee, "employee:read", { employeeId: null })).toBe(false);
      expect(can(noEmployee, "employee:read", { employeeId: "emp-self" })).toBe(false);
    });
  });

  describe("TEAM scope", () => {
    const manager = userWithRoles(["EMPLOYEE", "MANAGER"], {
      teamEmployeeIds: ["emp-report", "emp-skip-level"],
    });

    it("allows the manager's own records and their reports'", () => {
      expect(can(manager, "employee:read", { employeeId: "emp-self" })).toBe(true);
      expect(can(manager, "employee:read", { employeeId: "emp-report" })).toBe(true);
      expect(can(manager, "leave:approve", { employeeId: "emp-skip-level" })).toBe(true);
    });

    it("denies people outside the team", () => {
      expect(can(manager, "employee:read", { employeeId: "emp-other" })).toBe(false);
      expect(can(manager, "leave:approve", { employeeId: "emp-other" })).toBe(false);
    });

    it("does not widen OWN-scoped permissions to the team", () => {
      expect(can(manager, "leave:request", { employeeId: "emp-report" })).toBe(false);
    });
  });

  it("gives HR_MANAGER org-wide access to HR records", () => {
    const hr = userWithRoles(["EMPLOYEE", "HR_MANAGER"]);
    expect(can(hr, "employee:update", { employeeId: "emp-other" })).toBe(true);
    expect(can(hr, "leave:approve", { employeeId: "emp-other" })).toBe(true);
    expect(can(hr, "employee:delete")).toBe(false);
  });
});

describe("employeeScopeFilter", () => {
  it("returns none without the permission", () => {
    expect(employeeScopeFilter(userWithRoles(["EMPLOYEE"]), "audit:read")).toEqual({
      kind: "none",
    });
    expect(employeeScopeFilter(null, "employee:read")).toEqual({ kind: "none" });
  });

  it("returns all for ALL scope", () => {
    expect(employeeScopeFilter(userWithRoles(["HR_MANAGER"]), "employee:read")).toEqual({
      kind: "all",
    });
  });

  it("returns only the user for OWN scope", () => {
    expect(employeeScopeFilter(userWithRoles(["EMPLOYEE"]), "employee:read")).toEqual({
      kind: "employees",
      ids: ["emp-self"],
    });
  });

  it("returns the user and their team for TEAM scope", () => {
    const manager = userWithRoles(["MANAGER"], { teamEmployeeIds: ["emp-report"] });
    expect(employeeScopeFilter(manager, "leave:read")).toEqual({
      kind: "employees",
      ids: ["emp-self", "emp-report"],
    });
  });

  it("returns none for OWN scope without an employee record", () => {
    const user = userWithRoles(["EMPLOYEE"], { employeeId: null });
    expect(employeeScopeFilter(user, "employee:read")).toEqual({ kind: "none" });
  });
});

describe("role catalog", () => {
  it("only grants permissions that exist", () => {
    for (const role of Object.values(ROLES)) {
      for (const permission of Object.keys(role.grants)) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it("lets every role view the dashboard", () => {
    for (const role of Object.keys(ROLES) as RoleKey[]) {
      expect(can(userWithRoles([role]), "dashboard:view")).toBe(true);
    }
  });
});
