import {
  Briefcase,
  CalendarDays,
  CheckSquare,
  Clock,
  FileClock,
  LayoutDashboard,
  type LucideIcon,
  Network,
  Settings2,
  UserSearch,
  Users,
  Building2,
} from "lucide-react";

import type { PermissionGrants } from "@/lib/rbac/authorize";
import type { Permission } from "@/lib/rbac/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Shown if the user holds any of these permissions. */
  anyOf: Permission[];
  /** Highlight for nested paths (default true). */
  prefix?: boolean;
  /** Paths under this item that belong to another item. */
  exclude?: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, anyOf: ["dashboard:view"] }],
  },
  {
    title: "People",
    items: [
      { title: "Employees", href: "/employees", icon: Users, anyOf: ["employee:read"] },
      { title: "Departments", href: "/departments", icon: Building2, anyOf: ["department:read"] },
      { title: "Org chart", href: "/org-chart", icon: Network, anyOf: ["department:read"] },
    ],
  },
  {
    title: "Time off & attendance",
    items: [
      { title: "Attendance", href: "/attendance", icon: Clock, anyOf: ["attendance:record", "attendance:read"] },
      { title: "Leave", href: "/leave", icon: CalendarDays, anyOf: ["leave:request", "leave:read"] },
      { title: "Approvals", href: "/approvals", icon: CheckSquare, anyOf: ["leave:approve", "attendance:manage"] },
    ],
  },
  {
    title: "Hiring",
    items: [
      { title: "Jobs", href: "/recruitment", icon: Briefcase, anyOf: ["recruitment:read"], exclude: ["/recruitment/candidates"] },
      { title: "Candidates", href: "/recruitment/candidates", icon: UserSearch, anyOf: ["recruitment:read"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Leave settings", href: "/settings/leave", icon: Settings2, anyOf: ["leave:manage"] },
      { title: "Audit log", href: "/admin/audit", icon: FileClock, anyOf: ["audit:read"] },
    ],
  },
];

export function visibleNav(permissions: PermissionGrants): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.anyOf.some((p) => permissions[p])),
  })).filter((section) => section.items.length > 0);
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exclude?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if (pathname === item.href) return true;
  return item.prefix !== false && pathname.startsWith(`${item.href}/`);
}

/** Labels for static path segments in breadcrumbs. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  departments: "Departments",
  positions: "Positions",
  "org-chart": "Org chart",
  attendance: "Attendance",
  team: "Team",
  report: "Report",
  leave: "Leave",
  calendar: "Calendar",
  balances: "Balances",
  approvals: "Approvals",
  recruitment: "Jobs",
  jobs: "Jobs",
  candidates: "Candidates",
  settings: "Settings",
  admin: "Admin",
  audit: "Audit log",
  notifications: "Notifications",
  new: "New",
  edit: "Edit",
  import: "Import",
};
