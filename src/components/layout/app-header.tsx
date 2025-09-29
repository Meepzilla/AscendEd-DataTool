
'use client';

import React from 'react'; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'; // Added SheetHeader, SheetTitle
import { Menu, FileText, UserCircle, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { APP_NAME, APP_SUBTITLE } from '@/lib/appConstants';
import { useStudentData } from '@/hooks/use-student-data';
import { useErrorLog } from '@/hooks/use-error-log';
import AddStudentModal from '@/components/modals/add-student-modal';
import EditStudentModal from '@/components/modals/edit-student-modal';
import ErrorLogModal from '@/components/modals/error-log-modal';
import AppNavigation from './app-navigation'; 
import { useRouter } from 'next/navigation';
import { Separator } from '../ui/separator';

export default function AppHeader() {
  const { currentUser, signOut } = useAuth();
  const { openAddStudentModal, editingStudent } = useStudentData();
  const { toggleErrorLogModal, isErrorLogModalOpen } = useErrorLog(); 
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
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
          <Link href="/dashboard" className="hidden md:flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.09L6.71 11.8l1.41-1.41L11 13.27l4.88-4.88 1.41 1.41L11 16.09z"/>
            </svg>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{APP_NAME}</h1>
              <p className="text-xs text-muted-foreground">{APP_SUBTITLE}</p>
            </div>
          </Link>
        </div>
        
        {/* Desktop Navigation - centered */}
        <div className="hidden md:flex flex-1 justify-center">
            <AppNavigation isMobile={false} />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
           <Button variant="ghost" size="icon" onClick={openAddStudentModal} title="Add Student (Alt+M)" className="hidden sm:flex">
            <UserPlus className="h-5 w-5" />
            <span className="sr-only">Add Student</span>
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleErrorLogModal} title="Error Log (Alt+L)">
            <FileText className="h-5 w-5" />
            <span className="sr-only">Error Log</span>
          </Button>
          
          <div className="flex items-center gap-2 border-l border-border pl-1 sm:pl-2">
             {currentUser ? (
              <>
                <UserCircle className="h-6 w-6 text-muted-foreground" />
                <div className="text-xs hidden sm:block">
                  <p className="font-medium text-foreground truncate max-w-[100px]">{currentUser.displayName || currentUser.email || 'User'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
              </>
            ) : (
              <UserCircle className="h-6 w-6 text-muted-foreground" />
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
