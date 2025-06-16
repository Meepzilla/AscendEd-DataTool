import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Standard way to import Google Fonts in Next.js
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AppProviders from '@/providers/app-providers';

// If you have a specific font instance, like Inter:
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AscendEd - Student Goal Tracker',
  description: 'Advanced Student Goal Data Capture App by AscendEd',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Removed direct Google Font links, relying on next/font */}
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
