import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ethers"],
  // Removed "output: standalone" — it prevents Vercel function config from being applied
};

export default nextConfig;
