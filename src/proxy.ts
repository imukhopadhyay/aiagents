import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// First line of defence only: redirects signed-out users to /sign-in.
// Permission checks happen on the server in every page, action and route
// handler via `@/lib/auth/session`.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  // Skip Next internals, Auth.js endpoints and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
