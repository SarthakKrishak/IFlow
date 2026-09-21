import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  transpilePackages: ["y-supabase", "@supabase/realtime-js"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "iflow-imag.vercel.app"],
    },
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion", "recharts"],
    // Keep dynamic pages in the client router cache for 30s: back/forward
    // and repeat navigations render instantly without refetching.
    // Mutations already call router.refresh(), which bypasses this cache.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  poweredByHeader: false,
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
