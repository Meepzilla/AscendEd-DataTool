
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu, FileText, UserPlus, Lock } from 'lucide-react';
import { isPasscodeEnabled, lockNow } from '@/lib/secure-store';
import { MENU_POSITION_EVENT, getMenuPosition, type MenuPosition } from '@/lib/menu-position';
import { useAuth } from '@/hooks/use-auth';
import { APP_NAME, APP_SUBTITLE } from '@/lib/appConstants';
import { useStudentData } from '@/hooks/use-student-data';
import { useErrorLog } from '@/hooks/use-error-log';
import AddStudentModal from '@/components/modals/add-student-modal';
import EditStudentModal from '@/components/modals/edit-student-modal';
import ErrorLogModal from '@/components/modals/error-log-modal';
import AppNavigation from './app-navigation'; 
import { useRouter, usePathname } from 'next/navigation';
import { Separator } from '../ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import TouchControls from '../forms/touch-controls';
import { useSidebar } from '@/components/ui/sidebar';

export default function AppHeader() {
  const { currentUser, signOut } = useAuth();
  const { openAddStudentModal, editingStudent } = useStudentData();
  const { toggleErrorLogModal, isErrorLogModalOpen } = useErrorLog(); 
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  const userInitial = currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U';
  const isDataEntryPage = pathname.startsWith('/data-entry');

  // Dialog backdrops start below the menu bar while it is shown (see --app-top-bar in globals.css).
  useEffect(() => {
    document.documentElement.classList.add('has-app-header');
    return () => document.documentElement.classList.remove('has-app-header');
  }, []);

  // With passcode protection on, a Lock button in the bar.
  const [passcodeOn, setPasscodeOn] = useState(false);
  useEffect(() => {
    const check = () => setPasscodeOn(isPasscodeEnabled());
    check();
    window.addEventListener('ascended-passcode-change', check);
    return () => window.removeEventListener('ascended-passcode-change', check);
  }, []);

  // Top or bottom of the screen (Settings → Menu bar position); the account menu opens toward the page.
  const [menuPosition, setMenuPositionState] = useState<MenuPosition>('top');
  useEffect(() => {
    const check = () => setMenuPositionState(getMenuPosition());
    check();
    window.addEventListener(MENU_POSITION_EVENT, check);
    return () => window.removeEventListener(MENU_POSITION_EVENT, check);
  }, []);

  // The phone menu closes once a page is chosen.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => { setIsMenuOpen(false); }, [pathname]);


  // The menu bar is pinned to the top of the screen with a solid background. iPadOS 26 blurs the top edge of
  // a page (under the status bar in the Home Screen app, under the tab bar in Safari) unless a fixed bar
  // touches that edge; it then takes that bar's color instead, so the menu bar stays sharp. The bar reaches
  // up behind the status bar (padding by the safe-area inset, converted for the body's zoom), and a spacer of
  // the bar's own height keeps the page below it. (No backdrop blur: iPad Safari draws it hazy when zoomed out.)
  // The bar can be moved to the bottom in Settings; a thin bar then stays at the top edge (see .app-menubar in
  // globals.css, where the position and padding are set).
  return (
    <>
    <div aria-hidden className="app-top-strip-spacer w-full shrink-0" />
    <div aria-hidden className="app-top-strip fixed inset-x-0 top-0 z-40 bg-card" />
    <div aria-hidden className="app-menubar-spacer h-[65px] w-full shrink-0" />
    <header className="app-menubar fixed inset-x-0 z-40 bg-card">
      <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            {/* The links scroll and Add Student stays below them, so a short screen (a phone in landscape) can
                reach every page. */}
            <SheetContent
              side="left"
              className="w-72 p-0 flex flex-col"
              // Clear of the status bar, notch and home indicator (the menu covers the whole screen height).
              style={{
                paddingTop: 'calc(env(safe-area-inset-top) / var(--body-zoom))',
                paddingBottom: 'calc(env(safe-area-inset-bottom) / var(--body-zoom))',
                paddingLeft: 'calc(env(safe-area-inset-left) / var(--body-zoom))',
              }}
            >
              <SheetHeader>
                <SheetTitle className="sr-only">Main Menu</SheetTitle>
              </SheetHeader>
              <div className="p-4 border-b">
                <Link href="/dashboard" className="flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.09L6.71 11.8l1.41-1.41L11 13.27l4.88-4.88 1.41 1.41L11 16.09z"/>
                  </svg>
                  <span className="text-xl font-bold">{APP_NAME}</span>
                </Link>
              </div>
              {/* Also closes when the current page's link is tapped (the address doesn't change then). */}
              <div className="flex-1 min-h-0" onClick={e => { if ((e.target as HTMLElement).closest('a')) setIsMenuOpen(false); }}>
                <AppNavigation isMobile={true} />
              </div>
              <div className="p-2 shrink-0">
                <Separator className="my-2" />
                <Button variant="outline" className="w-full" onClick={() => { setIsMenuOpen(false); openAddStudentModal(); }}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Student
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            className="hidden md:flex items-center gap-2 px-2"
            title="Toggle Sidebar (Alt+K)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-primary">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.09L6.71 11.8l1.41-1.41L11 13.27l4.88-4.88 1.41 1.41L11 16.09z"/>
            </svg>
            <div>
              <span className="font-semibold text-foreground">{APP_NAME}</span>
            </div>
          </Button>
        </div>
        
        {/* Desktop Navigation - centered */}
        <div className="hidden md:flex flex-1 justify-center">
            <AppNavigation isMobile={false} />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
           <Button variant="ghost" size="icon" onClick={openAddStudentModal} title="Add Student (Alt+M)" className="hidden sm:flex">
            <UserPlus className="h-5 w-5" />
            <span className="sr-only">Add Student</span>
          </Button>

          {passcodeOn && (
            <Button variant="ghost" size="icon" onClick={() => lockNow()} title="Lock (student data stays encrypted until the passcode is entered)" aria-label="Lock">
              <Lock className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleErrorLogModal} title="Error Log (Alt+J)">
            <FileText className="h-5 w-5" />
            <span className="sr-only">Error Log</span>
          </Button>
          
          <div className="flex items-center gap-2 border-l border-border pl-1 sm:pl-2">
             {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{userInitial}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" side={menuPosition === 'bottom' ? 'top' : 'bottom'} forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{currentUser.displayName || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {currentUser.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
               <Avatar className="h-8 w-8">
                  <AvatarFallback>{userInitial}</AvatarFallback>
                </Avatar>
            )}
          </div>
        </div>
      </div>
      <AddStudentModal />
      {editingStudent && <EditStudentModal studentToEdit={editingStudent} />}
      <ErrorLogModal /> 
    </header>
    </>
  );
}
