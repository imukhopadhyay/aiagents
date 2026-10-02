"use client";

import { Star } from "lucide-react";

import { SelectField, TextareaField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { type FeedbackInput, feedbackSchema } from "@/lib/validation/recruitment";
import { cn } from "@/lib/utils";

import { submitFeedbackAction } from "../../recruitment/actions";

export function FeedbackForm({ interviewId, existing }: { interviewId: string; existing?: Omit<FeedbackInput, "interviewId"> }) {
  const { form, onSubmit, pending } = useActionForm({
    schema: feedbackSchema,
    defaultValues: {
      interviewId,
      rating: existing?.rating ?? (0 as number),
      recommendation: existing?.recommendation ?? "yes",
      strengths: existing?.strengths ?? "",
      concerns: existing?.concerns ?? "",
      notes: existing?.notes ?? "",
    },
    action: submitFeedbackAction,
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Overall rating</FormLabel>
              <FormControl>
                <div role="radiogroup" aria-label="Rating" className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={field.value === n}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      onClick={() => field.onChange(n)}
                      className="focus-visible:ring-ring/50 rounded p-0.5 outline-none focus-visible:ring-[3px]"
                    >
                      <Star className={cn("size-6", n <= (field.value ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SelectField
          control={form.control}
          name="recommendation"
          label="Recommendation"
          options={[
            { value: "strong_yes", label: "Strong yes" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "strong_no", label: "Strong no" },
          ]}
        />
        <TextareaField control={form.control} name="strengths" label="Strengths" rows={3} />
        <TextareaField control={form.control} name="concerns" label="Concerns" rows={3} />
        <TextareaField control={form.control} name="notes" label="Other notes" rows={3} />
        <div className="flex justify-end">
          <SubmitButton pending={pending}>{existing ? "Update feedback" : "Submit feedback"}</SubmitButton>
        </div>
      </form>
    </Form>
  );
}
