"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="text-destructive size-10" />
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          The page couldn&apos;t be loaded. Try again, and contact support if it keeps happening
          {error.digest ? ` (reference ${error.digest})` : ""}.
        </p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
