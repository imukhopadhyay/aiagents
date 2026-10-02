import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() for permission failures.
    authInterrupts: true,
  },
};

export default nextConfig;
