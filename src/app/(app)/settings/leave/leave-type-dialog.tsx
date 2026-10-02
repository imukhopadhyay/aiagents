"use client";

import { useState } from "react";

import {
  CheckboxField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { labelize } from "@/lib/format";
import { ACCRUAL_PERIODS, type LeaveTypeInput, leaveTypeSchema } from "@/lib/validation/time";

import { saveLeaveTypeAction } from "../../leave/actions";

export function LeaveTypeDialog({
  trigger,
  type,
}: {
  trigger: React.ReactNode;
  type?: LeaveTypeInput & { id: string };
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: leaveTypeSchema,
    defaultValues: {
      id: type?.id,
      name: type?.name ?? "",
      code: type?.code ?? "",
      description: type?.description ?? "",
      annualAllowance: type?.annualAllowance ?? 0,
      accrualPeriod: type?.accrualPeriod ?? "YEARLY",
      maxCarryOver: type?.maxCarryOver ?? 0,
      isPaid: type?.isPaid ?? true,
      requiresApproval: type?.requiresApproval ?? true,
      isActive: type?.isActive ?? true,
    },
    action: saveLeaveTypeAction,
    onSuccess: (_d, f) => {
      setOpen(false);
      if (!type) f.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type ? "Edit leave type" : "New leave type"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <TextField control={form.control} name="name" label="Name" />
              <TextField control={form.control} name="code" label="Code" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                control={form.control}
                name="annualAllowance"
                label="Days per year"
                type="number"
                step={0.5}
                min={0}
              />
              <SelectField
                control={form.control}
                name="accrualPeriod"
                label="Accrual"
                options={ACCRUAL_PERIODS.map((p) => ({
                  value: p,
                  label: p === "NONE" ? "Granted up front" : labelize(p),
                }))}
              />
              <TextField
                control={form.control}
                name="maxCarryOver"
                label="Max carry-over"
                type="number"
                step={0.5}
                min={0}
              />
            </div>
            <TextareaField
              control={form.control}
              name="description"
              label="Policy notes"
              rows={2}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <CheckboxField control={form.control} name="isPaid" label="Paid" />
              <CheckboxField
                control={form.control}
                name="requiresApproval"
                label="Needs approval"
              />
              <CheckboxField control={form.control} name="isActive" label="Active" />
            </div>
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
