import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, Plus, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { type TreeNode, buildTree } from "@/lib/domain/org";
import { fullName } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { orgOptions } from "@/lib/services/org";

import { DepartmentFormDialog } from "./department-form-dialog";
import { OrgTabs } from "./org-tabs";

export const metadata: Metadata = { title: "Departments" };

type Row = Awaited<ReturnType<typeof loadDepartments>>[number];

async function loadDepartments() {
  return db.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      head: { select: { firstName: true, lastName: true, photoUrl: true } },
      _count: {
        select: {
          employees: { where: { deletedAt: null, employmentStatus: { not: "TERMINATED" } } },
        },
      },
    },
  });
}

function DepartmentRow({ node, depth }: { node: TreeNode<Row>; depth: number }) {
  return (
    <>
      <Link
        href={`/departments/${node.id}`}
        className="hover:bg-muted/50 flex items-center gap-4 border-b px-4 py-3 last:border-0 sm:px-6"
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-3"
          style={{ paddingLeft: `${depth * 1.5}rem` }}
        >
          {depth > 0 && <span className="text-muted-foreground">└</span>}
          <Building2 className="text-muted-foreground size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">{node.name}</p>
            <p className="text-muted-foreground text-xs">{node.code}</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-sm sm:flex">
          {node.head ? (
            <>
              <PersonAvatar
                name={fullName(node.head)}
                photoUrl={node.head.photoUrl}
                className="size-6"
              />
              <span className="text-muted-foreground">{fullName(node.head)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No head</span>
          )}
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="size-3" /> {node._count.employees}
        </Badge>
        <ChevronRight className="text-muted-foreground size-4" />
      </Link>
      {node.children.map((child) => (
        <DepartmentRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default async function DepartmentsPage() {
  const user = await requirePermission("department:read");
  const departments = await loadDepartments();
  const tree = buildTree(departments, (d) => d.parentId);
  const canManage = can(user, "department:manage");
  const options = canManage ? await orgOptions() : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Departments"
        description="How the organization is structured."
        actions={
          options && (
            <DepartmentFormDialog
              departments={options.departments}
              employees={options.employees}
              trigger={
                <Button>
                  <Plus /> New department
                </Button>
              }
            />
          )
        }
      />
      <OrgTabs active="departments" />
      {tree.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments yet"
          description="Create your first department to start building the org structure."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            {tree.map((node) => (
              <DepartmentRow key={node.id} node={node} depth={0} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
