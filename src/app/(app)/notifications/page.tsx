import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { MarkAllReadButton } from "./mark-all-read-button";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireAuth();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Notifications"
        description="Updates about your requests, approvals and interviews."
        actions={hasUnread ? <MarkAllReadButton /> : undefined}
      />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" />
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {notifications.map((n) => {
              const content = (
                <div className={cn("grid gap-0.5 px-6 py-4", !n.readAt && "bg-muted/40")}>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {!n.readAt && <span className="bg-primary size-1.5 rounded-full" />}
                    {n.title}
                  </p>
                  {n.body && <p className="text-muted-foreground text-sm">{n.body}</p>}
                  <p className="text-muted-foreground text-xs">{formatDateTime(n.createdAt)}</p>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="hover:bg-muted/60 block">
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
