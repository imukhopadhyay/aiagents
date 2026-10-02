import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { FileText, Star } from "lucide-react";

import { DetailList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, fullName, labelize } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { fileUrl } from "@/lib/storage";

import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Interview" };

export default async function InterviewPage({ params }: PageProps<"/interviews/[id]">) {
  const { id } = await params;
  const user = await requireAuth();
  const interview = await db.interview.findUnique({
    where: { id },
    include: {
      interviewers: { select: { id: true, firstName: true, lastName: true } },
      feedback: {
        include: { interviewer: { select: { id: true, firstName: true, lastName: true } } },
      },
      application: {
        include: {
          candidate: true,
          jobOpening: { include: { location: { select: { timezone: true } } } },
        },
      },
    },
  });
  if (!interview) notFound();

  const isInterviewer = interview.interviewers.some((i) => i.id === user.employeeId);
  const isRecruiter = can(user, "recruitment:read");
  if (!isInterviewer && !isRecruiter) forbidden();

  const { candidate, jobOpening: job } = interview.application;
  const tz = job.location?.timezone ?? "UTC";
  const mine = interview.feedback.find((f) => f.interviewerId === user.employeeId);
  // Interviewers see only their own feedback, so they aren't influenced by others.
  const visibleFeedback = isRecruiter
    ? interview.feedback
    : interview.feedback.filter((f) => f === mine);
  const canGiveFeedback =
    isInterviewer && can(user, "interview:feedback", { employeeId: user.employeeId });

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Interview with ${fullName(candidate)}`}
        description={`${job.title} · ${formatDateTime(interview.scheduledAt, tz)} (${tz})`}
        actions={
          isRecruiter && (
            <Button variant="outline" asChild>
              <Link href={`/recruitment/candidates/${candidate.id}`}>Candidate profile</Link>
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Status", value: <StatusBadge status={interview.status} /> },
                { label: "Type", value: interview.type === "HR" ? "HR" : labelize(interview.type) },
                { label: "Duration", value: `${interview.durationMinutes} minutes` },
                { label: "Where", value: interview.location },
                { label: "Interviewers", value: interview.interviewers.map(fullName).join(", ") },
                { label: "Candidate email", value: candidate.email },
              ]}
            />
            {candidate.resumeKey && (
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl(candidate.resumeKey)} target="_blank" rel="noreferrer">
                  <FileText /> {candidate.resumeFileName ?? "Resume"}
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
        <div className="grid content-start gap-6 lg:col-span-2">
          {canGiveFeedback && (
            <Card>
              <CardHeader>
                <CardTitle>Your feedback</CardTitle>
                <CardDescription>
                  Only recruiters see every interviewer&apos;s feedback.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FeedbackForm
                  interviewId={interview.id}
                  existing={
                    mine
                      ? {
                          rating: mine.rating,
                          recommendation: (mine.recommendation ?? "yes") as "yes",
                          strengths: mine.strengths,
                          concerns: mine.concerns,
                          notes: mine.notes,
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
          {isRecruiter && (
            <Card>
              <CardHeader>
                <CardTitle>All feedback</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {visibleFeedback.length === 0 && (
                  <p className="text-muted-foreground text-sm">No feedback yet.</p>
                )}
                {visibleFeedback.map((f) => (
                  <div key={f.id} className="grid gap-1 rounded-lg border p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{fullName(f.interviewer)}</span>
                      <span className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={
                              i < f.rating
                                ? "size-3.5 fill-amber-400 text-amber-400"
                                : "text-muted-foreground size-3.5"
                            }
                          />
                        ))}
                      </span>
                      <Badge variant="outline">{labelize(f.recommendation)}</Badge>
                    </div>
                    {f.strengths && (
                      <p>
                        <span className="text-muted-foreground">Strengths:</span> {f.strengths}
                      </p>
                    )}
                    {f.concerns && (
                      <p>
                        <span className="text-muted-foreground">Concerns:</span> {f.concerns}
                      </p>
                    )}
                    {f.notes && (
                      <p>
                        <span className="text-muted-foreground">Notes:</span> {f.notes}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
