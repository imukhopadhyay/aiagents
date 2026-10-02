import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, UserSearch } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/list-controls";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, fullName } from "@/lib/format";
import { parseListParams } from "@/lib/list-params";
import { can } from "@/lib/rbac/authorize";

import { RecruitmentTabs } from "../recruitment-tabs";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage({ searchParams }: PageProps<"/recruitment/candidates">) {
  const user = await requirePermission("recruitment:read");
  const params = parseListParams(await searchParams, { sortable: ["created"] as const, defaultSort: "created" });

  const terms = params.q.split(/\s+/).filter(Boolean).slice(0, 4);
  const where: Prisma.CandidateWhereInput = {
    deletedAt: null,
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { source: { contains: term, mode: "insensitive" } },
        { tags: { has: term.toLowerCase() } },
      ],
    })),
  };
  const [candidates, total] = await Promise.all([
    db.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        applications: {
          orderBy: { stageChangedAt: "desc" },
          include: { jobOpening: { select: { title: true } } },
        },
      },
    }),
    db.candidate.count({ where }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Recruitment"
        description="Everyone in your talent pool."
        actions={
          can(user, "recruitment:manage") && (
            <Button asChild>
              <Link href="/recruitment/candidates/new">
                <Plus /> New candidate
              </Link>
            </Button>
          )
        }
      />
      <RecruitmentTabs active="candidates" />
      <SearchInput placeholder="Search name, email, source or tag" />
      {candidates.length === 0 ? (
        <EmptyState icon={UserSearch} title={params.q ? "No candidates match" : "No candidates yet"} />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Candidate</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="pr-6">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6">
                      <Link href={`/recruitment/candidates/${c.id}`} className="group flex items-center gap-3">
                        <PersonAvatar name={fullName(c)} />
                        <div>
                          <p className="flex items-center gap-1.5 font-medium group-hover:underline">
                            {fullName(c)} {c.resumeKey && <FileText className="text-muted-foreground size-3.5" aria-label="Has resume" />}
                          </p>
                          <p className="text-muted-foreground text-xs">{c.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-1">
                        {c.applications.length === 0 && <span className="text-muted-foreground">—</span>}
                        {c.applications.slice(0, 2).map((a) => (
                          <span key={a.id} className="flex items-center gap-2 text-xs">
                            <StatusBadge status={a.stage} /> {a.jobOpening.title}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{c.source ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Pagination pathname="/recruitment/candidates" params={params.raw} page={params.page} pageSize={params.pageSize} total={total} />
    </div>
  );
}
