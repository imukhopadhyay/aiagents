import type { Metadata } from "next";
import Link from "next/link";
import {
  Briefcase,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Clock,
  UserPlus,
  Users,
  Video,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type CurrentUser, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addDays, fromDateKey, todayIn } from "@/lib/domain/dates";
import { formatDate, formatDateTime, formatDays, fullName, labelize } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { getToday, pendingCorrections } from "@/lib/services/attendance";
import { employeeAccessWhere } from "@/lib/services/employees";
import { getBalances, pendingLeaveApprovals } from "@/lib/services/leave";
import { recruitmentMetrics } from "@/lib/services/recruitment";

import { ClockCard } from "../attendance/clock-card";

export const metadata: Metadata = { title: "Dashboard" };

const ACTION_VERBS: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "archived",
  RESTORE: "restored",
  APPROVE: "approved",
  REJECT: "rejected",
  PASSWORD_RESET: "reset the password for",
};

// Entity names that read better than the split model name.
const ACTIVITY_LABELS: Record<string, string> = {
  JobOpening: "job",
  EmployeeDocument: "employee document",
  AttendanceRecord: "attendance",
};

async function peopleStats(user: CurrentUser, today: string) {
  const scope = user.permissions["employee:read"];
  if (scope !== "TEAM" && scope !== "ALL") return null;
  const where = {
    ...employeeAccessWhere(user, "employee:read"),
    deletedAt: null,
    employmentStatus: { not: "TERMINATED" as const },
  };
  const [headcount, newHires, onLeave] = await Promise.all([
    db.employee.count({ where }),
    db.employee.count({ where: { ...where, hireDate: { gte: fromDateKey(addDays(today, -30)) } } }),
    db.leaveRequest.count({
      where: {
        status: "APPROVED",
        startDate: { lte: fromDateKey(today) },
        endDate: { gte: fromDateKey(today) },
        employee: where,
      },
    }),
  ]);
  return { scope, headcount, newHires, onLeave };
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard:view");
  const today = todayIn("UTC");

  const [
    people,
    leaveQueue,
    correctionQueue,
    recruiting,
    attendanceToday,
    balances,
    myInterviews,
    upcomingLeave,
    activity,
  ] = await Promise.all([
    peopleStats(user, today),
    pendingLeaveApprovals(user),
    pendingCorrections(user),
    can(user, "recruitment:read") ? recruitmentMetrics() : null,
    can(user, "attendance:record") ? getToday(user) : null,
    user.employeeId && can(user, "leave:request")
      ? getBalances(user.employeeId, Number(today.slice(0, 4)))
      : [],
    user.employeeId
      ? db.interview.findMany({
          where: {
            status: "SCHEDULED",
            scheduledAt: { gte: new Date() },
            interviewers: { some: { id: user.employeeId } },
          },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          include: {
            application: {
              include: {
                candidate: { select: { firstName: true, lastName: true } },
                jobOpening: { select: { title: true, location: { select: { timezone: true } } } },
              },
            },
          },
        })
      : [],
    user.employeeId
      ? db.leaveRequest.findMany({
          where: {
            employeeId: user.employeeId,
            status: { in: ["PENDING", "MANAGER_APPROVED", "APPROVED"] },
            endDate: { gte: fromDateKey(today) },
          },
          orderBy: { startDate: "asc" },
          take: 3,
          include: { leaveType: { select: { name: true } } },
        })
      : [],
    can(user, "audit:read")
      ? db.auditLog.findMany({
          where: { action: { notIn: ["LOGIN", "LOGIN_FAILED", "LOGOUT"] } },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { actor: { select: { name: true, email: true } } },
        })
      : db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
  ]);

  const approvals = leaveQueue.length + correctionQueue.length;
  const canApprove = Boolean(
    user.permissions["leave:approve"] || user.permissions["attendance:manage"],
  );
  const pipelineMax = recruiting ? Math.max(1, ...recruiting.pipeline.map((p) => p.count)) : 1;

  const quickActions = [
    can(user, "leave:request") &&
      user.employeeId && { href: "/leave", label: "Request leave", icon: CalendarPlus },
    can(user, "employee:create") && {
      href: "/employees/new",
      label: "Add employee",
      icon: UserPlus,
    },
    can(user, "recruitment:manage") && {
      href: "/recruitment/jobs/new",
      label: "Post a job",
      icon: Briefcase,
    },
    canApprove && { href: "/approvals", label: "Review approvals", icon: CheckSquare },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Users }[];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(
          fromDateKey(today),
        )}
        actions={quickActions.map((a) => (
          <Button key={a.href} variant="outline" asChild>
            <Link href={a.href}>
              <a.icon /> {a.label}
            </Link>
          </Button>
        ))}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
        {people && (
          <>
            <StatCard
              title={people.scope === "ALL" ? "Headcount" : "Team size"}
              value={people.headcount}
              hint={people.scope === "ALL" ? "Current employees" : "You and your reports"}
              icon={Users}
              href="/employees"
            />
            <StatCard
              title="New hires"
              value={people.newHires}
              hint="Last 30 days"
              icon={UserPlus}
              href="/employees?sort=hireDate&dir=desc"
            />
            <StatCard
              title="On leave today"
              value={people.onLeave}
              hint="Approved leave"
              icon={CalendarDays}
              href="/leave/calendar"
            />
          </>
        )}
        {recruiting && (
          <StatCard
            title="Open positions"
            value={recruiting.openPositions}
            hint={`Across ${recruiting.openJobs} open job${recruiting.openJobs === 1 ? "" : "s"}`}
            icon={Briefcase}
            href="/recruitment"
          />
        )}
        {canApprove && (
          <StatCard
            title="Pending approvals"
            value={approvals}
            hint={`${leaveQueue.length} leave · ${correctionQueue.length} attendance`}
            icon={CheckSquare}
            href="/approvals"
          />
        )}
        {!people &&
          balances
            .slice(0, 2)
            .map((b) => (
              <StatCard
                key={b.leaveTypeId}
                title={b.name}
                value={formatDays(b.available)}
                hint="Available"
                icon={CalendarDays}
                href="/leave"
              />
            ))}
        {!people && myInterviews.length > 0 && (
          <StatCard
            title="Your interviews"
            value={myInterviews.length}
            hint="Upcoming"
            icon={Video}
          />
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {attendanceToday && (
          <ClockCard
            timezone={attendanceToday.timezone}
            today={attendanceToday.today}
            clockIn={attendanceToday.record?.clockIn?.toISOString() ?? null}
            clockOut={attendanceToday.record?.clockOut?.toISOString() ?? null}
            status={attendanceToday.record?.status ?? null}
          />
        )}

        {user.employeeId && (
          <Card>
            <CardHeader>
              <CardTitle>Your time off</CardTitle>
              <CardDescription>
                {balances.length
                  ? balances.map((b) => `${b.name}: ${b.available}`).join(" · ")
                  : "No leave balances for this year."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {upcomingLeave.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming leave.</p>
              ) : (
                upcomingLeave.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {r.leaveType.name} · {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </span>
                    <StatusBadge
                      status={r.status}
                      label={r.status === "MANAGER_APPROVED" ? "Awaiting HR" : undefined}
                    />
                  </div>
                ))
              )}
              <Button variant="link" className="h-auto justify-start p-0" asChild>
                <Link href="/leave">Go to leave</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {myInterviews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your upcoming interviews</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {myInterviews.map((i) => (
                <Link
                  key={i.id}
                  href={`/interviews/${i.id}`}
                  className="hover:bg-muted/60 -mx-2 grid rounded-md px-2 py-1 text-sm"
                >
                  <span className="font-medium">{fullName(i.application.candidate)}</span>
                  <span className="text-muted-foreground text-xs">
                    {i.application.jobOpening.title} ·{" "}
                    {formatDateTime(
                      i.scheduledAt,
                      i.application.jobOpening.location?.timezone ?? "UTC",
                    )}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {recruiting && (
          <Card>
            <CardHeader>
              <CardTitle>Hiring pipeline</CardTitle>
              <CardDescription>
                Candidates in open jobs
                {recruiting.avgTimeToHire !== null
                  ? ` · ${recruiting.avgTimeToHire} days average time to hire`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recruiting.pipeline.every((p) => p.count === 0) ? (
                <p className="text-muted-foreground text-sm">No active candidates in open jobs.</p>
              ) : (
                <ul className="grid gap-3" aria-label="Candidates by stage">
                  {recruiting.pipeline.map((p) => (
                    <li
                      key={p.stage}
                      className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm"
                      title={`${p.label}: ${p.count} candidate${p.count === 1 ? "" : "s"}`}
                    >
                      <span className="text-muted-foreground">{p.label}</span>
                      <span className="bg-muted h-2 overflow-hidden rounded-full">
                        <span
                          className="bg-chart-2 block h-full rounded-full"
                          style={{ width: `${(p.count / pipelineMax) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-medium tabular-nums">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {canApprove && approvals > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Waiting for you</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {leaveQueue.slice(0, 4).map((r) => (
                <Link
                  key={r.id}
                  href="/approvals"
                  className="hover:bg-muted/60 -mx-2 flex justify-between gap-2 rounded-md px-2 py-1"
                >
                  <span>
                    {fullName(r.employee)} · {r.leaveType.name}
                  </span>
                  <span className="text-muted-foreground">{formatDate(r.startDate)}</span>
                </Link>
              ))}
              {correctionQueue.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  href="/approvals?tab=attendance"
                  className="hover:bg-muted/60 -mx-2 flex justify-between gap-2 rounded-md px-2 py-1"
                >
                  <span>{fullName(c.employee)} · attendance correction</span>
                  <span className="text-muted-foreground">{formatDate(c.date)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className={activity.length ? "lg:col-span-1" : "hidden"}>
          <CardHeader>
            <CardTitle>
              {can(user, "audit:read") ? "Recent activity" : "Recent notifications"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm">
              {activity.map((item) =>
                "action" in item ? (
                  <li key={item.id} className="grid">
                    <span>
                      <span className="font-medium">
                        {item.actor?.name ?? item.actor?.email ?? "System"}
                      </span>{" "}
                      {ACTION_VERBS[item.action] ?? labelize(item.action).toLowerCase()}{" "}
                      {ACTIVITY_LABELS[item.entity] ??
                        item.entity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </li>
                ) : (
                  <li key={item.id} className="grid">
                    {item.link ? (
                      <Link href={item.link} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{item.title}</span>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </li>
                ),
              )}
            </ol>
          </CardContent>
        </Card>
      </div>

      {!attendanceToday && !people && !recruiting && (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-2 text-sm">
            <Clock className="size-4" /> Your account isn&apos;t linked to an employee record, so
            there&apos;s no personal data to show.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
