"use server";

import { z } from "zod";

import { runAction } from "@/lib/action";
import { db } from "@/lib/db";

export async function markNotificationRead(input: { id: string }) {
  return runAction(z.object({ id: z.string().min(1) }), input, async ({ id }, user) => {
    // Scoped to the user so nobody can touch another user's notifications.
    await db.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  });
}

export async function markAllNotificationsRead() {
  return runAction(z.object({}), {}, async (_input, user) => {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  });
}
