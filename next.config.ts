import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/bots/editor/*": ["./node_modules/monaco-editor/min/**/*"],
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app"],
  experimental: {
    // Cache dynamic-route RSC payloads in the client router so repeat
    // visits and back/forward navigations render instantly.
    staleTimes: { dynamic: 60, static: 300 },
    // Fully prefetch dynamic routes on link hover so dashboard/investor
    // navigations are already resolved before the click lands.
    dynamicOnHover: true,
  },
};

export default nextConfig;
