import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "iflow-imag.vercel.app"],
    },
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion", "recharts"],
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  // Skip type checking during build (types are checked separately)
  typescript: {
    ignoreBuildErrors: false,
  },
  // Skip linting during build for speed
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/overview',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
