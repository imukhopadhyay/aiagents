import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Star } from "lucide-react";

import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addDays, todayIn } from "@/lib/domain/dates";
import { formatDate, formatDateTime, formatMoney, fullName, labelize } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { orgOptions } from "@/lib/services/org";
import { fileUrl } from "@/lib/storage";

import {
  ApplyDialog,
  EditCandidateDialog,
  HireDialog,
  OfferDialog,
  OfferStatusButtons,
  ResumeUpload,
  ScheduleInterviewDialog,
} from "./candidate-actions";

export const metadata: Metadata = { title: "Candidate" };

const RECOMMENDATION_LABEL: Record<string, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  no: "No",
  strong_no: "Strong no",
};

export default async function CandidatePage({ params }: PageProps<"/recruitment/candidates/[id]">) {
  const { id } = await params;
  const user = await requirePermission("recruitment:read");
  const candidate = await db.candidate.findFirst({
    where: { id, deletedAt: null },
    include: {
      hiredAs: { select: { id: true } },
      applications: {
        orderBy: { appliedAt: "desc" },
        include: {
          jobOpening: { include: { location: { select: { timezone: true } } } },
          interviews: {
            orderBy: { scheduledAt: "asc" },
            include: {
              interviewers: { select: { id: true, firstName: true, lastName: true } },
              feedback: {
                include: { interviewer: { select: { firstName: true, lastName: true } } },
              },
            },
          },
          offers: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!candidate) notFound();

  const canManage = can(user, "recruitment:manage");
  const canHire = canManage && can(user, "employee:create");
  const name = fullName(candidate);
  const today = todayIn("UTC");
  const appliedJobIds = new Set(candidate.applications.map((a) => a.jobOpeningId));
  const [openJobs, options] = canManage
    ? await Promise.all([
        db.jobOpening.findMany({
          where: { deletedAt: null, status: { in: ["DRAFT", "OPEN", "ON_HOLD"] } },
          orderBy: { title: "asc" },
          select: { id: true, title: true },
        }),
        orgOptions(),
      ])
    : [[], null];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <PersonAvatar name={name} className="size-14 text-lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="text-muted-foreground">{candidate.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {candidate.hiredAs && (
            <Button variant="outline" asChild>
              <Link href={`/employees/${candidate.hiredAs.id}`}>View employee record</Link>
            </Button>
          )}
          {canManage && !candidate.hiredAs && (
            <ApplyDialog
              candidateId={candidate.id}
              jobs={openJobs
                .filter((j) => !appliedJobIds.has(j.id))
                .map((j) => ({ value: j.id, label: j.title }))}
            />
          )}
          {canManage && (
            <EditCandidateDialog
              candidate={{
                id: candidate.id,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                phone: candidate.phone,
                linkedinUrl: candidate.linkedinUrl,
                source: candidate.source,
                tags: candidate.tags,
                notes: candidate.notes,
              }}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Phone", value: candidate.phone },
                {
                  label: "Link",
                  value: candidate.linkedinUrl ? (
                    <a
                      href={candidate.linkedinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      {new URL(candidate.linkedinUrl).hostname} <ExternalLink className="size-3" />
                    </a>
                  ) : null,
                },
                { label: "Source", value: candidate.source },
                { label: "Added", value: formatDate(candidate.createdAt) },
                {
                  label: "Tags",
                  value: candidate.tags.length ? (
                    <span className="flex flex-wrap gap-1">
                      {candidate.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  ) : null,
                },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {candidate.resumeKey ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={fileUrl(candidate.resumeKey)} target="_blank" rel="noreferrer">
                    <FileText /> {candidate.resumeFileName ?? "Resume"}
                  </a>
                </Button>
              ) : (
                <span className="text-muted-foreground text-sm">No resume uploaded.</span>
              )}
              {canManage && (
                <ResumeUpload candidateId={candidate.id} hasResume={Boolean(candidate.resumeKey)} />
              )}
            </div>
            {candidate.notes && (
              <p className="text-muted-foreground border-t pt-4 text-sm whitespace-pre-line">
                {candidate.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6 lg:col-span-2">
          {candidate.applications.length === 0 && (
            <EmptyState
              title="No applications"
              description="Add this candidate to a job to start tracking them."
            />
          )}
          {candidate.applications.map((application) => {
            const job = application.jobOpening;
            const tz = job.location?.timezone ?? "UTC";
            const closed = ["HIRED", "REJECTED", "WITHDRAWN"].includes(application.stage);
            const activeOffer = application.offers.find((o) =>
              ["DRAFT", "SENT", "ACCEPTED"].includes(o.status),
            );
            return (
              <Card key={application.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>
                      <Link href={`/recruitment/jobs/${job.id}`} className="hover:underline">
                        {job.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      Applied {formatDate(application.appliedAt)} · in stage since{" "}
                      {formatDate(application.stageChangedAt)}
                      {application.rejectionReason ? ` · “${application.rejectionReason}”` : ""}
                    </CardDescription>
                  </div>
                  <StatusBadge status={application.stage} />
                </CardHeader>
                <CardContent className="grid gap-5">
                  <section className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">Interviews</h3>
                      {canManage && !closed && options && (
                        <ScheduleInterviewDialog
                          applicationId={application.id}
                          employees={options.employees}
                          timezone={tz}
                          defaultDate={addDays(todayIn(tz), 2)}
                        />
                      )}
                    </div>
                    {application.interviews.length === 0 ? (
                      <p className="text-muted-foreground text-sm">None scheduled.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {application.interviews.map((interview) => (
                          <li key={interview.id} className="rounded-lg border p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Link
                                href={`/interviews/${interview.id}`}
                                className="font-medium hover:underline"
                              >
                                {interview.type === "HR" ? "HR" : labelize(interview.type)}{" "}
                                interview · {formatDateTime(interview.scheduledAt, tz)}
                              </Link>
                              <StatusBadge status={interview.status} />
                            </div>
                            <p className="text-muted-foreground text-xs">
                              {interview.durationMinutes} min ·{" "}
                              {interview.interviewers.map(fullName).join(", ")}
                              {interview.location ? ` · ${interview.location}` : ""}
                            </p>
                            {interview.feedback.length > 0 && (
                              <ul className="mt-2 grid gap-1 border-t pt-2">
                                {interview.feedback.map((f) => (
                                  <li
                                    key={f.id}
                                    className="flex flex-wrap items-center gap-2 text-xs"
                                  >
                                    <span className="font-medium">{fullName(f.interviewer)}</span>
                                    <span className="flex items-center gap-0.5">
                                      {Array.from({ length: 5 }, (_, i) => (
                                        <Star
                                          key={i}
                                          className={
                                            i < f.rating
                                              ? "size-3 fill-amber-400 text-amber-400"
                                              : "text-muted-foreground size-3"
                                          }
                                        />
                                      ))}
                                    </span>
                                    <Badge variant="outline">
                                      {RECOMMENDATION_LABEL[f.recommendation ?? ""] ?? "—"}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">Offers</h3>
                      {canManage && !closed && !activeOffer && (
                        <OfferDialog
                          applicationId={application.id}
                          defaultStartDate={addDays(today, 30)}
                          defaultExpiry={addDays(today, 7)}
                        />
                      )}
                    </div>
                    {application.offers.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No offers yet.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {application.offers.map((offer) => (
                          <li
                            key={offer.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                {formatMoney(offer.salary, offer.currency)} / year · starts{" "}
                                {formatDate(offer.startDate)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {offer.expiresAt
                                  ? `Expires ${formatDate(offer.expiresAt)}`
                                  : "No expiry"}
                                {offer.sentAt ? ` · sent ${formatDate(offer.sentAt)}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={offer.status} />
                              {canManage && (
                                <OfferStatusButtons id={offer.id} status={offer.status} />
                              )}
                              {canHire &&
                                offer.status === "ACCEPTED" &&
                                application.stage !== "HIRED" && (
                                  <HireDialog
                                    applicationId={application.id}
                                    name={name}
                                    email={candidate.email}
                                  />
                                )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
