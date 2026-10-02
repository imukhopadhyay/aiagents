import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { orgOptions } from "@/lib/services/org";

import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage() {
  await requirePermission("recruitment:manage");
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="New job" description="Jobs start as drafts. Publish when you're ready to add candidates." />
      <JobForm options={await orgOptions()} />
    </div>
  );
}
