"use client";

import { useState } from "react";

import { type Option, SelectField, TextField, TextareaField } from "@/components/shared/form-fields";
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
import { type DepartmentInput, departmentSchema } from "@/lib/validation/org";

import { createDepartmentAction, updateDepartmentAction } from "./actions";

export function DepartmentFormDialog({
  trigger,
  department,
  departments,
  employees,
}: {
  trigger: React.ReactNode;
  department?: DepartmentInput & { id: string };
  departments: Option[];
  employees: Option[];
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: departmentSchema,
    defaultValues: {
      name: department?.name ?? "",
      code: department?.code ?? "",
      description: department?.description ?? "",
      parentId: department?.parentId ?? "",
      headId: department?.headId ?? "",
    },
    action: (values) =>
      department ? updateDepartmentAction({ ...values, id: department.id }) : createDepartmentAction(values),
    onSuccess: (_data, f) => {
      setOpen(false);
      if (!department) f.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Edit department" : "New department"}</DialogTitle>
          <DialogDescription>Departments can be nested to mirror your organization.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <TextField control={form.control} name="name" label="Name" />
              <TextField control={form.control} name="code" label="Code" placeholder="ENG" />
            </div>
            <SelectField
              control={form.control}
              name="parentId"
              label="Parent department"
              noneLabel="None (top level)"
              options={departments.filter((d) => d.value !== department?.id)}
            />
            <SelectField control={form.control} name="headId" label="Department head" noneLabel="No head" options={employees} />
            <TextareaField control={form.control} name="description" label="Description" rows={3} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>{department ? "Save changes" : "Create department"}</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
