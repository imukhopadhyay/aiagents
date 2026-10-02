import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Download, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { DAY_STATUS_STYLES, Legend } from "@/components/time/day-colors";
import { MonthNav } from "@/components/time/month-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isMonthKey, todayIn } from "@/lib/domain/dates";
import { formatDate, formatMonth, fullName } from "@/lib/format";
import { first, hrefWith } from "@/lib/list-params";
import { canViewTeamAttendance, monthlyAttendance } from "@/lib/services/attendance";
import { cn } from "@/lib/utils";

import { AttendanceTabs } from "../attendance-tabs";

export const metadata: Metadata = { title: "Attendance report" };

const SHORT: Record<string, string> = {
  PRESENT: "P",
  REMOTE: "R",
  LATE: "L",
  HALF_DAY: "½",
  ABSENT: "A",
  ON_LEAVE: "V",
  HOLIDAY: "H",
  WEEKEND: "",
  FUTURE: "",
  NONE: "",
};

export default async function AttendanceReportPage({
  searchParams,
}: PageProps<"/attendance/report">) {
  const user = await requireAuth();
  if (!canViewTeamAttendance(user)) forbidden();
  const sp = await searchParams;
  const requested = first(sp.month);
  const month = requested && isMonthKey(requested) ? requested : todayIn("UTC").slice(0, 7);
  const department = first(sp.department);
  const params: Record<string, string> = department ? { department, month } : { month };

  const [rows, departments] = await Promise.all([
    monthlyAttendance(user, month, { departmentId: department }),
    db.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const days = rows[0]?.days.map((d) => d.date) ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Attendance"
        description={`Monthly summary for ${formatMonth(month)}.`}
        actions={
          <>
            <MonthNav pathname="/attendance/report" params={params} month={month} />
            <Button variant="outline" asChild>
              <a href={hrefWith("/api/attendance/export", params, {})} download>
                <Download /> Export CSV
              </a>
            </Button>
          </>
        }
      />
      <AttendanceTabs active="report" showTeam />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterSelect
          param="department"
          label="Departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <Legend statuses={["PRESENT", "REMOTE", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY"]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No one in scope" />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className="bg-card sticky left-0 z-10 min-w-44 px-4 py-2 text-left text-sm font-medium">
                    Employee
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="text-muted-foreground min-w-7 px-0.5 py-2 text-center font-normal"
                    >
                      {Number(d.slice(8))}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium">Worked</th>
                  <th className="px-2 py-2 text-right font-medium">Late</th>
                  <th className="px-2 py-2 text-right font-medium">Absent</th>
                  <th className="px-2 py-2 text-right font-medium">Leave</th>
                  <th className="px-4 py-2 text-right font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee, days: cells, summary }) => (
                  <tr key={employee.id} className="border-b last:border-0">
                    <td className="bg-card sticky left-0 z-10 px-4 py-2 text-sm font-medium whitespace-nowrap">
                      {fullName(employee)}
                    </td>
                    {cells.map((c) => (
                      <td key={c.date} className="px-0.5 py-1">
                        <div
                          title={`${formatDate(c.date)}: ${DAY_STATUS_STYLES[c.status]?.label}`}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-sm font-medium",
                            DAY_STATUS_STYLES[c.status]?.cell,
                          )}
                        >
                          {SHORT[c.status]}
                        </div>
                      </td>
                    ))}
                    <td className="px-2 text-right tabular-nums">{summary.present}</td>
                    <td className="px-2 text-right tabular-nums">{summary.late}</td>
                    <td className="px-2 text-right tabular-nums">{summary.absent}</td>
                    <td className="px-2 text-right tabular-nums">{summary.onLeave}</td>
                    <td className="px-4 text-right tabular-nums">{summary.hours}</td>
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
