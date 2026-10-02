"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormReturn,
  useForm,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import type { ActionResult } from "@/lib/action-types";

interface Options<TValues extends FieldValues, TData> {
  /** Form values are the schema's input type, since forms submit raw values. */
  schema: z.ZodType<unknown, TValues>;
  defaultValues: DefaultValues<TValues>;
  action: (values: TValues) => Promise<ActionResult<TData>>;
  /** Toast shown on success when the action doesn't return its own message. */
  successMessage?: string;
  onSuccess?: (data: TData, form: UseFormReturn<TValues>) => void;
  /** Navigate here after success (may depend on the returned data). */
  redirectTo?: string | ((data: TData) => string);
}

/**
 * React Hook Form wired to a server action: validates with the same Zod
 * schema as the server, maps server field errors back onto inputs and shows
 * toasts.
 */
export function useActionForm<TValues extends FieldValues, TData = undefined>(
  options: Options<TValues, TData>,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<TValues>({
    // raw: submit the input values; the server action parses them with the same schema.
    resolver: zodResolver(options.schema as never, undefined, { raw: true }),
    defaultValues: options.defaultValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await options.action(values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as Path<TValues>, { message });
        }
        toast.error(result.error);
        return;
      }
      const message = result.message ?? options.successMessage;
      if (message) toast.success(message);
      options.onSuccess?.(result.data, form);
      if (options.redirectTo) {
        router.push(
          typeof options.redirectTo === "function"
            ? options.redirectTo(result.data)
            : options.redirectTo,
        );
      }
    });
  });

  return { form, onSubmit, pending };
}
