"use client";

import Link from "next/link";

import { type Option, SelectField, TextField, TextareaField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { labelize } from "@/lib/format";
import { EMPLOYMENT_TYPES } from "@/lib/validation/employee";
import { type JobInput, jobSchema } from "@/lib/validation/recruitment";

import { saveJobAction } from "./actions";

export function JobForm({
  job,
  options,
}: {
  job?: JobInput & { id: string };
  options: { departments: Option[]; positions: Option[]; locations: Option[]; employees: Option[] };
}) {
  const { form, onSubmit, pending } = useActionForm({
    schema: jobSchema,
    defaultValues: {
      id: job?.id,
      title: job?.title ?? "",
      description: job?.description ?? "",
      requirements: job?.requirements ?? "",
      departmentId: job?.departmentId ?? "",
      positionId: job?.positionId ?? "",
      locationId: job?.locationId ?? "",
      hiringManagerId: job?.hiringManagerId ?? "",
      employmentType: job?.employmentType ?? "FULL_TIME",
      headcount: job?.headcount ?? 1,
    },
    action: saveJobAction,
    redirectTo: (data) => `/recruitment/jobs/${data.id}`,
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-6" noValidate>
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="title" label="Job title" className="sm:col-span-2" />
            <SelectField control={form.control} name="departmentId" label="Department" noneLabel="None" options={options.departments} />
            <SelectField control={form.control} name="positionId" label="Position" noneLabel="None" options={options.positions} />
            <SelectField control={form.control} name="locationId" label="Location" noneLabel="None" options={options.locations} />
            <SelectField control={form.control} name="hiringManagerId" label="Hiring manager" noneLabel="None" options={options.employees} />
            <SelectField
              control={form.control}
              name="employmentType"
              label="Employment type"
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: labelize(t) }))}
            />
            <TextField control={form.control} name="headcount" label="Openings" type="number" min={1} max={100} />
            <TextareaField control={form.control} name="description" label="Description" rows={6} className="sm:col-span-2" />
            <TextareaField control={form.control} name="requirements" label="Requirements" rows={4} className="sm:col-span-2" />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={job ? `/recruitment/jobs/${job.id}` : "/recruitment"}>Cancel</Link>
          </Button>
          <SubmitButton pending={pending}>{job ? "Save changes" : "Create job"}</SubmitButton>
        </div>
      </form>
    </Form>
  );
}
