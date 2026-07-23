import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['pdf-parse'],
  allowedDevOrigins: ['10.1.0.26', '192.168.1.9'],
};

export default nextConfig;
