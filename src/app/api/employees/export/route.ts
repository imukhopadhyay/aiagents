import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/domain/csv";
import { toDateKey } from "@/lib/domain/dates";
import { can } from "@/lib/rbac/authorize";
import { employeeListWhere } from "@/lib/services/employees";

// Exports the directory with the same filters and access scope as the list page.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user, "employee:read")) return new Response("Forbidden", { status: 403 });

  const p = request.nextUrl.searchParams;
  const employees = await db.employee.findMany({
    where: employeeListWhere(user, {
      q: p.get("q") ?? undefined,
      departmentId: p.get("department") ?? undefined,
      locationId: p.get("location") ?? undefined,
      status: p.get("status") ?? undefined,
    }),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10_000,
    include: {
      department: { select: { code: true } },
      position: { select: { code: true } },
      location: { select: { name: true } },
      manager: { select: { employeeNumber: true } },
    },
  });

  const csv = toCsv([
    [
      "employee_number",
      "first_name",
      "last_name",
      "work_email",
      "department_code",
      "position_code",
      "location",
      "manager_employee_number",
      "employment_type",
      "employment_status",
      "hire_date",
      "termination_date",
      "phone",
    ],
    ...employees.map((e) => [
      e.employeeNumber,
      e.firstName,
      e.lastName,
      e.workEmail,
      e.department?.code,
      e.position?.code,
      e.location?.name,
      e.manager?.employeeNumber,
      e.employmentType,
      e.employmentStatus,
      toDateKey(e.hireDate),
      e.terminationDate ? toDateKey(e.terminationDate) : "",
      e.phone,
    ]),
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${toDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
