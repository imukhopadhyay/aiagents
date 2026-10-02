"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-types";

/** Approve/reject buttons that open a dialog for an optional comment. */
export function DecisionButtons({
  id,
  summary,
  approveLabel = "Approve",
  action,
}: {
  id: string;
  summary: string;
  approveLabel?: string;
  action: (input: {
    id: string;
    decision: "approve" | "reject";
    comment: string;
  }) => Promise<ActionResult<unknown>>;
}) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!decision) return;
    startTransition(async () => {
      const result = await action({ id, decision, comment });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done");
      setDecision(null);
      setComment("");
    });
  }

  return (
    <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
      <div className="flex justify-end gap-2">
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" onClick={() => setDecision("reject")}>
            <X /> Reject
          </Button>
        </DialogTrigger>
        <DialogTrigger asChild>
          <Button size="sm" onClick={() => setDecision("approve")}>
            <Check /> {approveLabel}
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision === "approve" ? approveLabel : "Reject"}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={`comment-${id}`}>
            Comment {decision === "reject" ? "(recommended)" : "(optional)"}
          </Label>
          <Textarea
            id={`comment-${id}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDecision(null)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={decision === "reject" ? "destructive" : "default"}
            onClick={submit}
            disabled={pending}
          >
            {pending && <Loader2 className="animate-spin" />}
            {decision === "approve" ? approveLabel : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
