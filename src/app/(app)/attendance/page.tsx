import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Clock } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DAY_STATUS_STYLES, Legend } from "@/components/time/day-colors";
import { MonthNav } from "@/components/time/month-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fromDateKey, isMonthKey } from "@/lib/domain/dates";
import { formatDate, formatDateTime } from "@/lib/format";
import { first } from "@/lib/list-params";
import { can } from "@/lib/rbac/authorize";
import { canViewTeamAttendance, getToday, monthlyAttendance } from "@/lib/services/attendance";
import { cn } from "@/lib/utils";

import { AttendanceTabs } from "./attendance-tabs";
import { ClockCard } from "./clock-card";
import { CorrectionDialog } from "./correction-dialog";

export const metadata: Metadata = { title: "Attendance" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const user = await requireAuth();
  if (!can(user, "attendance:record") && !can(user, "attendance:read")) forbidden();
  const showTeam = canViewTeamAttendance(user);

  const today = await getToday(user);
  if (!today) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Attendance" />
        <AttendanceTabs active="me" showTeam={showTeam} />
        <EmptyState
          icon={Clock}
          title="No employee record"
          description="Your account isn't linked to an employee, so there's no personal attendance to show."
        />
      </div>
    );
  }

  const requested = first((await searchParams).month);
  const month = requested && isMonthKey(requested) ? requested : today.today.slice(0, 7);
  const [mine] = await monthlyAttendance(user, month, { employeeId: user.employeeId! });
  const corrections = await db.attendanceCorrection.findMany({
    where: { employeeId: user.employeeId! },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const days = mine?.days ?? [];
  const leadingBlanks = days.length ? (fromDateKey(days[0]!.date).getUTCDay() + 6) % 7 : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Attendance"
        description="Clock in and out, and review your attendance history."
        actions={<CorrectionDialog defaultDate={today.today} />}
      />
      <AttendanceTabs active="me" showTeam={showTeam} />

      <div className="grid gap-6 lg:grid-cols-3">
        <ClockCard
          timezone={today.timezone}
          today={today.today}
          clockIn={today.record?.clockIn?.toISOString() ?? null}
          clockOut={today.record?.clockOut?.toISOString() ?? null}
          status={today.record?.status ?? null}
        />
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>This month</CardTitle>
              {mine && (
                <CardDescription>
                  {mine.summary.present} days worked · {mine.summary.late} late · {mine.summary.absent} absent ·{" "}
                  {mine.summary.onLeave} on leave · {mine.summary.hours} h
                </CardDescription>
              )}
            </div>
            <MonthNav pathname="/attendance" params={{}} month={month} />
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-muted-foreground py-1 font-medium">
                  {d}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((day) => (
                <div
                  key={day.date}
                  title={`${formatDate(day.date)}: ${DAY_STATUS_STYLES[day.status]?.label}${day.hours ? ` (${day.hours} h)` : ""}`}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-md border text-sm",
                    DAY_STATUS_STYLES[day.status]?.cell,
                    day.date === today.today && "ring-primary ring-2",
                  )}
                >
                  <span className="font-medium">{Number(day.date.slice(8))}</span>
                  {day.hours !== null && <span className="text-[10px] opacity-80">{day.hours}h</span>}
                </div>
              ))}
            </div>
            <Legend statuses={["PRESENT", "REMOTE", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY", "WEEKEND"]} />
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardHeader className="pt-6">
          <CardTitle>My correction requests</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {corrections.length === 0 ? (
            <p className="text-muted-foreground px-6 pb-6 text-sm">No correction requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6">{formatDate(c.date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.requestedStatus} />{" "}
                      <span className="text-muted-foreground text-xs">
                        {c.requestedClockIn ? new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: today.timezone }).format(c.requestedClockIn) : ""}
                        {c.requestedClockOut ? ` – ${new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: today.timezone }).format(c.requestedClockOut)}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 truncate whitespace-normal">{c.reason}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(c.createdAt)}</TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge status={c.status} />
                      {c.reviewComment && <p className="text-muted-foreground mt-1 text-xs">“{c.reviewComment}”</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
