
'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  QUICK_RANGES, QUICK_RANGE_LABELS, customRangeChoice, defaultReportStudent, rangeChoiceDates, readGoalChoice, readRangeChoice, readReportTab,
  rememberGoalChoice, rememberRangeChoice, rememberReportStudent, rememberReportTab, type QuickRange, type RangeChoice, type ReportTab,
} from '@/lib/report-filters';
import { useStudentData } from '@/hooks/use-student-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Info, BarChart2, Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import type { DateRange } from "react-day-picker";
import { useSearchParams, useRouter } from 'next/navigation';
import CsvExportWarning from '@/components/CsvExportWarning';
import { useToast } from '@/hooks/use-toast';
import { compareSessionsOldestFirst, formatDate, sessionInDateRange } from '@/lib/helpers';
import NarrativeDialog from '@/components/charts/NarrativeDialog';
import { attendanceSummary, attendanceText, isMissed } from '@/lib/attendance';
import { markReportViewed } from '@/lib/onboarding';
import { useAuth } from '@/hooks/use-auth';
import { LazyBoundary, retryableLazy } from '@/components/ui/lazy-boundary';

// Dynamically import the heavy charting component
const AnalysisCharts = retryableLazy(() => import('@/components/charts/AnalysisCharts'));
const ImportDataModal = retryableLazy(() => import('@/components/modals/import-data-modal'));

