'use client';
import React, { useEffect, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserSearch } from 'lucide-react';

const AppLoadingSkeleton = lazy(() => import('@/components/layout/AppLoadingSkeleton'));

export default function StudentProfileLandingPage() {
  const { students, selectedStudent, loading } = useStudentData();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (selectedStudent) {
        router.replace(`/student-profile/${selectedStudent.id}`);
      } else if (students.length > 0) {
        // Optionally, select the first student if none is selected
        // setSelectedStudent(students[0]); // This would trigger re-render and redirect
        // Or let user choose from sidebar
      }
    }
  }, [selectedStudent, students, loading, router]);

  if (loading) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <AppLoadingSkeleton />
      </Suspense>
    );
  }
  
  if (selectedStudent) {
     return <div className="flex items-center justify-center h-full"><p>Redirecting to student profile...</p></div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <UserSearch className="w-16 h-16 mx-auto text-primary mb-4" />
          <CardTitle className="text-2xl">Select a Student</CardTitle>
          <CardDescription>
            Please select a student from the sidebar to view their profile and manage their goals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 && (
            <p className="text-muted-foreground">
              No students found. You can add a new student using the 'Add Student' button or (Alt+M).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
