import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { Stage } from "@/lib/domain/recruitment";
import { formatDate, fullName, labelize } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";

import { AddCandidateDialog } from "./add-candidate-dialog";
import { JobStatusButtons } from "./job-status-buttons";
import { type PipelineCard, PipelineBoard } from "./pipeline-board";

export const metadata: Metadata = { title: "Job" };

export default async function JobPage({ params }: PageProps<"/recruitment/jobs/[id]">) {
  const { id } = await params;
  const user = await requirePermission("recruitment:read");
  const job = await db.jobOpening.findFirst({
    where: { id, deletedAt: null },
    include: {
      department: { select: { name: true } },
      position: { select: { title: true } },
      location: { select: { name: true } },
      hiringManager: { select: { firstName: true, lastName: true } },
      applications: {
        orderBy: { stageChangedAt: "desc" },
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, email: true, tags: true } },
          interviews: { select: { id: true, feedback: { select: { rating: true } } } },
        },
      },
    },
  });
  if (!job) notFound();
  const canManage = can(user, "recruitment:manage");

  const cards: PipelineCard[] = job.applications.map((a) => {
    const ratings = a.interviews.flatMap((i) => i.feedback.map((f) => f.rating));
    return {
      id: a.id,
      stage: a.stage as Stage,
      candidateId: a.candidate.id,
      name: fullName(a.candidate),
      email: a.candidate.email,
      tags: a.candidate.tags,
      appliedAt: a.appliedAt.toISOString(),
      interviews: a.interviews.length,
      avgRating: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null,
      rejectionReason: a.rejectionReason,
    };
  });

  const available = canManage
    ? await db.candidate.findMany({
        where: { deletedAt: null, hiredAsEmployeeId: null, applications: { none: { jobOpeningId: job.id } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const acceptingCandidates = canManage && ["DRAFT", "OPEN", "ON_HOLD"].includes(job.status);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {job.title} <StatusBadge status={job.status} />
          </span>
        }
        description={[job.department?.name, job.location?.name, labelize(job.employmentType)].filter(Boolean).join(" · ")}
        actions={
          canManage && (
            <>
              {acceptingCandidates && (
                <AddCandidateDialog
                  jobId={job.id}
                  candidates={available.map((c) => ({ value: c.id, label: `${fullName(c)} (${c.email})` }))}
                />
              )}
              <JobStatusButtons id={job.id} status={job.status} />
              <Button variant="outline" asChild>
                <Link href={`/recruitment/jobs/${job.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            </>
          )
        }
      />

      <section aria-label="Pipeline" className="grid gap-2">
        {canManage && (
          <p className="text-muted-foreground text-sm">
            Drag candidates between stages, or use each card&apos;s menu. Candidates are hired from an accepted offer on their profile.
          </p>
        )}
        <PipelineBoard cards={cards} canManage={canManage} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <p className="whitespace-pre-line">{job.description}</p>
            {job.requirements && (
              <div>
                <h3 className="mb-1 font-medium">Requirements</h3>
                <p className="text-muted-foreground whitespace-pre-line">{job.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Position", value: job.position?.title },
                { label: "Hiring manager", value: job.hiringManager ? fullName(job.hiringManager) : null },
                { label: "Openings", value: `${job.applications.filter((a) => a.stage === "HIRED").length} of ${job.headcount} filled` },
                { label: "Published", value: job.publishedAt ? formatDate(job.publishedAt) : "Not yet" },
                ...(job.closedAt ? [{ label: "Closed", value: formatDate(job.closedAt) }] : []),
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
