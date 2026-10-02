import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { orgOptions } from "@/lib/services/org";

import { JobForm } from "../../../job-form";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: PageProps<"/recruitment/jobs/[id]/edit">) {
  const { id } = await params;
  await requirePermission("recruitment:manage");
  const job = await db.jobOpening.findFirst({ where: { id, deletedAt: null } });
  if (!job) notFound();
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={`Edit ${job.title}`} />
      <JobForm
        options={await orgOptions()}
        job={{
          id: job.id,
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          departmentId: job.departmentId,
          positionId: job.positionId,
          locationId: job.locationId,
          hiringManagerId: job.hiringManagerId,
          employmentType: job.employmentType,
          headcount: job.headcount,
        }}
      />
    </div>
  );
}
