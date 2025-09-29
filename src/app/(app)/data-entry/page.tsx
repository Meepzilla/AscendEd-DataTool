
'use client';

import React, { lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

const AppLoadingSkeleton = lazy(() => import('@/components/layout/AppLoadingSkeleton'));
const DataEntryContent = dynamic(() => import('@/components/data-entry/DataEntryContent'), {
  loading: () => <DataEntryPageSkeleton />,
  ssr: false
});

const DataEntryPageSkeleton = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
    <div className="flex flex-row gap-6 items-start py-4 px-1">
      <Skeleton className="w-[350px] h-[550px] rounded-lg" />
    </div>
  </div>
);

export default function DataEntryPage() {
  const { studentsLoading } = useStudentData();

  if (studentsLoading) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <AppLoadingSkeleton />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<DataEntryPageSkeleton />}>
      <DataEntryContent />
    </Suspense>
  );
}
