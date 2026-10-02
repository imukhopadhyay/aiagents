import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { signInSchema } from "@/lib/validation/auth";

// Compared against when the email is unknown, so a failed lookup takes as
// long as a wrong password and doesn't reveal which emails exist.
const DUMMY_HASH = "$2b$12$XzL7rwKHWHvHdxC2MGQtxeaflYtlEV1cRdvhnUZFi7eYeZxjEnqJm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !user.passwordHash || !valid || !user.isActive || user.deletedAt) {
          await recordAudit({
            action: "LOGIN_FAILED",
            entity: "User",
            entityId: user?.id,
            changes: { email },
          });
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await recordAudit({
          actorId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
        });

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
});
