import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { DAY_STATUS_STYLES } from "@/components/time/day-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addDays, isDateKey, todayIn } from "@/lib/domain/dates";
import { formatDate, fullName } from "@/lib/format";
import { first, hrefWith } from "@/lib/list-params";
import { canViewTeamAttendance, dailyAttendance } from "@/lib/services/attendance";
import { cn } from "@/lib/utils";

import { AttendanceTabs } from "../attendance-tabs";

export const metadata: Metadata = { title: "Daily attendance" };

export default async function TeamAttendancePage({ searchParams }: PageProps<"/attendance/team">) {
  const user = await requireAuth();
  if (!canViewTeamAttendance(user)) forbidden();
  const sp = await searchParams;
  const requested = first(sp.date);
  const date = requested && isDateKey(requested) ? requested : todayIn("UTC");
  const department = first(sp.department);
  const params: Record<string, string> = department ? { department, date } : { date };

  const [rows, departments] = await Promise.all([
    dailyAttendance(user, date, department),
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.day.status] = (acc[r.day.status] ?? 0) + 1;
    return acc;
  }, {});
  const time = (d: Date | null, tz: string) => (d ? new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: tz }).format(d) : "—");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Attendance"
        description={`Who's in on ${formatDate(date)}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link href={hrefWith("/attendance/team", params, { date: addDays(date, -1) })} aria-label="Previous day">
                <ChevronLeft />
              </Link>
            </Button>
            <form className="contents">
              {department && <input type="hidden" name="department" value={department} />}
              <input
                type="date"
                name="date"
                defaultValue={date}
                aria-label="Date"
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
              />
              <Button type="submit" variant="outline">
                Go
              </Button>
            </form>
            <Button variant="outline" size="icon" asChild>
              <Link href={hrefWith("/attendance/team", params, { date: addDays(date, 1) })} aria-label="Next day">
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />
      <AttendanceTabs active="team" showTeam />
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect param="department" label="Departments" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        {Object.entries(counts).map(([status, n]) => (
          <Badge key={status} variant="outline" className={cn("border-transparent", DAY_STATUS_STYLES[status]?.cell)}>
            {DAY_STATUS_STYLES[status]?.label}: {n}
          </Badge>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No one in scope" />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead className="pr-6 text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ employee, day, notes }) => {
                  const tz = employee.location?.timezone ?? "UTC";
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={fullName(employee)} photoUrl={employee.photoUrl} />
                          <span className="font-medium">{fullName(employee)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{employee.department?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("border-transparent", DAY_STATUS_STYLES[day.status]?.cell)}>
                          {DAY_STATUS_STYLES[day.status]?.label}
                        </Badge>
                        {notes && <p className="text-muted-foreground mt-1 text-xs">{notes}</p>}
                      </TableCell>
                      <TableCell className="tabular-nums">{time(day.clockIn, tz)}</TableCell>
                      <TableCell className="tabular-nums">{time(day.clockOut, tz)}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{day.hours ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
