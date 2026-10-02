"use client";

import { useState } from "react";

import { type Option, SelectField, TextField, TextareaField } from "@/components/shared/form-fields";
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
import { type PositionInput, positionSchema } from "@/lib/validation/org";

import { createPositionAction, updatePositionAction } from "./actions";

export function PositionFormDialog({
  trigger,
  position,
  departments,
}: {
  trigger: React.ReactNode;
  position?: PositionInput & { id: string };
  departments: Option[];
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: positionSchema,
    defaultValues: {
      title: position?.title ?? "",
      code: position?.code ?? "",
      description: position?.description ?? "",
      level: position?.level ?? undefined,
      departmentId: position?.departmentId ?? "",
    },
    action: (values) =>
      position ? updatePositionAction({ ...values, id: position.id }) : createPositionAction(values),
    onSuccess: (_d, f) => {
      setOpen(false);
      if (!position) f.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{position ? "Edit position" : "New position"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <TextField control={form.control} name="title" label="Job title" />
              <TextField control={form.control} name="code" label="Code" placeholder="SWE" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField control={form.control} name="departmentId" label="Department" noneLabel="Any department" options={departments} />
              <TextField control={form.control} name="level" label="Level" type="number" min={1} max={20} description="Seniority band (1–20)" />
            </div>
            <TextareaField control={form.control} name="description" label="Description" rows={3} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>{position ? "Save changes" : "Create position"}</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
