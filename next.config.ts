import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ethers"],
  // Vercel-optimized standalone output
  output: "standalone",
};

export default nextConfig;
