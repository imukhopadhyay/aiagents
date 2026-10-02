"use client";

import { useState } from "react";

import { TextField, TextareaField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
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
import { Form } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { balanceAdjustmentSchema } from "@/lib/validation/time";

import { adjustBalanceAction } from "../actions";

export function AdjustBalanceDialog({
  employeeId,
  employeeName,
  leaveTypeId,
  leaveTypeName,
  year,
  allocated,
  carriedOver,
  used,
  children,
}: {
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  allocated: number;
  carriedOver: number;
  used: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: balanceAdjustmentSchema,
    defaultValues: { employeeId, leaveTypeId, year, allocated, carriedOver, note: "" },
    action: adjustBalanceAction,
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="hover:bg-muted rounded-md px-2 py-1 text-right underline-offset-4 hover:underline">
          {children}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {leaveTypeName} for {employeeName}, {year}
          </DialogTitle>
          <DialogDescription>{used} day(s) used so far. Changes are recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="allocated" label="Allocated days" type="number" step={0.5} min={0} />
              <TextField control={form.control} name="carriedOver" label="Carried over" type="number" step={0.5} min={0} />
            </div>
            <TextareaField control={form.control} name="note" label="Reason for change" rows={2} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Save</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
