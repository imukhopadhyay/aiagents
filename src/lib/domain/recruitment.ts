export const PIPELINE_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;
export const CLOSED_STAGES = ["REJECTED", "WITHDRAWN"] as const;
export type Stage = (typeof PIPELINE_STAGES)[number] | (typeof CLOSED_STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/**
 * Whether an application may move between stages. HIRED is final (the
 * candidate has become an employee), and HIRED is reached only from OFFER via
 * an accepted offer, so it can't be set by dragging a card.
 */
export function canMoveStage(from: Stage, to: Stage): boolean {
  if (from === to) return false;
  if (from === "HIRED") return false;
  if (to === "HIRED") return false;
  return true;
}

/** Whole days from `from` to `to`, used for time-to-hire. */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}
