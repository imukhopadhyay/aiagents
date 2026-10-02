"use client";

import { useState } from "react";

import { type Option, SelectField, TextField } from "@/components/shared/form-fields";
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
import { type HolidayInput, holidaySchema } from "@/lib/validation/time";

import { saveHolidayAction } from "../../leave/actions";

export function HolidayDialog({
  trigger,
  holiday,
  locations,
}: {
  trigger: React.ReactNode;
  holiday?: HolidayInput & { id: string };
  locations: Option[];
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: holidaySchema,
    defaultValues: {
      id: holiday?.id,
      name: holiday?.name ?? "",
      date: holiday?.date ?? "",
      locationId: holiday?.locationId ?? "",
    },
    action: saveHolidayAction,
    onSuccess: (_d, f) => {
      setOpen(false);
      if (!holiday) f.reset();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{holiday ? "Edit holiday" : "Add holiday"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <TextField control={form.control} name="name" label="Name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="date" label="Date" type="date" />
              <SelectField control={form.control} name="locationId" label="Applies to" noneLabel="All locations" options={locations} />
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
