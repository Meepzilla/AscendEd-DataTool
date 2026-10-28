import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google'; // Standard way to import Google Fonts in Next.js
import './globals.css'; // Import global CSS styles
import { Toaster } from "@/components/ui/toaster"; // Import Toaster component for displaying notifications
import AppProviders from '@/providers/app-providers'; // Import AppProviders for wrapping the application with context providers
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

// Initialize the Inter font with Latin subset and define a CSS variable for it.
// This uses Next.js's built-in font optimization.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Metadata for the application, used for SEO and browser tab titles.
// The <title> is set in <head> below so it is in the exported HTML.
export const metadata: Metadata = {
  description: 'Advanced Student Goal Data Capture App by AscendEd',
};

export const viewport: Viewport = {
  themeColor: '#0a111f',
};

/**
 * RootLayout component.
 * This component defines the overall HTML structure for the application.
 * It wraps all pages and ensures global elements like fonts, CSS, and providers are applied.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // React children to be rendered within this layout
}>) {
  return (
    // Set the language of the document to English and enable dark mode by default.
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to Google Fonts servers to improve font loading performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Home Screen app tags. Written here rather than in `metadata`, which Next.js streams into the
            page after it loads; Safari reads these when the app is added to the Home Screen. */}
        <title>AscendEd - Student Goal Tracker</title>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="AscendEd" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        {/* Internal tool: keep it out of search engines. */}
        <meta name="robots" content="noindex, nofollow" />
      </head>
      {/* Apply font-body CSS variable and antialiased class for smoother text rendering. */}
      <body className={`${inter.variable} font-body antialiased`}>
        {/* AppProviders wrap the entire application to provide global contexts (e.g., auth, data). */}
        <AppProviders>
          {children} {/* Renders the current page component or nested layouts */}
          <Toaster /> {/* Renders toast notifications across the application */}
          <ServiceWorkerRegistration />
        </AppProviders>
      </body>
    </html>
  );
}
