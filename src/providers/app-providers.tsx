'use client';

import React from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { StudentDataProvider } from '@/hooks/use-student-data';
import { TooltipProvider } from '@/components/ui/tooltip';
// Import other providers as needed, e.g., ThemeProvider if you add theme switching

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <StudentDataProvider>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
      </StudentDataProvider>
    </AuthProvider>
  );
}
