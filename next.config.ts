
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Add experimental setting to handle server-side external packages.
  // This is often required for libraries that have deep Node.js dependencies, like 'handlebars' used by Genkit.
  experimental: {
    serverComponentsExternalPackages: ['handlebars'],
  },
  // ESLint configuration for Next.js build.
  // 'ignoreDuringBuilds: true' is set to skip ESLint checks during the build process.
  // This can speed up builds but means linting issues won't halt the build.
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
