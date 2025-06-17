import type {NextConfig} from 'next';
import withPreact from 'next-plugin-preact';

const nextConfig: NextConfig = withPreact({
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
});

export default nextConfig;
