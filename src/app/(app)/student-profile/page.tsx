'use client';
import React, { lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserSearch } from 'lucide-react';
import AppLoadingSkeleton from '@/components/layout/AppLoadingSkeleton';

const StudentSelectionGrid = lazy(() => import('@/components/student-selection/StudentSelectionGrid'));

export default function StudentProfileLandingPage() {
  const { students, loading } = useStudentData();

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
          <div className="flex items-center gap-3">
            <UserSearch className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold">Select a Student</CardTitle>
              <CardDescription>
                Choose a student from the list below to view their profile and manage their goals.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {students.length === 0 && !loading ? (
         <Card>
            <CardHeader className="text-center">
                <CardTitle>No Students Found</CardTitle>
                <CardDescription>
                    You can add a new student using the sidebar button or by pressing (Alt+M).
                </CardDescription>
            </CardHeader>
        </Card>
      ) : (
        <Suspense fallback={<AppLoadingSkeleton />}>
            <StudentSelectionGrid students={students} />
        </Suspense>
      )}
    </div>
  );
}
