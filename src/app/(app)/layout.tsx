'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppHeader from '@/components/layout/app-header';
import AppFooter from '@/components/layout/app-footer';
import StudentSidebar from '@/components/layout/student-sidebar';
// AppNavigation is no longer imported here for desktop sidebar
import { SidebarProvider, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Toaster } from '@/components/ui/toaster';

// New component to initialize keyboard shortcuts within the SidebarProvider context
function KeyboardShortcutInitializer() {
  useKeyboardShortcuts();
  return null; // This component does not render anything itself
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, loading, router]);

  // Prefetch all main pages in the background after initial load
  useEffect(() => {
    if (currentUser) { // Only prefetch if user is logged in
      const pagesToPrefetch = [ 
        '/dashboard',
        '/changelog',
        '/data-entry',
        '/analysis-report',
        '/goal-templates',
        '/student-profile',
      ];
      
      // Use requestIdleCallback to prefetch without impacting the main thread
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          pagesToPrefetch.forEach(page => router.prefetch(page));
        });
      } else {
        // Fallback for older browsers
        setTimeout(() => {
          pagesToPrefetch.forEach(page => router.prefetch(page));
        }, 1000);
      }
    }
  }, [router, currentUser]);


  if (loading || !currentUser) {
    // TODO: Replace with a more sophisticated global loading skeleton for the entire app layout
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Loading application data...</div>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <KeyboardShortcutInitializer /> {/* Initialize shortcuts here */}
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1">
          <StudentSidebar />
          <SidebarRail /> {/* Adds the draggable rail to resize/toggle student sidebar */}
          <SidebarInset> {/* This will be the main content area */}
            <div className="flex flex-1">
              {/* Desktop Navigation Panel (AppNavigation) has been removed from here */}
              <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                 {children}
                </div>
              </main>
            </div>
          </SidebarInset>
        </div>
        <AppFooter />
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
