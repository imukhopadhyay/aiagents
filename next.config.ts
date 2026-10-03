import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() for permission failures.
    authInterrupts: true,
    serverActions: {
      // Largest upload is 4 MB plus multipart overhead; Vercel caps request
      // bodies at 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
