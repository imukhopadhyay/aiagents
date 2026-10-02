import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, Upload, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect, SearchInput } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SortHeader } from "@/components/shared/sort-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatDate, fullName, labelize } from "@/lib/format";
import { hrefWith, parseListParams } from "@/lib/list-params";
import { can } from "@/lib/rbac/authorize";
import { EMPLOYEE_SORTS, listEmployees } from "@/lib/services/employees";
import { EMPLOYMENT_STATUSES } from "@/lib/validation/employee";

export const metadata: Metadata = { title: "Employees" };

const PATH = "/employees";

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const user = await requirePermission("employee:read");
  const params = parseListParams(await searchParams, {
    sortable: EMPLOYEE_SORTS,
    defaultSort: "name",
  });
  const filters = {
    q: params.q,
    departmentId: params.get("department"),
    locationId: params.get("location"),
    status: params.get("status"),
  };

  const [{ rows, total }, departments, locations] = await Promise.all([
    listEmployees(user, {
      ...filters,
      sort: params.sort,
      dir: params.dir,
      page: params.page,
      pageSize: params.pageSize,
    }),
    db.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const canCreate = can(user, "employee:create");
  const sortProps = { pathname: PATH, params: params.raw, sort: params.sort, dir: params.dir };
  const filtered = Boolean(
    params.q || filters.departmentId || filters.locationId || filters.status,
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Employees"
        description={`${total} ${total === 1 ? "person" : "people"}${filtered ? " match your filters" : ""}.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a
                href={hrefWith("/api/employees/export", params.raw, {
                  page: null,
                  sort: null,
                  dir: null,
                })}
                download
              >
                <Download /> Export CSV
              </a>
            </Button>
            {canCreate && (
              <>
                <Button variant="outline" asChild>
                  <Link href="/employees/import">
                    <Upload /> Import
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/employees/new">
                    <Plus /> New employee
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder="Search name, email or number" />
        <FilterSelect
          param="department"
          label="Departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <FilterSelect
          param="location"
          label="Locations"
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
        />
        <FilterSelect
          param="status"
          label="Statuses"
          options={[
            { value: "current", label: "Current employees" },
            ...EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: labelize(s) })),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "No employees match your filters" : "No employees yet"}
          description={filtered ? "Try a different search or clear the filters." : undefined}
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href={PATH}>Clear filters</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="Name" column="name" className="pl-6" {...sortProps} />
                  <SortHeader label="Number" column="number" {...sortProps} />
                  <SortHeader label="Department" column="department" {...sortProps} />
                  <TableHead>Position</TableHead>
                  <TableHead>Manager</TableHead>
                  <SortHeader label="Hired" column="hireDate" {...sortProps} />
                  <SortHeader label="Status" column="status" className="pr-6" {...sortProps} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-6">
                      <Link href={`/employees/${e.id}`} className="group flex items-center gap-3">
                        <PersonAvatar name={fullName(e)} photoUrl={e.photoUrl} />
                        <div className="min-w-0">
                          <p className="font-medium group-hover:underline">{fullName(e)}</p>
                          <p className="text-muted-foreground text-xs">{e.workEmail}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.employeeNumber}</TableCell>
                    <TableCell>{e.department?.name ?? "—"}</TableCell>
                    <TableCell>{e.position?.title ?? "—"}</TableCell>
                    <TableCell>{e.manager ? fullName(e.manager) : "—"}</TableCell>
                    <TableCell>{formatDate(e.hireDate)}</TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge status={e.employmentStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Pagination
        pathname={PATH}
        params={params.raw}
        page={params.page}
        pageSize={params.pageSize}
        total={total}
      />
    </div>
  );
}
