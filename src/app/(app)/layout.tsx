'use client';
import React, { useEffect } from 'react';
import { useRouter }_from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppHeader from '@/components/layout/app-header';
import AppFooter from '@/components/layout/app-footer';
import StudentSidebar from '@/components/layout/student-sidebar';
import AppNavigation from '@/components/layout/app-navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Toaster } from '@/components/ui/toaster';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useKeyboardShortcuts(); // Initialize global keyboard shortcuts

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, loading, router]);

  if (loading || !currentUser) {
    // TODO: Replace with a more sophisticated global loading skeleton for the entire app layout
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Loading application data...</div>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <div className="flex flex-1">
          <StudentSidebar />
          <SidebarRail /> {/* Adds the draggable rail to resize/toggle */}
          <SidebarInset> {/* This will be the main content area */}
            <div className="flex flex-1">
              <aside className="hidden md:block w-64 border-r bg-card p-0">
                {/* Desktop Navigation Panel */}
                <div className="sticky top-16 h-[calc(100vh-4rem)]"> {/* Adjust top based on header height */}
                   <AppNavigation />
                </div>
              </aside>
              <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
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
