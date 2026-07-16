import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@ai-sdk/harness",
    "@ai-sdk/harness-codex",
    "@islo-labs/ai-sdk-sandbox",
  ],
};

export default nextConfig;
