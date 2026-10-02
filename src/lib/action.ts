import "server-only";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { type CurrentUser, getCurrentUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { AuthorizationError } from "@/lib/rbac/authorize";

import type { ActionResult, FieldErrors } from "@/lib/action-types";

export type { ActionResult, FieldErrors };

/** Return from an action handler to show a success message alongside the data. */
export class Success<T> {
  constructor(
    public readonly data: T,
    public readonly message: string,
  ) {}
}

export function success(message: string): Success<undefined>;
export function success<T>(message: string, data: T): Success<T>;
export function success<T>(message: string, data?: T) {
  return new Success(data, message);
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}

/**
 * Runs a server action body for the signed-in user and converts expected
 * failures into a typed result for the form. Unexpected errors are logged and
 * reported generically so internals never leak to the client. On success the
 * current route is refreshed.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  handler: (data: z.output<S>, user: CurrentUser) => Promise<T | Success<T>>,
): Promise<ActionResult<T>> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthenticatedError();

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const result = await handler(parsed.data, user);
    // Re-render the current route so the UI reflects the change.
    refresh();
    if (result instanceof Success) return { ok: true, data: result.data, message: result.message };
    return { ok: true, data: result as T };
  } catch (error) {
    unstable_rethrow(error); // let redirect()/notFound()/forbidden() through
    if (error instanceof UnauthenticatedError) {
      return { ok: false, error: "Your session has expired. Please sign in again." };
    }
    if (error instanceof AuthorizationError) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    if (error instanceof DomainError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "";
      const field = Array.isArray(target) ? target[0] : target;
      return {
        ok: false,
        error: "A record with that value already exists.",
        fieldErrors: field ? { [field]: "Already in use" } : undefined,
      };
    }
    console.error("Unexpected action error", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export const idSchema = z.object({ id: z.string().min(1) });
