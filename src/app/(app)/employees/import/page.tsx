import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";

import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import employees" };

export default async function ImportEmployeesPage() {
  await requirePermission("employee:create");
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader title="Import employees" description="Add many employees at once from a CSV file." />
      <ImportWizard />
    </div>
  );
}
