"use client";

import { useSyncExternalStore, useTransition } from "react";
import { Home, Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { clockInAction, clockOutAction } from "./actions";

function subscribeMinute(callback: () => void) {
  const timer = setInterval(callback, 15_000);
  return () => clearInterval(timer);
}

/** Current local time, refreshed every 15s; empty during server rendering. */
function useLocalTime(timeZone: string) {
  return useSyncExternalStore(
    subscribeMinute,
    () => new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone }).format(new Date()),
    () => "",
  );
}

function formatTime(iso: string | null, timeZone: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone }).format(new Date(iso));
}

export function ClockCard({
  timezone,
  today,
  clockIn,
  clockOut,
  status,
}: {
  timezone: string;
  today: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const now = useLocalTime(timezone);

  function run(action: () => ReturnType<typeof clockOutAction>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardDescription>
          {new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(
            new Date(`${today}T00:00:00Z`),
          )}
          {now && ` · ${now}`} ({timezone})
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Clock in</p>
            <p className="text-lg font-semibold tabular-nums">{formatTime(clockIn, timezone)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Clock out</p>
            <p className="text-lg font-semibold tabular-nums">{formatTime(clockOut, timezone)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <div className="pt-1">
              {status ? (
                <StatusBadge status={status} />
              ) : (
                <span className="text-muted-foreground">Not clocked in</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!clockIn && (
            <>
              <Button
                onClick={() => run(() => clockInAction({ remote: false }))}
                disabled={pending}
              >
                {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Clock in
              </Button>
              <Button
                variant="outline"
                onClick={() => run(() => clockInAction({ remote: true }))}
                disabled={pending}
              >
                <Home /> Clock in remotely
              </Button>
            </>
          )}
          {clockIn && !clockOut && (
            <Button onClick={() => run(clockOutAction)} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <LogOut />} Clock out
            </Button>
          )}
          {clockIn && clockOut && (
            <p className="text-muted-foreground text-sm">You&apos;re done for today.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
