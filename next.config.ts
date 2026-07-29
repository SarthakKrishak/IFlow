import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
  async redirects() {
    return [
      {
        source: '/',
        destination: '/overview',
        permanent: false,
      },
    ]
  },
  webpack(config) {
    // Ensure webpack uses the real @prisma/client runtime, not the .prisma/client
    // type-only directory that tsconfig paths points to for TypeScript type resolution.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client": path.resolve("node_modules/@prisma/client"),
    };
    return config;
  },
};

export default nextConfig;
