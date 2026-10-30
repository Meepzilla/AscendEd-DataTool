
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppHeader from '@/components/layout/app-header';
import AppFooter from '@/components/layout/app-footer';
import StudentSidebar from '@/components/layout/student-sidebar';
import { SidebarProvider, SidebarInset, SidebarRail } from '@/components/ui/sidebar';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

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
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [isSidebarEnabled, setIsSidebarEnabled] = useState(true);

  // Pages scroll inside <main>, not the window, so start each page at the top.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // The window itself never needs to scroll (the app fills the screen and <main> scrolls), but iPad Safari can
  // still move it: focusing a field or closing a dialog scrolls the page up under Safari's floating tab bar,
  // whose blur then covers the menu bar ("hazy"), and Safari restores that position on reload. So the window is
  // put back at the top whenever it moves, except while a text field is focused (the on-screen keyboard
  // scrolls the page to keep the field in view; it is put back once the field loses focus).
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!typing() && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0);
      }, 150);
    };
    settle();
    window.addEventListener('scroll', settle, { passive: true });
    document.addEventListener('focusout', settle);
    window.addEventListener('pageshow', settle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', settle);
      document.removeEventListener('focusout', settle);
      window.removeEventListener('pageshow', settle);
    };
  }, []);

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
    <SidebarProvider defaultOpen={isSidebarEnabled} className="h-full min-h-0">
      <KeyboardShortcutInitializer />
      {/* The app fills the screen exactly: the header stays at the top as part of the layout and only <main>
          scrolls (iPad Safari could leave a position: sticky header drawn hazy after a dialog closed).
          flex-1 min-w-0: fill the width of the SidebarProvider's flex row instead of shrinking to the content. */}
      <div className="flex flex-1 min-w-0 flex-col h-full min-h-0 bg-background">
        <AppHeader />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {isSidebarEnabled ? (
            <>
              <StudentSidebar />
              <SidebarRail />
            </>
          ) : null}
          <main ref={mainRef} className="flex flex-1 min-w-0 min-h-0 flex-col overflow-y-auto">
            <div className="flex-1 p-4 sm:p-6 lg:p-8">
              {children}
            </div>
            <AppFooter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
