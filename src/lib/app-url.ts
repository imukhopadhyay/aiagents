import "server-only";

import { headers } from "next/headers";

/**
 * Base URL for links in emails. Comes from configuration so a spoofed Host
 * header can't redirect links elsewhere: AUTH_URL if set, otherwise the
 * domain Vercel provides. The Host header fallback is for development only.
 */
export async function appBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_URL is not set");
  return `http://${(await headers()).get("host") ?? "localhost:3000"}`;
}
