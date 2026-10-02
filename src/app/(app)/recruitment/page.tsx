import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Calendar, Clock, Plus, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, fullName, labelize } from "@/lib/format";
import { first } from "@/lib/list-params";
import { can } from "@/lib/rbac/authorize";
import { recruitmentMetrics } from "@/lib/services/recruitment";
import { JOB_STATUSES } from "@/lib/validation/recruitment";

import { RecruitmentTabs } from "./recruitment-tabs";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: PageProps<"/recruitment">) {
  const user = await requirePermission("recruitment:read");
  const status = first((await searchParams).status);
  const validStatus = (JOB_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as (typeof JOB_STATUSES)[number])
    : undefined;

  const [jobs, metrics] = await Promise.all([
    db.jobOpening.findMany({
      where: {
        deletedAt: null,
        ...(validStatus ? { status: validStatus } : { status: { notIn: ["CLOSED", "FILLED"] } }),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        department: { select: { name: true } },
        location: { select: { name: true } },
        hiringManager: { select: { firstName: true, lastName: true } },
        applications: { select: { stage: true } },
      },
    }),
    recruitmentMetrics(),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Recruitment"
        description="Open roles and hiring progress."
        actions={
          can(user, "recruitment:manage") && (
            <Button asChild>
              <Link href="/recruitment/jobs/new">
                <Plus /> New job
              </Link>
            </Button>
          )
        }
      />
      <RecruitmentTabs active="jobs" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open jobs"
          value={metrics.openJobs}
          hint={`${metrics.openPositions} position(s) to fill`}
          icon={Briefcase}
        />
        <StatCard
          title="Active candidates"
          value={metrics.pipeline.reduce((s, p) => s + p.count, 0)}
          hint={metrics.pipeline.map((p) => `${p.count} ${p.label.toLowerCase()}`).join(" · ")}
          icon={Users}
        />
        <StatCard title="Upcoming interviews" value={metrics.upcomingInterviews} icon={Calendar} />
        <StatCard
          title="Avg. time to hire"
          value={metrics.avgTimeToHire === null ? "—" : `${metrics.avgTimeToHire} days`}
          hint={`${metrics.hiredLastYear} hire(s) in the last 12 months`}
          icon={Clock}
        />
      </div>

      <FilterSelect
        param="status"
        label="Active jobs"
        options={JOB_STATUSES.map((s) => ({ value: s, label: labelize(s) }))}
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs here"
          description="Create a job to start building a pipeline."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Job</TableHead>
                  <TableHead>Hiring manager</TableHead>
                  <TableHead className="text-right">Openings</TableHead>
                  <TableHead className="text-right">Candidates</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const active = job.applications.filter(
                    (a) => !["REJECTED", "WITHDRAWN"].includes(a.stage),
                  ).length;
                  const hired = job.applications.filter((a) => a.stage === "HIRED").length;
                  return (
                    <TableRow key={job.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/recruitment/jobs/${job.id}`}
                          className="font-medium hover:underline"
                        >
                          {job.title}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {[job.department?.name, job.location?.name, labelize(job.employmentType)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell>{job.hiringManager ? fullName(job.hiringManager) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {hired}/{job.headcount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{active}</TableCell>
                      <TableCell>{job.publishedAt ? formatDate(job.publishedAt) : "—"}</TableCell>
                      <TableCell className="pr-6">
                        <StatusBadge status={job.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
