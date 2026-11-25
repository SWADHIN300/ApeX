import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
