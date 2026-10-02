import "server-only";

import type { z } from "zod";

import type { ApplicationStage } from "@/generated/prisma/client";
import { appBaseUrl } from "@/lib/app-url";
import type { CurrentUser } from "@/lib/auth/session";
import { sendInvite } from "@/lib/auth/password-reset";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { zonedDateTime } from "@/lib/domain/attendance";
import { fromDateKey, toDateKey } from "@/lib/domain/dates";
import { canMoveStage, daysBetween, STAGE_LABELS } from "@/lib/domain/recruitment";
import { DomainError, NotFoundError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { AuthorizationError, can } from "@/lib/rbac/authorize";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import type {
  applySchema,
  candidateSchema,
  feedbackSchema,
  hireSchema,
  interviewSchema,
  interviewStatusSchema,
  jobSchema,
  jobStatusSchema,
  moveStageSchema,
  offerSchema,
  offerStatusSchema,
  resumeUploadSchema,
} from "@/lib/validation/recruitment";

import { notifyEmployees } from "./notifications";

function assertManage(user: CurrentUser) {
  if (!can(user, "recruitment:manage")) throw new AuthorizationError("recruitment:manage");
}

async function findApplication(id: string) {
  const application = await db.application.findUnique({
    where: { id },
    include: {
      candidate: true,
      jobOpening: { include: { location: { select: { timezone: true } } } },
    },
  });
  if (!application) throw new NotFoundError("Application");
  return application;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function saveJob(user: CurrentUser, input: z.output<typeof jobSchema>) {
  assertManage(user);
  const { id, ...data } = input;
  const job = id
    ? await db.jobOpening.update({ where: { id, deletedAt: null }, data })
    : await db.jobOpening.create({ data: { ...data, status: "DRAFT" } });
  await recordAudit({ actorId: user.id, action: id ? "UPDATE" : "CREATE", entity: "JobOpening", entityId: job.id, changes: { after: data } });
  return job;
}

export async function setJobStatus(user: CurrentUser, input: z.output<typeof jobStatusSchema>) {
  assertManage(user);
  const job = await db.jobOpening.findFirst({ where: { id: input.id, deletedAt: null } });
  if (!job) throw new NotFoundError("Job");
  if (job.status === "FILLED") throw new DomainError("This job is filled.");
  await db.jobOpening.update({
    where: { id: job.id },
    data: {
      status: input.status,
      ...(input.status === "OPEN" && !job.publishedAt ? { publishedAt: new Date() } : {}),
      ...(input.status === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", entity: "JobOpening", entityId: job.id, changes: { status: { from: job.status, to: input.status } } });
}

// ─── Candidates and applications ─────────────────────────────────────────────

export async function saveCandidate(user: CurrentUser, input: z.output<typeof candidateSchema>) {
  assertManage(user);
  const { id, jobOpeningId, ...data } = input;
  const candidate = id
    ? await db.candidate.update({ where: { id, deletedAt: null }, data })
    : await db.candidate.create({ data });
  if (!id && jobOpeningId) await applyToJob(user, { candidateId: candidate.id, jobOpeningId });
  await recordAudit({
    actorId: user.id,
    action: id ? "UPDATE" : "CREATE",
    entity: "Candidate",
    entityId: candidate.id,
    changes: { name: `${data.firstName} ${data.lastName}`, source: data.source },
  });
  return candidate;
}

export async function uploadResume(user: CurrentUser, input: z.output<typeof resumeUploadSchema>) {
  assertManage(user);
  const candidate = await db.candidate.findFirst({ where: { id: input.candidateId, deletedAt: null } });
  if (!candidate) throw new NotFoundError("Candidate");
  const stored = await saveFile("resumes", input.file);
  await db.candidate.update({
    where: { id: candidate.id },
    data: { resumeKey: stored.key, resumeFileName: stored.name },
  });
  await deleteStoredFile(candidate.resumeKey);
  await recordAudit({ actorId: user.id, action: "UPDATE", entity: "Candidate", entityId: candidate.id, changes: { resume: stored.name } });
}

export async function applyToJob(user: CurrentUser, input: z.output<typeof applySchema>) {
  assertManage(user);
  const job = await db.jobOpening.findFirst({ where: { id: input.jobOpeningId, deletedAt: null } });
  if (!job) throw new DomainError("Job not found.", "jobOpeningId");
  if (job.status !== "OPEN" && job.status !== "ON_HOLD" && job.status !== "DRAFT") {
    throw new DomainError("This job isn't accepting candidates.", "jobOpeningId");
  }
  const existing = await db.application.findUnique({
    where: { candidateId_jobOpeningId: { candidateId: input.candidateId, jobOpeningId: input.jobOpeningId } },
  });
  if (existing) throw new DomainError("This candidate has already applied to this job.", "jobOpeningId");
  const application = await db.application.create({ data: input });
  await recordAudit({ actorId: user.id, action: "CREATE", entity: "Application", entityId: application.id, changes: input });
  return application;
}

export async function moveStage(user: CurrentUser, input: z.output<typeof moveStageSchema>) {
  assertManage(user);
  const application = await findApplication(input.applicationId);
  if (!canMoveStage(application.stage, input.stage)) {
    throw new DomainError(
      input.stage === "HIRED"
        ? "Hire a candidate from their accepted offer."
        : application.stage === "HIRED"
          ? "Hired candidates can't be moved."
          : "That move isn't allowed.",
    );
  }
  await db.application.update({
    where: { id: application.id },
    data: {
      stage: input.stage,
      stageChangedAt: new Date(),
      rejectionReason: input.stage === "REJECTED" ? input.rejectionReason : null,
    },
  });
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    entity: "Application",
    entityId: application.id,
    changes: { stage: { from: application.stage, to: input.stage }, reason: input.rejectionReason },
  });
}

// ─── Interviews ──────────────────────────────────────────────────────────────

export async function scheduleInterview(user: CurrentUser, input: z.output<typeof interviewSchema>) {
  assertManage(user);
  const application = await findApplication(input.applicationId);
  if (["HIRED", "REJECTED", "WITHDRAWN"].includes(application.stage)) {
    throw new DomainError("This application is closed.");
  }
  const interviewers = await db.employee.findMany({
    where: { id: { in: input.interviewerIds }, deletedAt: null, employmentStatus: { not: "TERMINATED" } },
    select: { id: true },
  });
  if (interviewers.length !== new Set(input.interviewerIds).size) {
    throw new DomainError("Choose active employees as interviewers.", "interviewerIds");
  }

  const timezone = application.jobOpening.location?.timezone ?? "UTC";
  const scheduledAt = zonedDateTime(input.date, input.time, timezone);
  const interview = await db.$transaction(async (tx) => {
    const created = await tx.interview.create({
      data: {
        applicationId: application.id,
        type: input.type,
        scheduledAt,
        durationMinutes: input.durationMinutes,
        location: input.location,
        interviewers: { connect: interviewers },
      },
    });
    if (application.stage === "APPLIED" || application.stage === "SCREENING") {
      await tx.application.update({
        where: { id: application.id },
        data: { stage: "INTERVIEW", stageChangedAt: new Date() },
      });
    }
    return created;
  });

  await recordAudit({ actorId: user.id, action: "CREATE", entity: "Interview", entityId: interview.id, changes: { applicationId: application.id, scheduledAt } });
  await notifyEmployees(input.interviewerIds, {
    type: "interview.scheduled",
    title: `Interview: ${application.candidate.firstName} ${application.candidate.lastName}`,
    body: `${application.jobOpening.title} · ${formatDateTime(scheduledAt, timezone)} (${timezone})`,
    link: `/interviews/${interview.id}`,
  });
  return interview;
}

export async function setInterviewStatus(user: CurrentUser, input: z.output<typeof interviewStatusSchema>) {
  assertManage(user);
  const interview = await db.interview.update({ where: { id: input.id }, data: { status: input.status } });
  await recordAudit({ actorId: user.id, action: "UPDATE", entity: "Interview", entityId: interview.id, changes: { status: input.status } });
}

/** Whether the user is assigned to interview. */
export async function isInterviewer(user: CurrentUser, interviewId: string) {
  if (!user.employeeId) return false;
  const count = await db.interview.count({
    where: { id: interviewId, interviewers: { some: { id: user.employeeId } } },
  });
  return count > 0;
}

export async function submitFeedback(user: CurrentUser, input: z.output<typeof feedbackSchema>) {
  if (!user.employeeId || !can(user, "interview:feedback", { employeeId: user.employeeId })) {
    throw new AuthorizationError("interview:feedback");
  }
  if (!(await isInterviewer(user, input.interviewId))) {
    throw new DomainError("Only assigned interviewers can submit feedback.");
  }
  const { interviewId, ...data } = input;
  await db.$transaction([
    db.interviewFeedback.upsert({
      where: { interviewId_interviewerId: { interviewId, interviewerId: user.employeeId } },
      update: data,
      create: { ...data, interviewId, interviewerId: user.employeeId },
    }),
    db.interview.updateMany({ where: { id: interviewId, status: "SCHEDULED" }, data: { status: "COMPLETED" } }),
  ]);
  await recordAudit({ actorId: user.id, action: "CREATE", entity: "InterviewFeedback", entityId: interviewId, changes: { rating: data.rating, recommendation: data.recommendation } });
}

// ─── Offers and hiring ───────────────────────────────────────────────────────

export async function createOffer(user: CurrentUser, input: z.output<typeof offerSchema>) {
  assertManage(user);
  const application = await findApplication(input.applicationId);
  if (["HIRED", "REJECTED", "WITHDRAWN"].includes(application.stage)) throw new DomainError("This application is closed.");
  const open = await db.offer.findFirst({
    where: { applicationId: application.id, status: { in: ["DRAFT", "SENT", "ACCEPTED"] } },
  });
  if (open) throw new DomainError("Withdraw or close the current offer before creating another.");

  const offer = await db.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: {
        applicationId: application.id,
        salary: input.salary,
        currency: input.currency,
        startDate: fromDateKey(input.startDate),
        expiresAt: input.expiresAt ? fromDateKey(input.expiresAt) : null,
        notes: input.notes,
      },
    });
    if (application.stage !== "OFFER") {
      await tx.application.update({ where: { id: application.id }, data: { stage: "OFFER", stageChangedAt: new Date() } });
    }
    return created;
  });
  await recordAudit({ actorId: user.id, action: "CREATE", entity: "Offer", entityId: offer.id, changes: { applicationId: application.id, salary: input.salary, currency: input.currency } });
  return offer;
}

