'use client';

import React, { lazy, Suspense } from 'react';
import type { Student } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StudentSelectionCard = lazy(() => import('./StudentSelectionCard'));

interface StudentSelectionGridProps {
  students: Student[];
}

const StudentSelectionGrid: React.FC<StudentSelectionGridProps> = ({ students }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {students.map(student => (
        <Suspense key={student.id} fallback={<StudentCardSkeleton />}>
          <StudentSelectionCard student={student} />
        </Suspense>
      ))}
    </div>
  );
};

const StudentCardSkeleton = () => (
    <Skeleton className="h-40 w-full rounded-lg" />
);

export default StudentSelectionGrid;
