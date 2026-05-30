import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep defaults for hosting platforms like Vercel (expects `.next`).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
