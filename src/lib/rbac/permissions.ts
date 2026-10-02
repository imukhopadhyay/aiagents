// Single source of truth for roles and permissions. The seed script syncs
// these definitions into the database; runtime checks read from the database
// so grants can later be edited without a deploy.

export const SCOPES = ["OWN", "TEAM", "ALL"] as const;
export type Scope = (typeof SCOPES)[number];

export const PERMISSIONS = {
  "dashboard:view": "View the dashboard",
  "employee:read": "View employee records",
  "employee:create": "Create employee records",
  "employee:update": "Edit employee records",
  "employee:delete": "Archive and offboard employees",
  "profile:update": "Edit self-service profile details (contact info, photo, emergency contacts)",
  "department:read": "View departments and the org chart",
  "department:manage": "Create, edit and archive departments and positions",
  "attendance:read": "View attendance records",
  "attendance:record": "Clock in and out",
  "attendance:manage": "Correct attendance records",
  "leave:read": "View leave requests and balances",
  "leave:request": "Submit leave requests",
  "leave:approve": "Approve or reject leave requests",
  "leave:manage": "Manage leave types, policies and balances",
  "recruitment:read": "View job openings, candidates and applications",
  "recruitment:manage": "Manage job openings, candidates, interviews and offers",
  "interview:feedback": "Submit interview feedback",
  "user:manage": "Manage user accounts and role assignments",
  "role:manage": "Manage roles and permissions",
  "audit:read": "View the audit log",
} as const satisfies Record<string, string>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_KEYS = ["SUPER_ADMIN", "HR_ADMIN", "HR_MANAGER", "MANAGER", "EMPLOYEE"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

type Grants = Partial<Record<Permission, Scope>>;

function grantAll(except: Permission[] = []): Grants {
  return Object.fromEntries(
    ALL_PERMISSIONS.filter((p) => !except.includes(p)).map((p) => [p, "ALL"]),
  );
}

export const ROLES: Record<RoleKey, { name: string; description: string; grants: Grants }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full access to every module and system setting.",
    grants: grantAll(),
  },
  HR_ADMIN: {
    name: "HR Admin",
    description: "Runs HR operations and user accounts; cannot edit roles.",
    grants: grantAll(["role:manage"]),
  },
  HR_MANAGER: {
    name: "HR Manager",
    description: "Manages people, leave, attendance and recruitment.",
    grants: {
      "dashboard:view": "ALL",
      "employee:read": "ALL",
      "employee:create": "ALL",
      "employee:update": "ALL",
      "profile:update": "ALL",
      "department:read": "ALL",
      "attendance:read": "ALL",
      "attendance:record": "OWN",
      "attendance:manage": "ALL",
      "leave:read": "ALL",
      "leave:request": "OWN",
      "leave:approve": "ALL",
      "leave:manage": "ALL",
      "recruitment:read": "ALL",
      "recruitment:manage": "ALL",
      "interview:feedback": "OWN",
    },
  },
  MANAGER: {
    name: "Manager",
    description: "Leads a team; sees and approves for their reports.",
    grants: {
      "dashboard:view": "ALL",
      "employee:read": "TEAM",
      "profile:update": "OWN",
      "department:read": "ALL",
      "attendance:read": "TEAM",
      "attendance:record": "OWN",
      "attendance:manage": "TEAM",
      "leave:read": "TEAM",
      "leave:request": "OWN",
      "leave:approve": "TEAM",
      "recruitment:read": "ALL",
      "interview:feedback": "OWN",
    },
  },
  EMPLOYEE: {
    name: "Employee",
    description: "Self-service access to their own records.",
    grants: {
      "dashboard:view": "ALL",
      "employee:read": "OWN",
      "profile:update": "OWN",
      "department:read": "ALL",
      "attendance:read": "OWN",
      "attendance:record": "OWN",
      "leave:read": "OWN",
      "leave:request": "OWN",
      "interview:feedback": "OWN",
    },
  },
};
