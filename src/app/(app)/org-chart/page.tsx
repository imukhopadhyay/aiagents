import type { Metadata } from "next";
import { Network } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { first } from "@/lib/list-params";
import { fullName } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";

import { type ChartPerson, OrgChart } from "./org-chart";

export const metadata: Metadata = { title: "Org chart" };

export default async function OrgChartPage({ searchParams }: PageProps<"/org-chart">) {
  const user = await requirePermission("department:read");
  const department = first((await searchParams).department);

  const [employees, departments] = await Promise.all([
    db.employee.findMany({
      where: {
        deletedAt: null,
        employmentStatus: { not: "TERMINATED" },
        ...(department ? { departmentId: department } : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        managerId: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
      },
    }),
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const people: ChartPerson[] = employees.map((e) => ({
    id: e.id,
    name: fullName(e),
    title: e.position?.title ?? null,
    department: e.department?.name ?? null,
    photoUrl: e.photoUrl,
    managerId: e.managerId,
    viewable: can(user, "employee:read", { employeeId: e.id }),
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Org chart"
        description="Reporting lines across the organization."
        actions={
          <FilterSelect
            param="department"
            label="Departments"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        }
      />
      {people.length === 0 ? (
        <EmptyState icon={Network} title="No one to show" />
      ) : (
        <Card>
          <CardContent>
            <OrgChart people={people} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
