import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
};

const nextConfigWithAnalyzer: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [

      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Wrap the original nextConfig with the bundle analyzer
// This ensures the analyzer is only active when the ANALYZE environment variable is set to 'true'
export default withBundleAnalyzer(nextConfigWithAnalyzer);
