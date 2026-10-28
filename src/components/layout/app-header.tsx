
'use client';

import React from 'react'; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu, FileText, UserPlus } from 'lucide-react';
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
import { useRepaintAfterOverlay } from '@/hooks/use-repaint-after-overlay';

export default function AppHeader() {
  const { currentUser, signOut } = useAuth();
  const { openAddStudentModal, editingStudent } = useStudentData();
  const { toggleErrorLogModal, isErrorLogModalOpen } = useErrorLog(); 
  const router = useRouter();
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  useRepaintAfterOverlay();

  const userInitial = currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || 'U';
  const isDataEntryPage = pathname.startsWith('/data-entry');


  // Solid background: iPad Safari renders a backdrop blur hazy and soft when the page is zoomed out.
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card">
      <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
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
              <AppNavigation isMobile={true} />
              <div className="p-2 absolute bottom-0 w-full">
                <Separator className="my-2" />
                <Button variant="outline" className="w-full" onClick={openAddStudentModal}>
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
              <h1 className="font-semibold text-foreground">{APP_NAME}</h1>
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
                <DropdownMenuContent className="w-56" align="end" forceMount>
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
  );
}
