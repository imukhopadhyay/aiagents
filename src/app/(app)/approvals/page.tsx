import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { CheckSquare } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { formatDate, formatDays, fullName } from "@/lib/format";
import { first } from "@/lib/list-params";
import { pendingCorrections } from "@/lib/services/attendance";
import { pendingLeaveApprovals } from "@/lib/services/leave";
import { cn } from "@/lib/utils";

import { reviewCorrectionAction } from "../attendance/actions";
import { decideLeaveRequestAction } from "../leave/actions";
import { DecisionButtons } from "./decision-dialog";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: PageProps<"/approvals">) {
  const user = await requireAuth();
  const canLeave = Boolean(user.permissions["leave:approve"]);
  const canAttendance = Boolean(user.permissions["attendance:manage"]);
  if (!canLeave && !canAttendance) forbidden();

  const requestedTab = first((await searchParams).tab);
  const tab = requestedTab === "attendance" && canAttendance ? "attendance" : canLeave ? "leave" : "attendance";
  const [leave, corrections] = await Promise.all([pendingLeaveApprovals(user), pendingCorrections(user)]);
  const isHr = user.permissions["leave:approve"] === "ALL";

  const tabs = [
    ...(canLeave ? [{ key: "leave", label: "Leave", count: leave.length }] : []),
    ...(canAttendance ? [{ key: "attendance", label: "Attendance corrections", count: corrections.length }] : []),
  ];
  const time = (d: Date | null, tz: string) => (d ? new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: tz }).format(d) : "—");

  return (
    <div className="grid gap-6">
      <PageHeader title="Approvals" description="Requests waiting for your decision." />
      <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center rounded-lg p-[3px]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/approvals?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium",
              tab === t.key ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">{t.count}</span>}
          </Link>
        ))}
      </div>

      {tab === "leave" &&
        (leave.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No leave requests to review" description="You're all caught up." />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Employee</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="pr-6 text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leave.map((r) => {
                    const summary = `${fullName(r.employee)} · ${r.leaveType.name} · ${formatDate(r.startDate)} – ${formatDate(r.endDate)} (${formatDays(Number(r.days))})`;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={fullName(r.employee)} photoUrl={r.employee.photoUrl} />
                            <span className="font-medium">{fullName(r.employee)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.leaveType.name}
                          {r.reason && <p className="text-muted-foreground max-w-56 truncate text-xs">“{r.reason}”</p>}
                        </TableCell>
                        <TableCell>
                          {formatDate(r.startDate)} – {formatDate(r.endDate)}
                          <p className="text-muted-foreground text-xs">{formatDays(Number(r.days))}</p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} label={r.status === "PENDING" ? "Manager review" : "HR review"} />
                          {r.managerApprover && (
                            <p className="text-muted-foreground mt-1 text-xs">Approved by {fullName(r.managerApprover)}</p>
                          )}
                        </TableCell>
                        <TableCell className="pr-6">
                          <DecisionButtons
                            id={r.id}
                            summary={summary}
                            approveLabel={isHr ? "Approve" : "Approve and send to HR"}
                            action={decideLeaveRequestAction}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {tab === "attendance" &&
        (corrections.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No corrections to review" description="You're all caught up." />
        ) : (
          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="pr-6 text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c) => {
                    const tz = c.employee.location?.timezone ?? "UTC";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <PersonAvatar name={fullName(c.employee)} photoUrl={c.employee.photoUrl} />
                            <span className="font-medium">{fullName(c.employee)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(c.date)}</TableCell>
                        <TableCell className="text-xs">
                          {c.attendanceRecord ? (
                            <>
                              <StatusBadge status={c.attendanceRecord.status} />{" "}
                              {time(c.attendanceRecord.clockIn, tz)} – {time(c.attendanceRecord.clockOut, tz)}
                            </>
                          ) : (
                            <span className="text-muted-foreground">No record</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <StatusBadge status={c.requestedStatus} /> {time(c.requestedClockIn, tz)} – {time(c.requestedClockOut, tz)}
                        </TableCell>
                        <TableCell className="max-w-56 text-xs whitespace-normal">{c.reason}</TableCell>
                        <TableCell className="pr-6">
                          <DecisionButtons
                            id={c.id}
                            summary={`${fullName(c.employee)} · ${formatDate(c.date)}`}
                            action={reviewCorrectionAction}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
