"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { markAllNotificationsRead } from "./actions";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(async () => void (await markAllNotificationsRead()))}
    >
      <CheckCheck /> Mark all read
    </Button>
  );
}
