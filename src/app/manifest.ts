import type { MetadataRoute } from 'next';

// Web app manifest: lets the app be added to an iPad/phone Home Screen and open full-screen.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AscendEd - Student Goal Tracker',
    short_name: 'AscendEd',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a111f',
    theme_color: '#0a111f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
