"use server";

import { runAction, success } from "@/lib/action";
import {
  applyToJob,
  createOffer,
  hireCandidate,
  moveStage,
  saveCandidate,
  saveJob,
  scheduleInterview,
  setInterviewStatus,
  setJobStatus,
  setOfferStatus,
  submitFeedback,
  uploadResume,
} from "@/lib/services/recruitment";
import { labelize } from "@/lib/format";
import {
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

export async function saveJobAction(input: unknown) {
  return runAction(jobSchema, input, async (data, user) => {
    const job = await saveJob(user, data);
    return success(data.id ? "Job updated" : "Job created as a draft", { id: job.id });
  });
}

export async function setJobStatusAction(input: unknown) {
  return runAction(jobStatusSchema, input, async (data, user) => {
    await setJobStatus(user, data);
    return success(
      data.status === "OPEN"
        ? "Job published"
        : `Job marked ${labelize(data.status).toLowerCase()}`,
    );
  });
}

export async function saveCandidateAction(input: unknown) {
  return runAction(candidateSchema, input, async (data, user) => {
    const candidate = await saveCandidate(user, data);
    return success(data.id ? "Candidate updated" : "Candidate added", { id: candidate.id });
  });
}

export async function uploadResumeAction(formData: FormData) {
  return runAction(
    resumeUploadSchema,
    { candidateId: formData.get("candidateId"), file: formData.get("file") },
    async (data, user) => {
      await uploadResume(user, data);
      return success("Resume uploaded");
    },
  );
}

export async function applyToJobAction(input: unknown) {
  return runAction(applySchema, input, async (data, user) => {
    await applyToJob(user, data);
    return success("Added to the job's pipeline");
  });
}

export async function moveStageAction(input: unknown) {
  return runAction(moveStageSchema, input, async (data, user) => {
    await moveStage(user, data);
    return success(`Moved to ${labelize(data.stage).toLowerCase()}`);
  });
}

export async function scheduleInterviewAction(input: unknown) {
  return runAction(interviewSchema, input, async (data, user) => {
    await scheduleInterview(user, data);
    return success("Interview scheduled and interviewers notified");
  });
}

export async function setInterviewStatusAction(input: unknown) {
  return runAction(interviewStatusSchema, input, async (data, user) => {
    await setInterviewStatus(user, data);
    return success("Interview updated");
  });
}

export async function submitFeedbackAction(input: unknown) {
  return runAction(feedbackSchema, input, async (data, user) => {
    await submitFeedback(user, data);
    return success("Feedback saved");
  });
}

export async function createOfferAction(input: unknown) {
  return runAction(offerSchema, input, async (data, user) => {
    await createOffer(user, data);
    return success("Offer drafted");
  });
}

export async function setOfferStatusAction(input: unknown) {
  return runAction(offerStatusSchema, input, async (data, user) => {
    await setOfferStatus(user, data);
    return success(`Offer marked ${labelize(data.status).toLowerCase()}`);
  });
}

export async function hireCandidateAction(input: unknown) {
  return runAction(hireSchema, input, async (data, user) => {
    const employee = await hireCandidate(user, data);
    return success("Candidate hired and employee record created", { id: employee.id });
  });
}
