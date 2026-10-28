import type {NextConfig} from 'next';
import path from 'path';

// `BUILD_TARGET=mobile` builds a static export (into out/) for the Android app.
const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

const nextConfig: NextConfig = {
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
    // A static export has no server to optimize images.
    unoptimized: isMobileBuild,
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
  ...(isMobileBuild && {
    output: 'export',
    // Export each page as <route>/index.html so the Android WebView can load it from disk.
    trailingSlash: true,
    webpack: (config, { webpack }) => {
      // AI flows are server actions, which a static export can't contain. Swap them for stubs.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /(^@\/ai\/flows\/|[\\/]src[\\/]ai[\\/]flows[\\/])/,
          path.resolve(__dirname, 'src/ai/flows-disabled.ts'),
        ),
      );
      return config;
    },
  }),
};

export default nextConfig;
