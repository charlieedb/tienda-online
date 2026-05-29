import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid Windows EPERM issues when cleaning `.next` from previous runs in this workspace.
  distDir: ".next_listita",

  // Prevent Next.js from picking the wrong workspace root due to other lockfiles in `D:\\APP WEB`.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
