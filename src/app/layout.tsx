import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Standard way to import Google Fonts in Next.js
import './globals.css'; // Import global CSS styles
import { Toaster } from "@/components/ui/toaster"; // Import Toaster component for displaying notifications
import AppProviders from '@/providers/app-providers'; // Import AppProviders for wrapping the application with context providers

// Initialize the Inter font with Latin subset and define a CSS variable for it.
// This uses Next.js's built-in font optimization.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Metadata for the application, used for SEO and browser tab titles.
export const metadata: Metadata = {
  title: 'AscendEd - Student Goal Tracker',
  description: 'Advanced Student Goal Data Capture App by AscendEd',
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
        {/* Note: Direct Google Font links were removed as next/font handles font loading and optimization. */}
      </head>
      {/* Apply font-body CSS variable and antialiased class for smoother text rendering. */}
      <body className={`${inter.variable} font-body antialiased`}>
        {/* AppProviders wrap the entire application to provide global contexts (e.g., auth, data). */}
        <AppProviders>
          {children} {/* Renders the current page component or nested layouts */}
          <Toaster /> {/* Renders toast notifications across the application */}
        </AppProviders>
      </body>
    </html>
  );
}
