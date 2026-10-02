import "server-only";

import { headers } from "next/headers";

/**
 * Base URL for links in emails. Uses AUTH_URL so a spoofed Host header can't
 * redirect links elsewhere; the header fallback is for development only.
 */
export async function appBaseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_URL is not set");
  return `http://${(await headers()).get("host") ?? "localhost:3000"}`;
}
