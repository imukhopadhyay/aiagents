import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { MonthNav } from "@/components/time/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eachDay, fromDateKey, isMonthKey, isWeekend, monthRange, todayIn, toDateKey } from "@/lib/domain/dates";
import { formatDate, formatMonth, fullName } from "@/lib/format";
import { first } from "@/lib/list-params";
import { employeeAccessWhere } from "@/lib/services/employees";
import { canViewTeamLeave } from "@/lib/services/leave";
import { cn } from "@/lib/utils";

import { LeaveTabs } from "../leave-tabs";

export const metadata: Metadata = { title: "Team leave calendar" };

export default async function LeaveCalendarPage({ searchParams }: PageProps<"/leave/calendar">) {
  const user = await requireAuth();
  if (!canViewTeamLeave(user)) forbidden();
  const sp = await searchParams;
  const requested = first(sp.month);
  const month = requested && isMonthKey(requested) ? requested : todayIn("UTC").slice(0, 7);
  const department = first(sp.department);
  const { start, end } = monthRange(month);

  const [employees, requests, holidays, departments] = await Promise.all([
    db.employee.findMany({
      where: {
        ...employeeAccessWhere(user, "leave:read"),
        deletedAt: null,
        employmentStatus: { not: "TERMINATED" },
        ...(department ? { departmentId: department } : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, locationId: true },
    }),
    db.leaveRequest.findMany({
      where: {
        status: { in: ["PENDING", "MANAGER_APPROVED", "APPROVED"] },
        startDate: { lte: fromDateKey(end) },
        endDate: { gte: fromDateKey(start) },
        employee: { ...employeeAccessWhere(user, "leave:read") },
      },
      include: { leaveType: { select: { name: true } } },
    }),
    db.holiday.findMany({
      where: { date: { gte: fromDateKey(start), lte: fromDateKey(end) } },
      select: { date: true, name: true, locationId: true },
    }),
    db.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const days = eachDay(start, end);
  const today = todayIn("UTC");
  const cell = new Map<string, { status: string; type: string }>();
  for (const r of requests) {
    for (const day of eachDay(toDateKey(r.startDate), toDateKey(r.endDate))) {
      if (day < start || day > end) continue;
      cell.set(`${r.employeeId}:${day}`, { status: r.status, type: r.leaveType.name });
    }
  }
  const holidayFor = (locationId: string | null, day: string) =>
    holidays.find((h) => toDateKey(h.date) === day && (h.locationId === null || h.locationId === locationId));
  const onLeaveToday = employees.filter((e) => cell.get(`${e.id}:${today}`)?.status === "APPROVED").length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leave"
        description={`Who's off in ${formatMonth(month)}${month === today.slice(0, 7) ? ` · ${onLeaveToday} on leave today` : ""}.`}
        actions={<MonthNav pathname="/leave/calendar" params={department ? { department, month } : { month }} month={month} />}
      />
      <LeaveTabs active="calendar" showTeam />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterSelect param="department" label="Departments" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <ul className="flex flex-wrap gap-3 text-xs">
          <li className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-violet-500/70" /> Approved</li>
          <li className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm border border-dashed border-violet-500 bg-violet-500/15" /> Pending</li>
          <li className="flex items-center gap-1.5"><span className="bg-muted-foreground/30 inline-block size-3 rounded-sm" /> Holiday</li>
        </ul>
      </div>
      {employees.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No one in scope" />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className="bg-card sticky left-0 z-10 min-w-44 px-4 py-2 text-left text-sm font-medium">Employee</th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={cn(
                        "min-w-7 px-0.5 py-2 text-center font-normal",
                        isWeekend(d) ? "text-muted-foreground/60" : "text-muted-foreground",
                        d === today && "text-foreground font-semibold",
                      )}
                    >
                      {Number(d.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="bg-card sticky left-0 z-10 px-4 py-2 text-sm font-medium whitespace-nowrap">{fullName(e)}</td>
                    {days.map((d) => {
                      const leave = cell.get(`${e.id}:${d}`);
                      const holiday = holidayFor(e.locationId, d);
                      const weekend = isWeekend(d);
                      return (
                        <td key={d} className="px-0.5 py-1">
                          <div
                            title={
                              leave && !weekend && !holiday
                                ? `${formatDate(d)}: ${leave.type} (${leave.status === "APPROVED" ? "approved" : "pending"})`
                                : holiday
                                  ? `${formatDate(d)}: ${holiday.name}`
                                  : formatDate(d)
                            }
                            className={cn(
                              "h-6 rounded-sm",
                              weekend && "bg-muted/60",
                              holiday && "bg-muted-foreground/30",
                              leave && !weekend && !holiday &&
                                (leave.status === "APPROVED"
                                  ? "bg-violet-500/70"
                                  : "border border-dashed border-violet-500 bg-violet-500/15"),
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
