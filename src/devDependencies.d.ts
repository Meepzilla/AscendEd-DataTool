
declare module '@next/bundle-analyzer' {
  import { NextConfig } from 'next';
  function withBundleAnalyzer(config: NextConfig): NextConfig;
  export = withBundleAnalyzer;
}
declare module 'papaparse';
