"use server";

import { z } from "zod";

import { runAction, success } from "@/lib/action";
import { clockIn, clockOut, requestCorrection, reviewCorrection } from "@/lib/services/attendance";
import { clockInSchema, correctionSchema, decisionSchema } from "@/lib/validation/time";

export async function clockInAction(input: unknown) {
  return runAction(clockInSchema, input, async (data, user) => {
    const status = await clockIn(user, data);
    return success(status === "LATE" ? "Clocked in (late)" : "Clocked in");
  });
}

export async function clockOutAction() {
  return runAction(z.object({}), {}, async (_data, user) => {
    await clockOut(user);
    return success("Clocked out");
  });
}

export async function requestCorrectionAction(input: unknown) {
  return runAction(correctionSchema, input, async (data, user) => {
    await requestCorrection(user, data);
    return success("Correction submitted for approval");
  });
}

export async function reviewCorrectionAction(input: unknown) {
  return runAction(decisionSchema, input, async (data, user) => {
    await reviewCorrection(user, data);
    return success(data.decision === "approve" ? "Correction approved" : "Correction rejected");
  });
}
