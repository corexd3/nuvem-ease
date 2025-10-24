import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  output: 'export',
  images: {
    unoptimized: true
  },
  crossOrigin: 'anonymous',
};

export default nextConfig;