export default function AnalysisReportPage() {
  const { students, sessions, loading: studentsLoading, sessionsLoading, importSessions } = useStudentData();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [isCsvWarningOpen, setIsCsvWarningOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ReportTab>('progress');
  // The date filter: a quick range (worked out from today) or custom dates, remembered on this device.
  const [rangeChoice, setRangeChoice] = useState<RangeChoice | null>(null);
  useEffect(() => {
    setRangeChoice(readRangeChoice());
    setActiveTab(readReportTab());
  }, []);
  const chooseTab = (tab: ReportTab) => { setActiveTab(tab); rememberReportTab(tab); };
  const dateRange = useMemo<DateRange | undefined>(() => {
    const span = rangeChoiceDates(rangeChoice);
    return span?.from ? { from: span.from, to: span.to } : undefined;
  }, [rangeChoice]);
  const chooseRange = (choice: RangeChoice | null) => { setRangeChoice(choice); rememberRangeChoice(choice); };
  const activeQuickRange: QuickRange | null = !rangeChoice ? 'all' : 'quick' in rangeChoice ? rangeChoice.quick : null;
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const activeStudents = useMemo(() => students.filter(s => !s.isArchived), [students]);
  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);
  const activeStudentGoals = useMemo(() => selectedStudent?.goals.filter(g => !g.isArchived) || [], [selectedStudent]);
  // The goal filter belongs to the student: a newly chosen student gets the goal chosen for them last time
  // (if it is still an active goal), else all goals.
  const loadedStudentId = selectedStudent?.id;
  useEffect(() => {
    if (!loadedStudentId) return;
    const student = students.find(s => s.id === loadedStudentId);
    setSelectedGoalId(readGoalChoice(loadedStudentId, (student?.goals ?? []).filter(g => !g.isArchived).map(g => g.id)));
    // Only when the student changes: goal edits don't reset the filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedStudentId]);
  const chooseGoal = (goalId: string | undefined) => {
    setSelectedGoalId(goalId);
    if (loadedStudentId) rememberGoalChoice(loadedStudentId, goalId);
  };
  // A student's report has been seen: ticks off "See their progress" on the dashboard's Getting Started.
  const hasSelectedStudent = !!selectedStudent;
  useEffect(() => { if (uid && hasSelectedStudent) markReportViewed(uid); }, [uid, hasSelectedStudent]);

  useEffect(() => {
    const studentIdFromQuery = searchParams.get('studentId');

    // Case 1: URL has a student ID.
    if (studentIdFromQuery) {
      if (!studentsLoading && !activeStudents.some(s => s.id === studentIdFromQuery)) {
        const fallbackId = defaultReportStudent(activeStudents.map(s => s.id));
        setSelectedStudentId(fallbackId);
        router.replace(fallbackId ? `/analysis-report?studentId=${fallbackId}` : '/analysis-report', { scroll: false });
        return;
      }
      // If the state is not in sync with the URL, update it.
      if (selectedStudentId !== studentIdFromQuery) {
        setSelectedStudentId(studentIdFromQuery);
        // Remembered for the next visit, however the student was chosen (the picker, a link from a profile).
        if (activeStudents.some(s => s.id === studentIdFromQuery)) rememberReportStudent(studentIdFromQuery);
      }
    } 
    // Case 2: URL has no student ID, we're not loading, students exist, and no student is selected yet.
    // This is the default case on first load.
    else if (!studentsLoading && activeStudents.length > 0 && !selectedStudentId) {
      // The student chosen last time on this device, else the first student.
      const firstStudentId = defaultReportStudent(activeStudents.map(s => s.id))!;
      setSelectedStudentId(firstStudentId);
      // Update the URL to reflect this default selection.
      router.replace(`/analysis-report?studentId=${firstStudentId}`, { scroll: false });
    }
  }, [searchParams, activeStudents, studentsLoading, selectedStudentId, router]);
  
  const periodSessions = useMemo(() => {
    if (!selectedStudentId) return [];
    let filtered = sessions.filter(s => s.studentId === selectedStudentId);
    filtered = filtered.filter(s => sessionInDateRange(s.date, dateRange?.from, dateRange?.to));
    // Stored sessions are newest first, so sessions with the same date and start time are in reverse saved order;
    // reversing first keeps them in saved order (the last saved is the latest, as in the sidebar).
    return filtered.reverse().sort(compareSessionsOldestFirst);
  }, [sessions, selectedStudentId, dateRange]);
  // Charts and the narrative use the sessions that took place; missed sessions are shown as attendance.
  const studentSessions = useMemo(() => periodSessions.filter(s => !isMissed(s)), [periodSessions]);
  // Every session of the student, whatever the date range: GAS levels carry forward from before the range.
  const studentHistory = useMemo(
    () => (selectedStudentId ? sessions.filter(s => s.studentId === selectedStudentId && !isMissed(s)).reverse().sort(compareSessionsOldestFirst) : []),
    [sessions, selectedStudentId],
  );
  const attendance = useMemo(() => attendanceSummary(periodSessions), [periodSessions]);

  const handleStudentChange = (value: string) => {
    setSelectedStudentId(value);
    rememberReportStudent(value);
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
      {isImportModalOpen && (
        <LazyBoundary label="Import Data dialog" onDismiss={() => setIsImportModalOpen(false)}>
          <Suspense fallback={null}>
            <ImportDataModal onClose={() => setIsImportModalOpen(false)} onImport={importSessions} />
          </Suspense>
        </LazyBoundary>
      )}
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
                    key={selectedStudent.id}
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
                    onConfirm={(deidentified) => {
                      setIsCsvWarningOpen(false);
                      void import('@/lib/session-csv')
                        .then(({ downloadSessionsCsv }) => downloadSessionsCsv(periodSessions, selectedStudent.name, { deidentified }))
                        .catch(() => {
                          toast({ title: 'Export Failed', description: 'Could not save the CSV file on this device.', variant: 'destructive' });
                        });
                    }}
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
                <Select value={selectedGoalId ?? 'ALL_ACTIVE'} onValueChange={(value) => chooseGoal(value === 'ALL_ACTIVE' ? undefined : value)}>
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
            <DatePickerWithRange date={dateRange} setDate={range => chooseRange(customRangeChoice(range))} className="w-full md:w-auto"/>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick date ranges">
            {QUICK_RANGES.map(range => (
              <Button key={range} type="button" size="sm" variant={activeQuickRange === range ? 'default' : 'outline'} className="min-h-11"
                aria-pressed={activeQuickRange === range} onClick={() => chooseRange(range === 'all' ? null : { quick: range })}>
                {QUICK_RANGE_LABELS[range]}
              </Button>
            ))}
          </div>
          {selectedStudent && attendance.missed > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Attendance:</span> {attendanceText(attendance)}. Missed sessions aren&apos;t included in the progress charts —{' '}
              <button
                type="button"
                className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
                onClick={() => chooseTab('attendance')}
              >
                open the Attendance tab
              </button>{' '}
              to view them by month and on a calendar.
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
        <LazyBoundary label="Analysis charts">
          <Suspense fallback={<AnalysisReportChartsSkeleton />}>
            <AnalysisCharts 
              studentSessions={studentSessions}
              periodSessions={periodSessions}
              studentHistory={studentHistory}
              selectedStudent={selectedStudent}
              selectedGoalId={selectedGoalId}
              sessionsLoading={sessionsLoading}
              activeTab={activeTab}
              onTabChange={chooseTab}
            />
          </Suspense>
        </LazyBoundary>
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
