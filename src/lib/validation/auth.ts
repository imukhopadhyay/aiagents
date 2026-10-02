import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters" })
  .max(128, { error: "Use at most 128 characters" })
  .regex(/[a-z]/, { error: "Include a lowercase letter" })
  .regex(/[A-Z]/, { error: "Include an uppercase letter" })
  .regex(/[0-9]/, { error: "Include a number" });

export const signInSchema = z.object({
  email: emailSchema,
  // Don't apply the strength policy at sign-in: it would reveal the policy
  // and lock out accounts created before a policy change.
  password: z.string().min(1, { error: "Enter your password" }).max(128),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
