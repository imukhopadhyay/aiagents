"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";

import { auth, signIn, signOut } from "@/auth";
import { recordAudit } from "@/lib/audit";
import { requestPasswordReset, resetPassword } from "@/lib/auth/password-reset";
import {
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/lib/validation/auth";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Reduce a callback URL to a same-origin path, so the sign-in form can't be
 * used as an open redirect. Auth.js passes absolute URLs, so those are
 * accepted when they point at this app.
 */
async function safeRedirect(callbackUrl: string | undefined): Promise<string> {
  const fallback = "/dashboard";
  if (!callbackUrl) return fallback;

  const origin = new URL(process.env.AUTH_URL ?? `http://${(await headers()).get("host")}`).origin;
  try {
    const url = new URL(callbackUrl, origin);
    if (url.origin !== origin || url.pathname.startsWith("/sign-in")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export async function signInAction(
  input: SignInInput,
  callbackUrl?: string,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password." };

  try {
    // Throws a redirect on success, which must propagate.
    await signIn("credentials", { ...parsed.data, redirectTo: await safeRedirect(callbackUrl) });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error:
          error.type === "CredentialsSignin"
            ? "Incorrect email or password."
            : "Sign-in failed. Please try again.",
      };
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  const session = await auth();
  if (session?.user?.id) {
    await recordAudit({
      actorId: session.user.id,
      action: "LOGOUT",
      entity: "User",
      entityId: session.user.id,
    });
  }
  await signOut({ redirectTo: "/sign-in" });
}

export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };

  // Build links from configuration, not the Host header, so a spoofed header
  // can't point reset emails at another site. The header fallback is dev-only.
  let baseUrl = process.env.AUTH_URL;
  if (!baseUrl) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_URL is not set");
    baseUrl = `http://${(await headers()).get("host")}`;
  }
  await requestPasswordReset(parsed.data.email, baseUrl);

  return {
    ok: true,
    message: "If an account exists for that email, we've sent a link to reset the password.",
  };
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "expired"
          ? "This reset link has expired. Request a new one."
          : "This reset link is invalid or has already been used.",
    };
  }
  return { ok: true, message: "Your password has been reset. You can now sign in." };
}
