import "server-only";

import { db } from "@/lib/db";
import type { Permission } from "@/lib/rbac/permissions";

export interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** Create one notification per user (duplicates and nulls are ignored). */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  notification: NotificationInput,
): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return;
  await db.notification.createMany({
    data: unique.map((userId) => ({ userId, ...notification })),
  });
}

/** Notify the user accounts linked to these employees. */
export async function notifyEmployees(
  employeeIds: (string | null | undefined)[],
  notification: NotificationInput,
): Promise<void> {
  const ids = employeeIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  const employees = await db.employee.findMany({
    where: { id: { in: ids } },
    select: { userId: true },
  });
  await notifyUsers(
    employees.map((e) => e.userId),
    notification,
  );
}

/** Active users holding `permission` with organisation-wide (ALL) scope. */
export async function usersWithOrgWidePermission(permission: Permission): Promise<string[]> {
  const users = await db.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: {
        some: {
          role: { permissions: { some: { scope: "ALL", permission: { key: permission } } } },
        },
      },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}
