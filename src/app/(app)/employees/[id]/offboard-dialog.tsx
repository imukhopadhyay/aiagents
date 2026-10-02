"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";

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
import { offboardSchema } from "@/lib/validation/employee";

import { offboardEmployeeAction } from "../actions";

export function OffboardDialog({
  employeeId,
  name,
  reportCount,
  managerName,
  employees,
}: {
  employeeId: string;
  name: string;
  reportCount: number;
  managerName: string | null;
  employees: Option[];
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: offboardSchema,
    defaultValues: {
      id: employeeId,
      terminationDate: new Date().toISOString().slice(0, 10),
      reason: "",
      reassignReportsToId: "",
    },
    action: offboardEmployeeAction,
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserMinus /> Offboard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Offboard {name}</DialogTitle>
          <DialogDescription>
            Marks the employee as terminated, deactivates their sign-in, cancels open leave requests and
            removes them as a department head.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <TextField control={form.control} name="terminationDate" label="Last working day" type="date" />
            {reportCount > 0 && (
              <SelectField
                control={form.control}
                name="reassignReportsToId"
                label={`Reassign ${reportCount} direct report${reportCount === 1 ? "" : "s"} to`}
                noneLabel={managerName ? `${managerName} (their manager)` : "No manager"}
                options={employees.filter((e) => e.value !== employeeId)}
              />
            )}
            <TextareaField control={form.control} name="reason" label="Reason / notes" rows={3} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending} variant="destructive">
                Offboard employee
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
