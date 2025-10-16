
'use client';
import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { UserSearch } from 'lucide-react';
import AppLoadingSkeleton from '@/components/layout/AppLoadingSkeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const StudentSelectionGrid = lazy(() => import('@/components/student-selection/StudentSelectionGrid'));

export default function StudentProfileLandingPage() {
  const { students, loading } = useStudentData();
  const [showArchived, setShowArchived] = useState(false);

  const filteredStudents = useMemo(() => {
    return students.filter(student => showArchived || !student.isArchived);
  }, [students, showArchived]);

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
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
                <UserSearch className="h-10 w-10 text-primary" />
                <div>
                <CardTitle className="text-3xl font-bold">Select a Student</CardTitle>
                <CardDescription>
                    Choose a student from the list below to view their profile and manage their goals.
                </CardDescription>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Label htmlFor="show-archived">Show Archived</Label>
                <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {filteredStudents.length === 0 && !loading ? (
         <Card>
            <CardHeader className="text-center">
                <CardTitle>No Students Found</CardTitle>
                <CardDescription>
                    {showArchived ? "No students (including archived) found." : "You can add a new student using the sidebar button or by pressing (Alt+M)."}
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
