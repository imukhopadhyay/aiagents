"use client";

import { useState } from "react";
import { FilePen } from "lucide-react";

import { SelectField, TextField, TextareaField } from "@/components/shared/form-fields";
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
import { labelize } from "@/lib/format";
import { ATTENDANCE_STATUSES, correctionSchema } from "@/lib/validation/time";

import { requestCorrectionAction } from "./actions";

export function CorrectionDialog({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: correctionSchema,
    defaultValues: { date: defaultDate, clockIn: "09:00", clockOut: "17:30", status: "PRESENT", reason: "" },
    action: requestCorrectionAction,
    onSuccess: (_d, f) => {
      setOpen(false);
      f.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FilePen /> Request correction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an attendance correction</DialogTitle>
          <DialogDescription>
            Forgot to clock in or out? Your manager or HR will review the change. Times are in your local time zone.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="date" label="Date" type="date" max={defaultDate} />
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: labelize(s) }))}
              />
              <TextField control={form.control} name="clockIn" label="Clock in" type="time" />
              <TextField control={form.control} name="clockOut" label="Clock out" type="time" />
            </div>
            <TextareaField control={form.control} name="reason" label="Reason" rows={3} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Submit</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
