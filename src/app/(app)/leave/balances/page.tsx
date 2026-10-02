import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
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
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fromDateKey, todayIn } from "@/lib/domain/dates";
import { accruedDays, availableDays } from "@/lib/domain/leave";
import { fullName } from "@/lib/format";
import { first, hrefWith } from "@/lib/list-params";
import { can } from "@/lib/rbac/authorize";
import { employeeAccessWhere } from "@/lib/services/employees";
import { canViewTeamLeave } from "@/lib/services/leave";

import { LeaveTabs } from "../leave-tabs";
import { AdjustBalanceDialog } from "./adjust-balance-dialog";

export const metadata: Metadata = { title: "Leave balances" };

export default async function LeaveBalancesPage({ searchParams }: PageProps<"/leave/balances">) {
  const user = await requireAuth();
  if (!canViewTeamLeave(user)) forbidden();
  const sp = await searchParams;
  const currentYear = Number(todayIn("UTC").slice(0, 4));
  const year = Number(first(sp.year)) || currentYear;
  const department = first(sp.department);
  const params: Record<string, string> = department
    ? { department, year: String(year) }
    : { year: String(year) };
  const canAdjust = can(user, "leave:manage");

  const [employees, types, departments] = await Promise.all([
    db.employee.findMany({
      where: {
        ...employeeAccessWhere(user, "leave:read"),
        deletedAt: null,
        employmentStatus: { not: "TERMINATED" },
        ...(department ? { departmentId: department } : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    db.leaveType.findMany({
      where: { isActive: true, annualAllowance: { gt: 0 } },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const ids = employees.map((e) => e.id);
  const [balances, pending] = await Promise.all([
    db.leaveBalance.findMany({ where: { employeeId: { in: ids }, year } }),
    db.leaveRequest.groupBy({
      by: ["employeeId", "leaveTypeId"],
      where: {
        employeeId: { in: ids },
        status: { in: ["PENDING", "MANAGER_APPROVED"] },
        startDate: { gte: fromDateKey(`${year}-01-01`), lte: fromDateKey(`${year}-12-31`) },
      },
      _sum: { days: true },
    }),
  ]);
  const month =
    year === currentYear ? Number(todayIn("UTC").slice(5, 7)) : year < currentYear ? 12 : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leave"
        description={`Balances for ${year}: available days (used / allocated).`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link
                href={hrefWith("/leave/balances", params, { year: year - 1 })}
                aria-label="Previous year"
              >
                <ChevronLeft />
              </Link>
            </Button>
            <span className="w-12 text-center text-sm font-medium">{year}</span>
            <Button variant="outline" size="icon" asChild>
              <Link
                href={hrefWith("/leave/balances", params, { year: year + 1 })}
                aria-label="Next year"
              >
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />
      <LeaveTabs active="balances" showTeam />
      <FilterSelect
        param="department"
        label="Departments"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />
      {employees.length === 0 || types.length === 0 ? (
        <EmptyState icon={Users} title="Nothing to show" />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Employee</TableHead>
                  {types.map((t) => (
                    <TableHead key={t.id} className="pr-6 text-right">
                      {t.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-6 font-medium">{fullName(e)}</TableCell>
                    {types.map((t) => {
                      const b = balances.find(
                        (x) => x.employeeId === e.id && x.leaveTypeId === t.id,
                      );
                      const allocated = Number(b?.allocated ?? 0);
                      const carried = Number(b?.carriedOver ?? 0);
                      const used = Number(b?.used ?? 0);
                      const pend = Number(
                        pending.find((p) => p.employeeId === e.id && p.leaveTypeId === t.id)?._sum
                          .days ?? 0,
                      );
                      const available = availableDays(
                        {
                          allocated: accruedDays(allocated, t.accrualPeriod, month),
                          carriedOver: carried,
                          used,
                        },
                        pend,
                      );
                      const label = (
                        <span className="tabular-nums">
                          <span className="font-medium">{b ? available : "—"}</span>{" "}
                          <span className="text-muted-foreground text-xs">
                            ({used}/{allocated + carried})
                          </span>
                        </span>
                      );
                      return (
                        <TableCell key={t.id} className="pr-6 text-right">
                          {canAdjust ? (
                            <AdjustBalanceDialog
                              employeeId={e.id}
                              employeeName={fullName(e)}
                              leaveTypeId={t.id}
                              leaveTypeName={t.name}
                              year={year}
                              allocated={allocated}
                              carriedOver={carried}
                              used={used}
                            >
                              {label}
                            </AdjustBalanceDialog>
                          ) : (
                            label
                          )}
                        </TableCell>
                      );
                    })}
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
