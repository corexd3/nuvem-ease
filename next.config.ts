import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Removed 'output: export' because Firebase requires client-side rendering
  images: {
    unoptimized: true
  },
  crossOrigin: 'anonymous',
};

export default nextConfig;
