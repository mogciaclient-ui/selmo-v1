import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  transpilePackages: ["@seqmo/core", "@seqmo/node", "@seqmo/nextjs", "@seqmo/browser"],
};

export default nextConfig;