const OFFER_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "WITHDRAWN"],
  SENT: ["ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"],
};

export async function setOfferStatus(user: CurrentUser, input: z.output<typeof offerStatusSchema>) {
  assertManage(user);
  const offer = await db.offer.findUnique({ where: { id: input.id } });
  if (!offer) throw new NotFoundError("Offer");
  if (!OFFER_TRANSITIONS[offer.status]?.includes(input.status)) {
    throw new DomainError(`An offer that is ${offer.status.toLowerCase()} can't be marked ${input.status.toLowerCase()}.`);
  }
  const now = new Date();
  await db.offer.update({
    where: { id: offer.id },
    data: {
      status: input.status,
      ...(input.status === "SENT" ? { sentAt: now } : {}),
      ...(["ACCEPTED", "DECLINED"].includes(input.status) ? { respondedAt: now } : {}),
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", entity: "Offer", entityId: offer.id, changes: { from: offer.status, to: input.status } });
}

/**
 * Turn an accepted offer into an employee record: job details come from the
 * opening, the hiring manager becomes the manager and the offer's start date
 * the hire date. Marks the job filled once its headcount is reached.
 */
export async function hireCandidate(user: CurrentUser, input: z.output<typeof hireSchema>) {
  assertManage(user);
  if (!can(user, "employee:create")) throw new AuthorizationError("employee:create");
  const application = await findApplication(input.applicationId);
  const { candidate, jobOpening: job } = application;
  if (application.stage === "HIRED" || candidate.hiredAsEmployeeId) throw new DomainError("This candidate has already been hired.");
  const offer = await db.offer.findFirst({ where: { applicationId: application.id, status: "ACCEPTED" } });
  if (!offer?.startDate) throw new DomainError("Record an accepted offer with a start date before hiring.");

  const [emailTaken, userTaken] = await Promise.all([
    db.employee.findUnique({ where: { workEmail: candidate.email } }),
    db.user.findUnique({ where: { email: candidate.email } }),
  ]);
  if (emailTaken || (input.createAccount && userTaken)) {
    throw new DomainError(`${candidate.email} is already used by an employee or account. Update the candidate's email first.`);
  }

  const employee = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING("employeeNumber" FROM 2) AS INTEGER)) AS max
      FROM employees WHERE "employeeNumber" ~ '^E[0-9]+$'`;
    const employeeNumber = `E${String((rows[0]?.max ?? 0) + 1).padStart(4, "0")}`;

    let userId: string | null = null;
    if (input.createAccount) {
      const role = await tx.role.findUniqueOrThrow({ where: { key: "EMPLOYEE" } });
      const account = await tx.user.create({
        data: {
          email: candidate.email,
          name: `${candidate.firstName} ${candidate.lastName}`,
          roles: { create: { roleId: role.id } },
        },
      });
      userId = account.id;
    }

    const created = await tx.employee.create({
      data: {
        employeeNumber,
        userId,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        workEmail: candidate.email,
        phone: candidate.phone,
        departmentId: job.departmentId,
        positionId: job.positionId,
        locationId: job.locationId,
        managerId: job.hiringManagerId,
        employmentType: job.employmentType,
        employmentStatus: "PROBATION",
        hireDate: offer.startDate!,
      },
    });
    await tx.candidate.update({ where: { id: candidate.id }, data: { hiredAsEmployeeId: created.id } });
    await tx.application.update({ where: { id: application.id }, data: { stage: "HIRED", stageChangedAt: new Date() } });

    const hired = await tx.application.count({ where: { jobOpeningId: job.id, stage: "HIRED" } });
    if (hired >= job.headcount) {
      await tx.jobOpening.update({ where: { id: job.id }, data: { status: "FILLED", closedAt: new Date() } });
    }
    return created;
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    entity: "Employee",
    entityId: employee.id,
    changes: { hiredFromCandidate: candidate.id, job: job.title, startDate: toDateKey(offer.startDate) },
  });
  if (employee.userId) {
    await sendInvite({ id: employee.userId, email: employee.workEmail, name: `${employee.firstName} ${employee.lastName}` }, await appBaseUrl());
  }
  await notifyEmployees([job.hiringManagerId], {
    type: "recruitment.hired",
    title: `${candidate.firstName} ${candidate.lastName} is joining your team`,
    body: `${job.title}, starting ${toDateKey(offer.startDate)}`,
    link: `/employees/${employee.id}`,
  });
  return employee;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export async function recruitmentMetrics() {
  const yearAgo = new Date(Date.now() - 365 * 86_400_000);
  const [openJobs, openPositions, byStage, hired, upcoming] = await Promise.all([
    db.jobOpening.count({ where: { deletedAt: null, status: "OPEN" } }),
    db.jobOpening.aggregate({ where: { deletedAt: null, status: "OPEN" }, _sum: { headcount: true } }),
    db.application.groupBy({
      by: ["stage"],
      where: { jobOpening: { deletedAt: null, status: { in: ["OPEN", "ON_HOLD"] } } },
      _count: { _all: true },
    }),
    db.application.findMany({
      where: { stage: "HIRED", stageChangedAt: { gte: yearAgo } },
      select: { appliedAt: true, stageChangedAt: true },
    }),
    db.interview.count({ where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } } }),
  ]);
  const pipeline = (["APPLIED", "SCREENING", "INTERVIEW", "OFFER"] as ApplicationStage[]).map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: byStage.find((s) => s.stage === stage)?._count._all ?? 0,
  }));
  const avgTimeToHire = hired.length
    ? Math.round(hired.reduce((sum, a) => sum + daysBetween(a.appliedAt, a.stageChangedAt), 0) / hired.length)
    : null;
  return {
    openJobs,
    openPositions: openPositions._sum.headcount ?? 0,
    pipeline,
    hiredLastYear: hired.length,
    avgTimeToHire,
    upcomingInterviews: upcoming,
  };
}
