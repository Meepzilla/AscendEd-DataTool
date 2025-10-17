
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupLabel,
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarMenuSkeleton,
  SidebarSeparator,
  useSidebar,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, PlusCircle, Search, Edit3, Trash2, Archive, ArchiveRestore, Menu } from 'lucide-react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student } from '@/lib/types';
import StudentProgressSidebar from '@/components/progress/student-progress-sidebar';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';


export default function StudentSidebar() {
  const { 
    students, 
    sessions, // Get all sessions
    loading, 
    error, 
    selectedStudent, 
    setSelectedStudent, 
    openAddStudentModal, 
    openEditStudentModal, 
    openDeleteConfirmationModal 
  } = useStudentData();
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { state: sidebarState, toggleSidebar } = useSidebar(); // To adapt content based on collapsed/expanded
  const router = useRouter();
  const pathname = usePathname();

  const filteredStudents = useMemo(() => students
    .filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(student => showArchived || !student.isArchived)
  , [students, searchTerm, showArchived]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    // Optional: Navigate to student profile or a default view when a student is selected
    // router.push(`/student-profile/${student.id}`);
  };
  
  const isStudentSelectedAndOnProfile = selectedStudent && pathname.includes(`/student-profile/${selectedStudent.id}`);
  const isDataEntryPage = pathname.startsWith('/data-entry');

  const studentSpecificSessions = useMemo(() => {
    if (!selectedStudent) return [];
    return sessions.filter(s => s.studentId === selectedStudent.id);
  }, [selectedStudent, sessions]);


  return (
    <Sidebar side="left" collapsible="icon" variant="sidebar" className="border-r">
      <SidebarHeader>
        <div className="flex items-center justify-between p-2">
           <h2 className={cn("text-lg font-semibold", sidebarState === 'collapsed' && "sr-only")}>Students</h2>
          <div className='flex items-center gap-1'>
             <Button variant="ghost" size="icon" onClick={toggleSidebar} className={cn("h-7 w-7", "hidden sm:flex")}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={openAddStudentModal} className={cn("h-7 w-7", sidebarState === 'collapsed' && "mx-auto")}>
              <PlusCircle className="h-5 w-5" />
              <span className="sr-only">Add Student</span>
            </Button>
          </div>
        </div>
        <div className={cn("px-2 mt-2 space-y-2", sidebarState === 'collapsed' && "hidden")}>
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
           <div className="flex items-center space-x-2 justify-end px-1">
              <Label htmlFor="show-archived-sidebar" className="text-xs">Show Archived</Label>
              <Switch id="show-archived-sidebar" checked={showArchived} onCheckedChange={setShowArchived} />
            </div>
        </div>
      </SidebarHeader>
      
      <SidebarSeparator />

      <SidebarContent>
        <ScrollArea className="h-full">
            {loading && (
              <div className="p-2 space-y-2">
                {[1, 2, 3].map(i => <SidebarMenuSkeleton key={i} showIcon />)}
              </div>
            )}
            {error && <p className="p-2 text-sm text-destructive">Error loading students.</p>}
            {!loading && !error && (
              <SidebarMenu className="p-2">
                {filteredStudents.length === 0 && !loading && (
                  <p className={cn("text-sm text-muted-foreground p-2 text-center", sidebarState === 'collapsed' && "hidden")}>No students found.</p>
                )}
                {filteredStudents.map((student) => (
                  <SidebarMenuItem key={student.id} className="group/menu-item relative">
                    <SidebarMenuButton
                      asChild
                      isActive={selectedStudent?.id === student.id}
                      className="justify-between w-full h-auto"
                      tooltip={student.name}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <Link
                          href={`/student-profile/${student.id}`}
                          className="flex items-center justify-between w-full"
                        >
                        <div className={cn("flex items-center gap-2 flex-grow min-w-0", student.isArchived && "opacity-60")}>
                          {student.isArchived ? <Archive className="h-5 w-5 flex-shrink-0 text-orange-500" /> : <User className="h-5 w-5 flex-shrink-0" />}
                          <span className={cn("whitespace-normal break-words", sidebarState === 'collapsed' && "sr-only")}>{student.name}</span>
                        </div>
                        
                        {sidebarState !== 'collapsed' && (
                          <div className="flex-shrink-0 opacity-0 group-hover/menu-item:opacity-100 focus-within:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7" 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditStudentModal(student);}} 
                              title={`Edit ${student.name}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7" 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteConfirmationModal(student, 'student');}} 
                              title={`Delete ${student.name}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}

            {selectedStudent && !isDataEntryPage && (
              <>
                <SidebarSeparator />
                <div className={cn("mt-auto", sidebarState === 'collapsed' ? "p-0" : "p-2")}>
                  <Accordion type="single" collapsible className="w-full" defaultValue={isStudentSelectedAndOnProfile ? undefined : "item-1"}>
                    <AccordionItem value="item-1" className="border-none">
                      <AccordionTrigger className={cn(
                          "py-2 px-2 hover:bg-sidebar-accent rounded-md w-full justify-start hover:no-underline",
                          sidebarState === 'collapsed' && "justify-center p-2",
                        )}>
                        <div className={cn("flex items-center gap-2", selectedStudent.isArchived && "opacity-60")}>
                          {selectedStudent.isArchived ? <ArchiveRestore className="h-5 w-5 text-orange-500"/> : <User className="h-5 w-5"/>}
                          <span className={cn("font-medium text-sm", sidebarState === 'collapsed' && "sr-only")}>
                            {selectedStudent.name}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className={cn("pt-0", sidebarState === 'collapsed' && "hidden")}>
                        <StudentProgressSidebar student={selectedStudent} studentSessions={studentSpecificSessions} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </>
            )}
        </ScrollArea>
      </SidebarContent>

    </Sidebar>
  );
}
