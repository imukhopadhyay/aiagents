import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { first } from "@/lib/list-params";

import { CandidateForm } from "../candidate-form";

export const metadata: Metadata = { title: "New candidate" };

export default async function NewCandidatePage({
  searchParams,
}: PageProps<"/recruitment/candidates/new">) {
  await requirePermission("recruitment:manage");
  const job = first((await searchParams).job);
  const jobs = await db.jobOpening.findMany({
    where: { deletedAt: null, status: { in: ["DRAFT", "OPEN", "ON_HOLD"] } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="New candidate" description="You can upload a resume after saving." />
      <Card>
        <CardContent>
          <CandidateForm
            jobs={jobs.map((j) => ({ value: j.id, label: j.title }))}
            defaultJobId={jobs.some((j) => j.id === job) ? job : undefined}
            footer={
              <Button variant="outline" asChild>
                <Link href="/recruitment/candidates">Cancel</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
