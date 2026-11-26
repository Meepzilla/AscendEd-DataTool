import type {NextConfig} from 'next';

// `BUILD_TARGET=static` builds a static export (into out/) with no server, used for the Android app
// and the installable web app (see `npm run build:static`).
const isStaticBuild = process.env.BUILD_TARGET === 'static';

// Run `npm run analyze` (or `ANALYZE=true npm run build`) to write interactive treemap reports under
// `.next/analyze/` for measuring bundle sizes before and after code-splitting changes.
// @next/bundle-analyzer is a devDependency, so it is loaded only when a report is actually requested:
// importing it unconditionally made every build fail at config load on a production-only install
// (`npm ci --omit=dev`), for a feature that is off by default.
const withBundleAnalyzer: (config: NextConfig) => NextConfig = (() => {
  if (process.env.ANALYZE !== 'true') return (config) => config;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const createBundleAnalyzer = require('@next/bundle-analyzer') as typeof import('@next/bundle-analyzer');
    return createBundleAnalyzer({
      enabled: true,
      openAnalyzer: process.env.ANALYZE_OPEN === 'true',
    });
  } catch {
    console.warn('@next/bundle-analyzer is not installed; building without bundle reports.');
    return (config) => config;
  }
})();

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

export default withBundleAnalyzer(nextConfig);
