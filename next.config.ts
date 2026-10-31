import type {NextConfig} from 'next';

// `BUILD_TARGET=static` builds a static export (into out/) with no server, used for the Android app
// and the installable web app (see `npm run build:static`).
const isStaticBuild = process.env.BUILD_TARGET === 'static';

// Shown in Settings so it is easy to tell which version a device is running. Cloudflare sets
// WORKERS_CI_COMMIT_SHA (CF_PAGES_COMMIT_SHA for Pages), Netlify sets COMMIT_REF and GitHub Actions sets
// GITHUB_SHA; local builds show "dev".
const appVersionEnv = {
  NEXT_PUBLIC_APP_VERSION: (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || process.env.GITHUB_SHA || 'dev').slice(0, 7),
  NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
};

const nextConfig: NextConfig = {
  // ESLint configuration for Next.js build.
  // 'ignoreDuringBuilds: true' is set to skip ESLint checks during the build process.
  // This can speed up builds but means linting issues won't halt the build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: appVersionEnv,
  // The app loads no remote images, so none are allowed.
  images: {
    // A static export has no server to optimize images.
    unoptimized: isStaticBuild,
  },
  ...(isStaticBuild && {
    output: 'export',
    // Export each page as <route>/index.html so it can be served as a plain file.
    trailingSlash: true,
    env: {
      ...appVersionEnv,
      NEXT_PUBLIC_STATIC_EXPORT: 'true',
    },
  }),
};

export default nextConfig;
