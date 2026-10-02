import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() for permission failures.
    authInterrupts: true,
    serverActions: {
      // Largest upload is a 10 MB document, plus multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
