"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
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

import { archiveDepartmentAction } from "../actions";

export function ArchiveDepartmentDialog({
  departmentId,
  name,
  defaultTargetId,
  targets,
  counts,
}: {
  departmentId: string;
  name: string;
  defaultTargetId: string | null;
  targets: Option[];
  counts: { employees: number; children: number; positions: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState(defaultTargetId ?? "");
  const [pending, startTransition] = useTransition();
  const hasDependents = counts.employees + counts.children + counts.positions > 0;

  function submit() {
    startTransition(async () => {
      const result = await archiveDepartmentAction({ id: departmentId, reassignToId: targetId || null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.push("/departments");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Archive /> Archive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {name}?</DialogTitle>
          <DialogDescription>
            {hasDependents
              ? `${counts.employees} employee(s), ${counts.children} sub-department(s) and ${counts.positions} position(s) will move to the department you choose.`
              : "This department has no members, sub-departments or positions."}
          </DialogDescription>
        </DialogHeader>
        {hasDependents && (
          <div className="grid gap-2">
            <Label htmlFor="reassign">Move everything to</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="reassign" className="w-full">
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending || (hasDependents && !targetId)}>
            {pending && <Loader2 className="animate-spin" />}
            Archive department
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
