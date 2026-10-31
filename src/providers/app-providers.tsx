
'use client';

import React from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { StudentDataProvider } from '@/hooks/use-student-data';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorLogProvider } from '@/hooks/use-error-log'; // Added ErrorLogProvider
import PasscodeGate from '@/components/PasscodeGate';
// Import other providers as needed, e.g., ThemeProvider if you add theme switching

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorLogProvider> {/* ErrorLogProvider now wraps AuthProvider */}
      <AuthProvider>
        {/* With passcode protection on, nothing reads the student data until the passcode is entered. */}
        <PasscodeGate>
          <StudentDataProvider>
            <TooltipProvider delayDuration={300}>
              {children}
            </TooltipProvider>
          </StudentDataProvider>
        </PasscodeGate>
      </AuthProvider>
    </ErrorLogProvider>
  );
}
