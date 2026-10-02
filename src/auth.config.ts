import type { NextAuthConfig } from "next-auth";

/** Routes reachable without signing in. Everything else requires a session. */
export const PUBLIC_ROUTES = ["/sign-in", "/forgot-password", "/reset-password"];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// Database-free config shared by the proxy and the full Auth.js instance.
// Providers that touch the database are added in `auth.ts`.
export const authConfig = {
  pages: { signIn: "/sign-in" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const signedIn = Boolean(auth?.user);
      if (isPublicRoute(nextUrl.pathname)) {
        // Signed-in users have no reason to see the sign-in pages.
        return signedIn ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
      }
      // Returning false redirects to `pages.signIn` with a callbackUrl.
      return signedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
