
'use client';

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, SessionData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Info, BarChart2, Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import type { DateRange } from "react-day-picker";
import { useSearchParams, useRouter } from 'next/navigation';
import { downloadSessionsCsv } from '@/lib/session-csv';
import CsvExportWarning from '@/components/CsvExportWarning';
import { useToast } from '@/hooks/use-toast';
import { compareSessionsOldestFirst, formatDate } from '@/lib/helpers';
import NarrativeDialog from '@/components/charts/NarrativeDialog';
import { attendanceSummary, attendanceText, isMissed } from '@/lib/attendance';

// Dynamically import the heavy charting component
const AnalysisCharts = lazy(() => import('@/components/charts/AnalysisCharts'));
const ImportDataModal = lazy(() => import('@/components/modals/import-data-modal'));
const TrialStatusChart = lazy(() => import('@/components/charts/analysis-charts/TrialStatusChart'));

export default function AnalysisReportPage() {
  const { students, sessions, loading: studentsLoading, sessionsLoading, importSessions } = useStudentData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [isCsvWarningOpen, setIsCsvWarningOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const activeStudents = useMemo(() => students.filter(s => !s.isArchived), [students]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);
  const activeStudentGoals = useMemo(() => selectedStudent?.goals.filter(g => !g.isArchived) || [], [selectedStudent]);

  useEffect(() => {
    const studentIdFromQuery = searchParams.get('studentId');

    // Case 1: URL has a student ID.
    if (studentIdFromQuery) {
      // If the state is not in sync with the URL, update it.
      if (selectedStudentId !== studentIdFromQuery) {
        setSelectedStudentId(studentIdFromQuery);
        // The goal filter was for the previous student's goals.
        setSelectedGoalId(undefined);
      }
    } 
    // Case 2: URL has no student ID, we're not loading, students exist, and no student is selected yet.
    // This is the default case on first load.
    else if (!studentsLoading && activeStudents.length > 0 && !selectedStudentId) {
      const firstStudentId = activeStudents[0].id;
      setSelectedStudentId(firstStudentId);
      // Update the URL to reflect this default selection.
      router.replace(`/analysis-report?studentId=${firstStudentId}`, { scroll: false });
    }
  }, [searchParams, activeStudents, studentsLoading, selectedStudentId, router]);
  
  const periodSessions = useMemo(() => {
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
    // Stored sessions are newest first, so sessions with the same date and start time are in reverse saved order;
    // reversing first keeps them in saved order (the last saved is the latest, as in the sidebar).
    return filtered.reverse().sort(compareSessionsOldestFirst);
  }, [sessions, selectedStudentId, dateRange]);
  // Charts and the narrative use the sessions that took place; missed sessions are shown as attendance.
  const studentSessions = useMemo(() => periodSessions.filter(s => !isMissed(s)), [periodSessions]);
  const attendance = useMemo(() => attendanceSummary(periodSessions), [periodSessions]);

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
    setSelectedGoalId(undefined); // Reset goal selection when student changes
    router.push(`/analysis-report?studentId=${value}`, { scroll: false });
  };

  const handleExportData = () => {
    if (!selectedStudent || periodSessions.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There is no session data for the selected student in the specified date range.",
        variant: "default",
      });
      return;
    }
    // Confirmed in CsvExportWarning first (the file holds student data in plain text).
    setIsCsvWarningOpen(true);
  };

  if (studentsLoading && students.length === 0) {
    return <AnalysisReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        {isImportModalOpen && <ImportDataModal onClose={() => setIsImportModalOpen(false)} onImport={importSessions} />}
      </Suspense>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
             <div>
                <CardTitle role="heading" aria-level={1} className="text-2xl font-bold flex items-center gap-2">
                    <BarChart2 className="h-7 w-7 text-primary"/>Analysis &amp; Reports
                </CardTitle>
                <CardDescription>Visualize student progress, analyze trends and write a progress narrative (for active goals).</CardDescription>
             </div>
             <div className="flex flex-wrap gap-2">
                {selectedStudent && (
                  <NarrativeDialog
                    student={selectedStudent}
                    goals={selectedGoalId ? activeStudentGoals.filter(g => g.id === selectedGoalId) : activeStudentGoals}
                    sessions={studentSessions}
                    rangeLabel={dateRange?.from ? `${formatDate(dateRange.from)} to ${formatDate(dateRange.to ?? new Date())}` : undefined}
                    disabled={activeStudentGoals.length === 0}
                  />
                )}
                {selectedStudent && (
                  <Button size="sm" asChild>
                    <Link href={`/progress-report?studentId=${selectedStudent.id}`}><FileText className="mr-2 h-4 w-4" /> Progress Report</Link>
                  </Button>
                )}
                <Button onClick={() => setIsImportModalOpen(true)} size="sm" variant="outline">
                    <Upload className="mr-2 h-4 w-4" /> Import Data
                </Button>
                <Button onClick={handleExportData} size="sm" variant="outline" disabled={periodSessions.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export Data
                </Button>
                {selectedStudent && (
                  <CsvExportWarning
                    studentName={selectedStudent.name}
                    open={isCsvWarningOpen}
                    onCancel={() => setIsCsvWarningOpen(false)}
                    onConfirm={() => { setIsCsvWarningOpen(false); downloadSessionsCsv(periodSessions, selectedStudent.name); }}
                  />
                )}
             </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Select value={selectedStudentId} onValueChange={handleStudentChange}>
              <SelectTrigger className="w-full md:w-[250px]" aria-label="Student">
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                {activeStudents.map(student => (
                  <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStudent && (
                <Select value={selectedGoalId} onValueChange={(value) => setSelectedGoalId(value === 'ALL_ACTIVE' ? undefined : value)}>
                    <SelectTrigger className="w-full md:w-[250px]" aria-label="Goal">
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
          {selectedStudent && attendance.missed > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Attendance:</span> {attendanceText(attendance)}. Missed sessions aren&apos;t included in the charts.
            </p>
          )}
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
            <Suspense fallback={<div className="mt-6"><Skeleton className="h-[300px] w-full" /></div>}>
              <TrialStatusChart 
                  studentSessions={studentSessions}
                  selectedStudent={selectedStudent}
                  selectedGoalId={selectedGoalId}
              />
            </Suspense>
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
                        <div className="flex gap-2">
                          <Skeleton className="h-9 w-32" />
                          <Skeleton className="h-9 w-32" />
                        </div>
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
