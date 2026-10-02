import { describe, expect, it } from "vitest";

import { passwordSchema, resetPasswordSchema, signInSchema } from "@/lib/validation/auth";

describe("auth validation", () => {
  it("normalizes email at sign-in", () => {
    const parsed = signInSchema.parse({ email: "  Admin@Example.COM ", password: "x" });
    expect(parsed.email).toBe("admin@example.com");
  });

  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("short1A").success).toBe(false);
    expect(passwordSchema.safeParse("alllowercase1").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPERCASE1").success).toBe(false);
    expect(passwordSchema.safeParse("NoNumbersHere").success).toBe(false);
    expect(passwordSchema.safeParse("Valid1Password").success).toBe(true);
  });

  it("requires matching passwords on reset", () => {
    const result = resetPasswordSchema.safeParse({
      token: "t",
      password: "Valid1Password",
      confirmPassword: "Different1Password",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
