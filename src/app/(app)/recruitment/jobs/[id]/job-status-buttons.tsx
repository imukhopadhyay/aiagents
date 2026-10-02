"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setJobStatusAction } from "../../actions";

type Status = "DRAFT" | "OPEN" | "ON_HOLD" | "CLOSED";

const ACTIONS: Record<string, { label: string; to: Status; variant?: "outline" }[]> = {
  DRAFT: [{ label: "Publish", to: "OPEN" }],
  OPEN: [
    { label: "Put on hold", to: "ON_HOLD", variant: "outline" },
    { label: "Close", to: "CLOSED", variant: "outline" },
  ],
  ON_HOLD: [
    { label: "Reopen", to: "OPEN" },
    { label: "Close", to: "CLOSED", variant: "outline" },
  ],
  CLOSED: [{ label: "Reopen", to: "OPEN", variant: "outline" }],
};

export function JobStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <>
      {(ACTIONS[status] ?? []).map((a) => (
        <Button
          key={a.to}
          variant={a.variant}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setJobStatusAction({ id, status: a.to });
              if (result.ok) toast.success(result.message);
              else toast.error(result.error);
            })
          }
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}
