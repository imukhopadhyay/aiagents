import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Pencil, Users } from "lucide-react";

import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { descendantIds } from "@/lib/domain/org";
import { fullName } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { orgOptions } from "@/lib/services/org";

import { DepartmentFormDialog } from "../department-form-dialog";
import { ArchiveDepartmentDialog } from "./archive-department-dialog";

export const metadata: Metadata = { title: "Department" };

export default async function DepartmentPage({ params }: PageProps<"/departments/[id]">) {
  const { id } = await params;
  const user = await requirePermission("department:read");

  const department = await db.department.findFirst({
    where: { id, deletedAt: null },
    include: {
      parent: { select: { id: true, name: true } },
      head: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      children: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      },
      employees: {
        where: { deletedAt: null, employmentStatus: { not: "TERMINATED" } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          employmentStatus: true,
          position: { select: { title: true } },
        },
      },
      _count: { select: { positions: { where: { deletedAt: null } } } },
    },
  });
  if (!department) notFound();

  const canManage = can(user, "department:manage");
  let manageProps = null;
  if (canManage) {
    const options = await orgOptions();
    const all = await db.department.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });
    const excluded = descendantIds(department.id, all).add(department.id);
    manageProps = { options, targets: options.departments.filter((d) => !excluded.has(d.value)) };
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title={department.name}
        description={department.description ?? `Department code ${department.code}`}
        actions={
          manageProps && (
            <>
              <DepartmentFormDialog
                department={department}
                departments={manageProps.targets}
                employees={manageProps.options.employees}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Edit
                  </Button>
                }
              />
              <ArchiveDepartmentDialog
                departmentId={department.id}
                name={department.name}
                defaultTargetId={department.parentId}
                targets={manageProps.targets}
                counts={{
                  employees: department.employees.length,
                  children: department.children.length,
                  positions: department._count.positions,
                }}
              />
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Code", value: department.code },
                {
                  label: "Parent",
                  value: department.parent ? (
                    <Link
                      className="underline-offset-4 hover:underline"
                      href={`/departments/${department.parent.id}`}
                    >
                      {department.parent.name}
                    </Link>
                  ) : (
                    "Top level"
                  ),
                },
                {
                  label: "Head",
                  value: department.head ? (
                    <span className="flex items-center gap-2">
                      <PersonAvatar
                        name={fullName(department.head)}
                        photoUrl={department.head.photoUrl}
                        className="size-6"
                      />
                      {fullName(department.head)}
                    </span>
                  ) : (
                    "No head"
                  ),
                },
                { label: "Members", value: department.employees.length },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sub-departments</CardTitle>
          </CardHeader>
          <CardContent>
            {department.children.length === 0 ? (
              <p className="text-muted-foreground text-sm">None.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {department.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/departments/${child.id}`}
                      className="hover:bg-muted/60 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Building2 className="text-muted-foreground size-4" />
                      {child.name}
                      <span className="text-muted-foreground ml-auto text-xs">{child.code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardHeader className="pt-6">
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {department.employees.length === 0 ? (
            <EmptyState icon={Users} title="No members" className="mx-6 mb-6" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {department.employees.map((e) => {
                  const viewable = can(user, "employee:read", { employeeId: e.id });
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={fullName(e)} photoUrl={e.photoUrl} />
                          {viewable ? (
                            <Link
                              href={`/employees/${e.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {fullName(e)}
                            </Link>
                          ) : (
                            <span className="font-medium">{fullName(e)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{e.position?.title ?? "—"}</TableCell>
                      <TableCell className="pr-6">
                        <StatusBadge status={e.employmentStatus} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
