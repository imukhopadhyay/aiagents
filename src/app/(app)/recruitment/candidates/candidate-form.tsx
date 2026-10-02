"use client";

import {
  type Option,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Form } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { type CandidateInput, candidateSchema } from "@/lib/validation/recruitment";

import { saveCandidateAction } from "../actions";

export function CandidateForm({
  candidate,
  jobs,
  defaultJobId,
  onSaved,
  footer,
}: {
  candidate?: Omit<CandidateInput, "tags"> & { id: string; tags: string[] };
  jobs?: Option[];
  defaultJobId?: string;
  onSaved?: () => void;
  footer?: React.ReactNode;
}) {
  const { form, onSubmit, pending } = useActionForm({
    schema: candidateSchema,
    defaultValues: {
      id: candidate?.id,
      firstName: candidate?.firstName ?? "",
      lastName: candidate?.lastName ?? "",
      email: candidate?.email ?? "",
      phone: candidate?.phone ?? "",
      linkedinUrl: candidate?.linkedinUrl ?? "",
      source: candidate?.source ?? "",
      tags: candidate?.tags.join(", ") ?? "",
      notes: candidate?.notes ?? "",
      jobOpeningId: defaultJobId ?? "",
    },
    action: saveCandidateAction,
    onSuccess: () => onSaved?.(),
    redirectTo: candidate ? undefined : (data) => `/recruitment/candidates/${data.id}`,
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField control={form.control} name="firstName" label="First name" />
        <TextField control={form.control} name="lastName" label="Last name" />
        <TextField control={form.control} name="email" label="Email" type="email" />
        <TextField control={form.control} name="phone" label="Phone" type="tel" />
        <TextField
          control={form.control}
          name="linkedinUrl"
          label="LinkedIn / portfolio URL"
          placeholder="https://"
        />
        <TextField
          control={form.control}
          name="source"
          label="Source"
          placeholder="Referral, job board…"
        />
        <TextField
          control={form.control}
          name="tags"
          label="Tags"
          description="Comma-separated, e.g. typescript, remote"
          className="sm:col-span-2"
        />
        {jobs && (
          <SelectField
            control={form.control}
            name="jobOpeningId"
            label="Add to job"
            noneLabel="Don't add to a job yet"
            options={jobs}
            className="sm:col-span-2"
          />
        )}
        <TextareaField
          control={form.control}
          name="notes"
          label="Notes"
          rows={4}
          className="sm:col-span-2"
        />
        <div className="flex justify-end gap-2 sm:col-span-2">
          {footer}
          <SubmitButton pending={pending}>
            {candidate ? "Save changes" : "Add candidate"}
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}
