import "server-only";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const BCRYPT_ROUNDS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset link if the email belongs to an active user. Callers must
 * respond identically either way so the form can't be used to discover
 * which emails have accounts.
 */
export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.deletedAt) return;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    // Only the newest link works.
    db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  await sendMail({
    to: user.email,
    subject: "Reset your password",
    text: `Use this link to reset your password. It expires in 1 hour.\n\n${url}`,
  });
}

export type ResetPasswordResult = { ok: true } | { ok: false; reason: "invalid" | "expired" };

export async function resetPassword(token: string, password: string): Promise<ResetPasswordResult> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || !record.user.isActive || record.user.deletedAt) {
    return { ok: false, reason: "invalid" };
  }
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    }),
  ]);
  await recordAudit({
    actorId: record.userId,
    action: "PASSWORD_RESET",
    entity: "User",
    entityId: record.userId,
  });
  return { ok: true };
}
