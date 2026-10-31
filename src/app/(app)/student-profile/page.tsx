
'use client';
import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { UserSearch, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManageGroupsDialog from '@/components/student-groups/ManageGroupsDialog';
import AppLoadingSkeleton from '@/components/layout/AppLoadingSkeleton';
import type { Student } from '@/lib/types';
import StudentFilters, { type StudentSortOrder } from '@/components/student-selection/StudentFilters';

const StudentSelectionGrid = lazy(() => import('@/components/student-selection/StudentSelectionGrid'));

export default function StudentProfileLandingPage() {
  const { students, loading, openAddStudentModal } = useStudentData();
  const [showArchived, setShowArchived] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<StudentSortOrder>('updated-desc');

  const filteredStudents = useMemo(() => {
    let studentsToFilter = [...students];

    // Filter by archived status
    if (!showArchived) {
      studentsToFilter = studentsToFilter.filter(student => !student.isArchived);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
        studentsToFilter = studentsToFilter.filter(student => 
            student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sort the students
    studentsToFilter.sort((a, b) => {
        const getDate = (dateString: string | undefined) => (dateString ? new Date(dateString).getTime() : 0);
        
        switch (sortOrder) {
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'date-asc':
                return getDate(a.createdAt) - getDate(b.createdAt);
            case 'updated-asc':
                return getDate(a.updatedAt) - getDate(b.updatedAt);
            case 'updated-desc':
                return getDate(b.updatedAt) - getDate(a.updatedAt);
            case 'date-desc':
            default:
                return getDate(b.createdAt) - getDate(a.createdAt);
        }
    });

    return studentsToFilter;

  }, [students, showArchived, searchTerm, sortOrder]);

  if (loading) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <AppLoadingSkeleton />
      </Suspense>
    );
  }

  return (
    <div className="space-y-6">
       <Card className="shadow-lg">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
              <UserSearch className="h-10 w-10 text-primary" />
              <div>
              <CardTitle role="heading" aria-level={1} className="text-3xl font-bold">Students</CardTitle>
              <CardDescription>
                  Search, sort, and select a student to view their profile or manage goals.
              </CardDescription>
              </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsGroupsOpen(true)}>
            <UsersRound className="mr-2 h-4 w-4" />Groups
          </Button>
          <ManageGroupsDialog open={isGroupsOpen} onOpenChange={setIsGroupsOpen} />
        </CardHeader>
        <CardContent>
            <StudentFilters 
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                showArchived={showArchived}
                setShowArchived={setShowArchived}
                onAddStudent={openAddStudentModal}
            />
        </CardContent>
      </Card>
      
      {filteredStudents.length === 0 && !loading ? (
         <Card>
            <CardHeader className="text-center">
                <CardTitle>No Students Found</CardTitle>
                <CardDescription>
                    {students.length > 0 ? "No students match your current filters." : "You can add a new student by clicking the 'Add Student' button above or by pressing (Alt+M)."}
                </CardDescription>
            </CardHeader>
        </Card>
      ) : (
        <Suspense fallback={<AppLoadingSkeleton />}>
            <StudentSelectionGrid students={filteredStudents} />
        </Suspense>
      )}
    </div>
  );
}
