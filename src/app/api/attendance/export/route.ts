import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/domain/csv";
import { isMonthKey } from "@/lib/domain/dates";
import { canViewTeamAttendance, monthlyAttendance } from "@/lib/services/attendance";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canViewTeamAttendance(user)) return new Response("Forbidden", { status: 403 });

  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!isMonthKey(month)) return new Response("month must be YYYY-MM", { status: 400 });
  const department = request.nextUrl.searchParams.get("department") ?? undefined;
  const rows = await monthlyAttendance(user, month, { departmentId: department });

  const csv = toCsv([
    ["employee_number", "name", "department", "date", "status", "clock_in", "clock_out", "hours"],
    ...rows.flatMap(({ employee, days }) =>
      days
        .filter((d) => d.status !== "FUTURE" && d.status !== "NONE")
        .map((d) => [
          employee.employeeNumber,
          `${employee.firstName} ${employee.lastName}`,
          employee.department?.name ?? "",
          d.date,
          d.status,
          d.clockIn?.toISOString() ?? "",
          d.clockOut?.toISOString() ?? "",
          d.hours ?? "",
        ]),
    ),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
