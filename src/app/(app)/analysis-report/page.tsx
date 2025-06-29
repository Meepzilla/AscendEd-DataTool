
'use client';

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, SessionData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Info, BarChart2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import type { DateRange } from "react-day-picker";
import { useSearchParams, useRouter } from 'next/navigation';

// Dynamically import the heavy charting component
const AnalysisCharts = lazy(() => import('@/components/charts/AnalysisCharts'));

export default function AnalysisReportPage() {
  const { students, sessions, loading: studentsLoading, sessionsLoading } = useStudentData();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);
  const activeStudentGoals = useMemo(() => selectedStudent?.goals.filter(g => !g.isArchived) || [], [selectedStudent]);

  useEffect(() => {
    const studentIdFromQuery = searchParams.get('studentId');

    // Case 1: URL has a student ID.
    if (studentIdFromQuery) {
      // If the state is not in sync with the URL, update it.
      if (selectedStudentId !== studentIdFromQuery) {
        setSelectedStudentId(studentIdFromQuery);
      }
    } 
    // Case 2: URL has no student ID, we're not loading, students exist, and no student is selected yet.
    // This is the default case on first load.
    else if (!studentsLoading && students.length > 0 && !selectedStudentId) {
      const firstStudentId = students[0].id;
      setSelectedStudentId(firstStudentId);
      // Update the URL to reflect this default selection.
      router.replace(`/analysis-report?studentId=${firstStudentId}`, { scroll: false });
    }
  }, [searchParams, students, studentsLoading, selectedStudentId, router]);
  
  const studentSessions = useMemo(() => {
    if (!selectedStudentId) return [];
    let filtered = sessions.filter(s => s.studentId === selectedStudentId);
    if (dateRange?.from) {
        filtered = filtered.filter(s => new Date(s.date) >= dateRange.from!);
    }
    if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(s => new Date(s.date) <= toDate);
    }
    return filtered.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions, selectedStudentId, dateRange]);

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
    setSelectedGoalId(undefined); // Reset goal selection when student changes
    router.push(`/analysis-report?studentId=${value}`, { scroll: false });
  };

  const handleExportData = () => {
    // This function can remain here or be passed down. Keeping it here is fine.
    // ... implementation for handleExportData
  };

  if (studentsLoading && students.length === 0) {
    return <AnalysisReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
             <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <BarChart2 className="h-7 w-7 text-primary"/>Analysis &amp; Reports
                </CardTitle>
                <CardDescription>Visualize student progress, analyze trends, and generate summaries (for active goals).</CardDescription>
             </div>
             <Button onClick={handleExportData} size="sm" variant="outline" disabled={studentSessions.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Select value={selectedStudentId} onValueChange={handleStudentChange}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStudent && (
                <Select value={selectedGoalId} onValueChange={(value) => setSelectedGoalId(value === 'ALL_ACTIVE' ? undefined : value)}>
                    <SelectTrigger className="w-full md:w-[250px]">
                        <SelectValue placeholder="Select Active Goal (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL_ACTIVE">All Active Goals</SelectItem>
                        {activeStudentGoals.map(goal => (
                        <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full md:w-auto"/>
          </div>
        </CardContent>
      </Card>

      {!selectedStudentId ? (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <Info className="h-10 w-10 mx-auto mb-3 text-primary"/>
                <p className="text-lg">Please select a student to view their analysis report.</p>
            </CardContent>
        </Card>
      ) : (
        <Suspense fallback={<AnalysisReportChartsSkeleton />}>
            <AnalysisCharts 
                studentSessions={studentSessions}
                selectedStudent={selectedStudent}
                selectedGoalId={selectedGoalId}
                sessionsLoading={sessionsLoading}
            />
        </Suspense>
      )}
    </div>
  );
}

function AnalysisReportChartsSkeleton() {
    return (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
    );
}

function AnalysisReportSkeleton() {
    return (
         <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div><Skeleton className="h-8 w-56 mb-1" /><Skeleton className="h-4 w-80" /></div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-2">
                        <Skeleton className="h-10 w-full md:w-[250px]" /><Skeleton className="h-10 w-full md:w-[250px]" /><Skeleton className="h-10 w-full md:flex-grow" />
                    </div>
                </CardContent>
            </Card>
            <AnalysisReportChartsSkeleton />
        </div>
    );
}
