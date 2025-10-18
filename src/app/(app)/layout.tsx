'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppHeader from '@/components/layout/app-header';
import AppFooter from '@/components/layout/app-footer';
import StudentSidebar from '@/components/layout/student-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Toaster } from '@/components/ui/toaster';

function KeyboardShortcutInitializer() {
  useKeyboardShortcuts();
  return null;
}

const SIDEBAR_ENABLED_KEY = 'sidebar_enabled';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [isSidebarEnabled, setIsSidebarEnabled] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSetting = window.localStorage.getItem(SIDEBAR_ENABLED_KEY);
      setIsSidebarEnabled(storedSetting === null ? true : JSON.parse(storedSetting));
    }
  }, []);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (currentUser) {
      const pagesToPrefetch = [ 
        '/dashboard',
        '/changelog',
        '/data-entry',
        '/analysis-report',
        '/goal-templates',
        '/student-profile',
      ];
      
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          pagesToPrefetch.forEach(page => router.prefetch(page));
        });
      } else {
        setTimeout(() => {
          pagesToPrefetch.forEach(page => router.prefetch(page));
        }, 1000);
      }
    }
  }, [router, currentUser]);

  if (loading || !currentUser) {
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Loading application data...</div>;
  }

  return (
    <SidebarProvider defaultOpen={isSidebarEnabled}>
      <KeyboardShortcutInitializer />
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          {isSidebarEnabled && (
            <>
              <StudentSidebar />
              <SidebarRail />
            </>
          )}
          <SidebarInset className="flex-1 overflow-y-auto overflow-x-hidden">
            <main className="h-full p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </div>
        <AppFooter />
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
