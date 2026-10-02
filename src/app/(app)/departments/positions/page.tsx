import type { Metadata } from "next";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/authorize";

import { archivePositionAction } from "../actions";
import { OrgTabs } from "../org-tabs";
import { PositionFormDialog } from "../position-form-dialog";

export const metadata: Metadata = { title: "Positions" };

export default async function PositionsPage() {
  const user = await requirePermission("department:read");
  const canManage = can(user, "department:manage");
  const [positions, departments] = await Promise.all([
    db.position.findMany({
      where: { deletedAt: null },
      orderBy: [{ level: "desc" }, { title: "asc" }],
      include: {
        department: { select: { name: true } },
        _count: { select: { employees: { where: { deletedAt: null, employmentStatus: { not: "TERMINATED" } } } } },
      },
    }),
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Positions"
        description="Job titles and seniority levels used across the organization."
        actions={
          canManage && (
            <PositionFormDialog
              departments={departmentOptions}
              trigger={
                <Button>
                  <Plus /> New position
                </Button>
              }
            />
          )
        }
      />
      <OrgTabs active="positions" />
      {positions.length === 0 ? (
        <EmptyState icon={Briefcase} title="No positions yet" />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Title</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                  <TableHead className="text-right">Holders</TableHead>
                  {canManage && <TableHead className="w-24 pr-6" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6 font-medium">{p.title}</TableCell>
                    <TableCell className="text-muted-foreground">{p.code}</TableCell>
                    <TableCell>{p.department?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.level ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{p._count.employees}</TableCell>
                    {canManage && (
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          <PositionFormDialog
                            departments={departmentOptions}
                            position={{
                              id: p.id,
                              title: p.title,
                              code: p.code,
                              description: p.description,
                              level: p.level,
                              departmentId: p.departmentId,
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Edit ${p.title}`}>
                                <Pencil />
                              </Button>
                            }
                          />
                          <ConfirmAction
                            title={`Archive ${p.title}?`}
                            description="The position will no longer be available for new assignments."
                            confirmLabel="Archive"
                            destructive
                            action={archivePositionAction.bind(null, { id: p.id })}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Archive ${p.title}`}>
                                <Trash2 />
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
