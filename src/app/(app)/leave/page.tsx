import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { CalendarDays, X } from "lucide-react";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { todayIn, toDateKey } from "@/lib/domain/dates";
import { isCancellable } from "@/lib/domain/leave";
import { formatDate, formatDays, fullName } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { canViewTeamLeave, getBalances } from "@/lib/services/leave";

import { cancelLeaveRequestAction } from "./actions";
import { LeaveTabs } from "./leave-tabs";
import { RequestLeaveDialog } from "./request-leave-dialog";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  const user = await requireAuth();
  if (!can(user, "leave:request") && !can(user, "leave:read")) forbidden();
  const showTeam = canViewTeamLeave(user);

  if (!user.employeeId) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Leave" />
        <LeaveTabs active="me" showTeam={showTeam} />
        <EmptyState
          icon={CalendarDays}
          title="No employee record"
          description="Your account isn't linked to an employee, so you have no leave of your own."
        />
      </div>
    );
  }

  const employee = await db.employee.findUnique({
    where: { id: user.employeeId },
    include: { location: { select: { timezone: true } } },
  });
  const today = todayIn(employee?.location?.timezone ?? "UTC");
  const year = Number(today.slice(0, 4));
  const [balances, requests, types] = await Promise.all([
    getBalances(user.employeeId, year),
    db.leaveRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { startDate: "desc" },
      take: 50,
      include: {
        leaveType: { select: { name: true } },
        approver: { select: { firstName: true, lastName: true } },
        managerApprover: { select: { firstName: true, lastName: true } },
      },
    }),
    db.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leave"
        description="Your balances and time-off requests."
        actions={
          can(user, "leave:request") && (
            <RequestLeaveDialog
              types={types.map((t) => ({ value: t.id, label: t.name }))}
              today={today}
            />
          )
        }
      />
      <LeaveTabs active="me" showTeam={showTeam} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <Card key={b.leaveTypeId} className="gap-2">
            <CardHeader>
              <CardDescription>{b.name}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatDays(b.available)}{" "}
                <span className="text-muted-foreground text-sm font-normal">available</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground grid gap-0.5 text-xs">
              <span>
                {b.accrualPeriod === "MONTHLY"
                  ? `${b.accrued} of ${b.allocated} accrued`
                  : `${b.allocated} allocated`}
                {b.carriedOver ? ` + ${b.carriedOver} carried over` : ""}
              </span>
              <span>
                {b.used} used{b.pending ? ` · ${b.pending} pending` : ""}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="py-0">
        <CardHeader className="pt-6">
          <CardTitle>My requests</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {requests.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No leave requests yet" className="mx-6 mb-6" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="w-12 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const decidedBy = r.approver ?? r.managerApprover;
                  const comment = r.decisionComment ?? r.managerComment;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-medium">{r.leaveType.name}</TableCell>
                      <TableCell>
                        {formatDate(r.startDate)}
                        {r.startHalfDay ? " (pm)" : ""} – {formatDate(r.endDate)}
                        {r.endHalfDay ? " (am)" : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.days)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={r.status}
                          label={r.status === "MANAGER_APPROVED" ? "Awaiting HR" : undefined}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-56 text-xs whitespace-normal">
                        {decidedBy ? fullName(decidedBy) : ""}
                        {comment ? ` — “${comment}”` : ""}
                      </TableCell>
                      <TableCell className="pr-6">
                        {isCancellable(r.status, toDateKey(r.startDate), today) && (
                          <ConfirmAction
                            title="Cancel this request?"
                            description={`${r.leaveType.name}, ${formatDate(r.startDate)} – ${formatDate(r.endDate)}.${r.status === "APPROVED" ? " The days will be returned to your balance." : ""}`}
                            confirmLabel="Cancel request"
                            destructive
                            action={cancelLeaveRequestAction.bind(null, { id: r.id })}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="Cancel request">
                                <X />
                              </Button>
                            }
                          />
                        )}
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
