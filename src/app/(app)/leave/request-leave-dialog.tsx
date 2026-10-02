"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import {
  CheckboxField,
  type Option,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
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
import { leaveRequestSchema } from "@/lib/validation/time";

import { submitLeaveRequestAction } from "./actions";

export function RequestLeaveDialog({ types, today }: { types: Option[]; today: string }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: leaveRequestSchema,
    defaultValues: {
      leaveTypeId: types[0]?.value ?? "",
      startDate: today,
      endDate: today,
      startHalfDay: false,
      endHalfDay: false,
      reason: "",
    },
    action: submitLeaveRequestAction,
    onSuccess: (_d, f) => {
      setOpen(false);
      f.reset();
    },
  });
  const sameDay = form.watch("startDate") === form.watch("endDate");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus /> Request leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Weekends and public holidays aren&apos;t counted against your balance.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <SelectField
              control={form.control}
              name="leaveTypeId"
              label="Leave type"
              options={types}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="startDate" label="From" type="date" />
              <TextField control={form.control} name="endDate" label="To" type="date" />
              <CheckboxField
                control={form.control}
                name="startHalfDay"
                label={sameDay ? "Half day only" : "Start at midday"}
              />
              {!sameDay && (
                <CheckboxField control={form.control} name="endHalfDay" label="Finish at midday" />
              )}
            </div>
            <TextareaField
              control={form.control}
              name="reason"
              label="Note for your approver (optional)"
              rows={3}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Submit request</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
