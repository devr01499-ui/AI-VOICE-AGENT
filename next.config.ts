import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v2/:path*',
        destination: 'http://localhost:3001/api/v2/:path*', // Proxy to Express backend
      },
    ];
  },
};

export default nextConfig;
