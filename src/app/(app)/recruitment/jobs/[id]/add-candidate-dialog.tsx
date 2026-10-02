"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import type { Option } from "@/components/shared/form-fields";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { applyToJobAction } from "../../actions";

export function AddCandidateDialog({ jobId, candidates }: { jobId: string; candidates: Option[] }) {
  const [open, setOpen] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await applyToJobAction({ candidateId, jobOpeningId: jobId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setCandidateId("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Add candidate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a candidate to this job</DialogTitle>
          <DialogDescription>
            Choose someone already in your candidate pool, or{" "}
            <Link className="underline underline-offset-4" href={`/recruitment/candidates/new?job=${jobId}`}>
              create a new candidate
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="candidate">Candidate</Label>
          <Select value={candidateId} onValueChange={setCandidateId}>
            <SelectTrigger id="candidate" className="w-full">
              <SelectValue placeholder={candidates.length ? "Choose a candidate" : "Everyone has already applied"} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!candidateId || pending}>
            {pending && <Loader2 className="animate-spin" />} Add to pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
