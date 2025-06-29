import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // TypeScript configuration for Next.js build.
  // 'ignoreBuildErrors: true' is set to bypass TypeScript errors during the build process.
  // This can be useful in development or for specific project setups, but should be used with caution in production.
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint configuration for Next.js build.
  // 'ignoreDuringBuilds: true' is set to skip ESLint checks during the build process.
  // Similar to TypeScript errors, this can speed up builds but means linting issues won't halt the build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Image optimization configuration.
  // Defines a list of remote hostnames that Next.js is allowed to optimize images from.
  // This enhances security and prevents arbitrary image optimization.
  images: {
    remotePatterns: [
      // Pattern for 'placehold.co' hostname.
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      // Pattern for 'avatar.vercel.sh' hostname.
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
