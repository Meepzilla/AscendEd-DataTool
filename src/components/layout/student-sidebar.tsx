
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
import { User, PlusCircle, Search, Edit3, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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
    openDeleteStudentModal 
  } = useStudentData();
  const [searchTerm, setSearchTerm] = useState('');
  const { state: sidebarState } = useSidebar(); // To adapt content based on collapsed/expanded
  const router = useRouter();
  const pathname = usePathname();

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    // Optional: Navigate to student profile or a default view when a student is selected
    // router.push(`/student-profile/${student.id}`);
  };
  
  const isStudentSelectedAndOnProfile = selectedStudent && pathname.includes(`/student-profile/${selectedStudent.id}`);

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
            <Button variant="ghost" size="icon" onClick={openAddStudentModal} className={cn("h-7 w-7", sidebarState === 'collapsed' && "mx-auto")}>
              <PlusCircle className="h-5 w-5" />
              <span className="sr-only">Add Student</span>
            </Button>
            <SidebarTrigger className={cn(sidebarState === 'collapsed' ? 'block' : 'hidden sm:block')} />
          </div>
        </div>
        <div className={cn("px-2 mt-2", sidebarState === 'collapsed' && "hidden")}>
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
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
                    <Link
                        href={`/student-profile/${student.id}`}
                        onClick={() => handleSelectStudent(student)}
                        className="w-full block" // Make link take full width for better click area
                      >
                      <SidebarMenuButton
                        asChild // Allow Link to control navigation
                        isActive={selectedStudent?.id === student.id}
                        className="justify-between w-full h-auto" // Ensure button itself takes full width of its container
                        tooltip={student.name}
                      >
                        {/* Content of the old 'a' tag now goes directly here */}
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-5 w-5 flex-shrink-0" />
                          <span className={cn("whitespace-normal break-words", sidebarState === 'collapsed' && "sr-only")}>{student.name}</span>
                        </div>
                      </SidebarMenuButton>
                    </Link>
                    {sidebarState !== 'collapsed' && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover/menu-item:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={(e) => { e.stopPropagation(); openEditStudentModal(student);}} 
                          title={`Edit ${student.name}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={(e) => { e.stopPropagation(); openDeleteStudentModal(student);}} 
                          title={`Delete ${student.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}

            {selectedStudent && (
              <>
                <SidebarSeparator />
                <SidebarFooter className={cn("mt-auto", sidebarState === 'collapsed' ? "p-0" : "p-2")}>
                  <Accordion type="single" collapsible className="w-full" defaultValue={isStudentSelectedAndOnProfile ? undefined : "item-1"}>
                    <AccordionItem value="item-1" className="border-none">
                      <AccordionTrigger className={cn(
                          "py-2 px-2 hover:bg-sidebar-accent rounded-md w-full justify-start hover:no-underline",
                          sidebarState === 'collapsed' && "justify-center p-2",
                        )}>
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5"/>
                          <span className={cn("font-medium text-sm", sidebarState === 'collapsed' && "sr-only")}>
                            {selectedStudent.name}
                          </span>
                        </div>
                        {sidebarState !== 'collapsed' && <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 accordion-chevron" />}
                      </AccordionTrigger>
                      <AccordionContent className={cn("pt-0", sidebarState === 'collapsed' && "hidden")}>
                        <StudentProgressSidebar student={selectedStudent} studentSessions={studentSpecificSessions} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </SidebarFooter>
              </>
            )}
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
