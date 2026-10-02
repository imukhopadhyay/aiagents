import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/authorize";
import { orgOptions } from "@/lib/services/org";

import { EmployeeForm } from "../employee-form";

export const metadata: Metadata = { title: "New employee" };

export default async function NewEmployeePage() {
  const user = await requirePermission("employee:create");
  const options = await orgOptions();
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="New employee" description="Add someone to the organization and invite them to sign in." />
      <EmployeeForm options={options} canAssignRoles={can(user, "user:manage")} />
    </div>
  );
}
