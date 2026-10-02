import "server-only";

import { headers } from "next/headers";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
}

async function requestMeta() {
  try {
    const h = await headers();
    return {
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    };
  } catch {
    // Outside a request (seed scripts, background jobs).
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Append an entry to the audit log. Failures are logged rather than thrown so
 * an audit problem never breaks the action being audited.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        changes: entry.changes,
        ...(await requestMeta()),
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
