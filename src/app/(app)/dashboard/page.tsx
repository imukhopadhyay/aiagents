import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePermission("dashboard:view");
  const grants = Object.entries(user.permissions) as [Permission, string][];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">
          The HR modules arrive in Phase 2. Below is what your account can access.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Assigned to your account</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {role}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Scope: <strong>OWN</strong> — your records, <strong>TEAM</strong> — you and your
              reports{user.teamEmployeeIds.length ? ` (${user.teamEmployeeIds.length})` : ""},{" "}
              <strong>ALL</strong> — everyone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {grants.map(([permission, scope]) => (
                <li key={permission} className="flex items-center justify-between gap-2">
                  <span title={PERMISSIONS[permission]}>
                    <code className="text-xs">{permission}</code>
                  </span>
                  <Badge variant="outline">{scope}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
