"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(app)/notifications/actions";
import { cn } from "@/lib/utils";

export interface BellNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const timeFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relative(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return timeFmt.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return timeFmt.format(hours, "hour");
  return timeFmt.format(Math.round(hours / 24), "day");
}

export function NotificationBell({
  notifications,
  unread,
}: {
  notifications: BellNotification[];
  unread: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open(n: BellNotification) {
    startTransition(async () => {
      if (!n.read) await markNotificationRead({ id: n.id });
      if (n.link) router.push(n.link);
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        >
          <Bell />
          {unread > 0 && (
            <span className="bg-destructive absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              disabled={pending}
              onClick={() => startTransition(async () => void (await markAllNotificationsRead()))}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <li className="text-muted-foreground px-4 py-8 text-center text-sm">
              You&apos;re all caught up.
            </li>
          )}
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  "hover:bg-muted/60 grid w-full gap-0.5 border-b px-4 py-3 text-left last:border-0",
                  !n.read && "bg-muted/40",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {!n.read && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
                  {n.title}
                </span>
                {n.body && (
                  <span className="text-muted-foreground line-clamp-2 text-xs">{n.body}</span>
                )}
                <span className="text-muted-foreground text-xs">{relative(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
