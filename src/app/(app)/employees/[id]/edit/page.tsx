import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toDateKey } from "@/lib/domain/dates";
import { fullName } from "@/lib/format";
import { orgOptions } from "@/lib/services/org";

import { EmployeeForm } from "../../employee-form";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: PageProps<"/employees/[id]/edit">) {
  const { id } = await params;
  await requirePermission("employee:update", { employeeId: id });

  const employee = await db.employee.findFirst({ where: { id, deletedAt: null } });
  if (!employee) notFound();
  if (employee.employmentStatus === "TERMINATED") redirect(`/employees/${id}`);
  const options = await orgOptions();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={`Edit ${fullName(employee)}`} />
      <EmployeeForm
        options={options}
        canAssignRoles={false}
        employee={{
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          workEmail: employee.workEmail,
          personalEmail: employee.personalEmail,
          phone: employee.phone,
          dateOfBirth: employee.dateOfBirth ? toDateKey(employee.dateOfBirth) : null,
          address: employee.address,
          employeeNumber: employee.employeeNumber,
          departmentId: employee.departmentId,
          positionId: employee.positionId,
          locationId: employee.locationId,
          managerId: employee.managerId,
          employmentStatus: employee.employmentStatus as "ACTIVE",
          employmentType: employee.employmentType,
          hireDate: toDateKey(employee.hireDate),
        }}
      />
    </div>
  );
}
