import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "iflow-imag.vercel.app"],
    },
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion", "recharts"],
  },
  // Skip type checking during build (types are checked separately)
  typescript: {
    ignoreBuildErrors: false,
  },
  // Skip linting during build for speed
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client": require("path").resolve("node_modules/@prisma/client"),
    };
    return config;
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
