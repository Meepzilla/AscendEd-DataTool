'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { ArrowLeft, FileText, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { useStudentData } from '@/hooks/use-student-data';
import { compareSessionsOldestFirst, formatDate } from '@/lib/helpers';
import { buildProgressReport, type ProgressStatus } from '@/lib/report-narrative';
import { getOrganizationName } from '@/lib/organization';
import { attendanceSummary, attendanceText } from '@/lib/attendance';
import { schoolYearStart } from '@/lib/school-year';
import { periodService } from '@/lib/student-overview';
import ProgressReportDocument, { type ProgressReportEdits } from '@/components/reports/ProgressReportDocument';

// Reports → Progress Report: a printable IEP goal progress report for one student and reporting period. The
// figures, status and comments come from the same analysis as the written narrative; status and comments can be
// changed before printing (for this printout only, nothing is saved). Print → Save as PDF makes a PDF file.

const PREPARER_KEY = 'ascended_report_preparer';

type Period = 'last-30' | 'last-9-weeks' | 'school-year' | 'all' | 'custom';
const PERIOD_LABELS: Record<Period, string> = {
  'last-30': 'Last 30 days',
  'last-9-weeks': 'Last 9 weeks (a quarter)',
  'school-year': 'School year to date',
  all: 'All data',
  custom: 'Custom dates',
};

function startOfDay(d: Date) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function daysAgo(n: number) { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d; }

function rangeFor(period: Period, custom: DateRange | undefined): DateRange | undefined {
  switch (period) {
    case 'last-30': return { from: daysAgo(30), to: new Date() };
    case 'last-9-weeks': return { from: daysAgo(63), to: new Date() };
    case 'school-year': return { from: schoolYearStart(), to: new Date() };
    case 'custom': return custom;
    default: return undefined;
  }
}

function ProgressReportPage() {
  const { students, sessions, loading, updateStudentGoal } = useStudentData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeStudents = useMemo(() => students.filter(s => !s.isArchived), [students]);
  const studentId = searchParams.get('studentId') ?? activeStudents[0]?.id;
  const student = students.find(s => s.id === studentId);
  const activeGoals = useMemo(() => student?.goals.filter(g => !g.isArchived) ?? [], [student]);

  const [period, setPeriod] = useState<Period>('last-9-weeks');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [excludedGoals, setExcludedGoals] = useState<Set<string>>(new Set());
  const [preparedBy, setPreparedBy] = useState('');
  const [organization, setOrganization] = useState('');
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showCharts, setShowCharts] = useState(true);
  const [showNextSteps, setShowNextSteps] = useState(false);
  const [showService, setShowService] = useState(false);
  const [edits, setEdits] = useState<ProgressReportEdits>({ status: {}, comment: {} });
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    try { setPreparedBy(localStorage.getItem(PREPARER_KEY) ?? ''); } catch { /* not saved */ }
    setOrganization(getOrganizationName());
    setPortalReady(true);
  }, []);
  // A different student or period starts from fresh figures and comments.
  useEffect(() => { setEdits({ status: {}, comment: {} }); setExcludedGoals(new Set()); }, [studentId]);
  useEffect(() => { setEdits({ status: {}, comment: {} }); }, [period, customRange]);

  const range = rangeFor(period, customRange);
  const periodSessions = useMemo(() => {
    const from = range?.from ? startOfDay(range.from) : null;
    const to = range?.to ? new Date(range.to) : range?.from ? new Date(range.from) : null;
    to?.setHours(23, 59, 59, 999);
    return sessions
      .filter(s => s.studentId === studentId)
      .filter(s => (!from || new Date(s.date) >= from) && (!to || new Date(s.date) <= to))
      .reverse()
      .sort(compareSessionsOldestFirst);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, studentId, period, customRange]);

  const goals = useMemo(() => activeGoals.filter(g => !excludedGoals.has(g.id)), [activeGoals, excludedGoals]);
  const report = useMemo(
    () => (student ? buildProgressReport({ student, goals, sessions: periodSessions }) : []),
    [student, goals, periodSessions],
  );
  const attendance = periodSessions.length ? attendanceText(attendanceSummary(periodSessions)) : '';
  const sessionCount = periodSessions.filter(s => s.goals?.some(g => goals.some(goal => goal.id === g.goalId))).length;
  const periodLabel = range?.from
    ? `${formatDate(range.from)} – ${formatDate(range.to ?? range.from)}`
    : periodSessions.length
      ? `${formatDate(periodSessions[0].date)} – ${formatDate(periodSessions[periodSessions.length - 1].date)}`
      : 'All data';

  const savePreparer = (value: string) => {
    setPreparedBy(value);
    try { localStorage.setItem(PREPARER_KEY, value); } catch { /* kept for this visit */ }
  };
  const onEdit = (goalId: string, change: { status?: ProgressStatus; comment?: string }) => setEdits(prev => ({
    status: change.status ? { ...prev.status, [goalId]: change.status } : prev.status,
    comment: change.comment !== undefined ? { ...prev.comment, [goalId]: change.comment } : prev.comment,
  }));

  const print = () => {
    // The title becomes the PDF's file name when saving as PDF.
    const title = document.title;
    document.title = `Progress Report - ${student?.name ?? ''} - ${new Date().toISOString().slice(0, 10)}`;
    const restore = () => { document.title = title; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const settings = { preparedBy, organization, reportDate, showCharts, showNextSteps, showService };
  // Service minutes over the period (from the range, or the sessions' first to last day for All data).
  const service = useMemo(() => {
    if (!student || periodSessions.length === 0 && !range?.from) return undefined;
    const from = range?.from ?? new Date(periodSessions[0].date);
    const to = range?.to ?? (range?.from ? range.from : new Date(periodSessions[periodSessions.length - 1].date));
    return periodService(periodSessions, student.iep, from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, periodSessions, period, customRange]);
  // Saved with the student's goal (also editable in the goal's Edit window), so it carries over to later reports.
  const onTargetDate = (goalId: string, date: string) => {
    if (studentId) updateStudentGoal(studentId, goalId, { targetDate: date || undefined });
  };
  const documentProps = { studentName: student?.name ?? '', periodLabel, sessionCount, attendance, service, goals: report, settings, edits };

  if (loading && students.length === 0) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle role="heading" aria-level={1} className="flex items-center gap-2 text-2xl font-bold">
                <FileText className="h-7 w-7 text-primary" aria-hidden />Progress Report
              </CardTitle>
              <CardDescription>
                A printable IEP goal progress report. Review the progress and comments for each goal, then print it or
                save it as a PDF (in the print window, choose Save as PDF, or on iPad, Share → Save to Files).
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={studentId ? `/analysis-report?studentId=${studentId}` : '/analysis-report'}><ArrowLeft className="mr-2 h-4 w-4" />Reports</Link>
              </Button>
              <Button size="sm" onClick={print} disabled={!student || goals.length === 0}>
                <Printer className="mr-2 h-4 w-4" />Print or Save PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="report-student">Student</Label>
              <Select value={studentId} onValueChange={v => router.replace(`/progress-report?studentId=${v}`, { scroll: false })}>
                <SelectTrigger id="report-student"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {activeStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-period">Reporting period</Label>
              <Select value={period} onValueChange={v => setPeriod(v as Period)}>
                <SelectTrigger id="report-period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_LABELS) as Period[]).map(p => <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
              {period === 'custom' && <DatePickerWithRange date={customRange} setDate={setCustomRange} className="pt-1" />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-preparer">Prepared by</Label>
              <Input id="report-preparer" value={preparedBy} onChange={e => savePreparer(e.target.value)} placeholder="Name, title" autoComplete="name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-date">Report date</Label>
              <Input id="report-date" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            </div>
          </div>

          {activeGoals.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Goals to include</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {activeGoals.map(g => (
                  <div key={g.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`report-goal-${g.id}`}
                      checked={!excludedGoals.has(g.id)}
                      onCheckedChange={v => setExcludedGoals(prev => { const next = new Set(prev); if (v === true) next.delete(g.id); else next.add(g.id); return next; })}
                    />
                    <Label htmlFor={`report-goal-${g.id}`} className="font-normal">{g.name}</Label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch id="report-charts" checked={showCharts} onCheckedChange={setShowCharts} />
              <Label htmlFor="report-charts">Charts</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="report-next-steps" checked={showNextSteps} onCheckedChange={setShowNextSteps} />
              <Label htmlFor="report-next-steps">Suggested next steps</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="report-service-switch" checked={showService} onCheckedChange={setShowService} />
              <Label htmlFor="report-service-switch">Service minutes</Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Changes to progress, comments and the report date are for this printout only and aren&apos;t saved. A goal&apos;s
            target date is saved with the goal (also in Students → Edit Goal). The school or district name at the top
            of the report is set in <Link href="/settings" className="underline hover:text-primary">Settings</Link>.
          </p>
        </CardContent>
      </Card>

      {!student ? (
        <p className="text-muted-foreground">Add a student to make a progress report.</p>
      ) : activeGoals.length === 0 ? (
        <p className="text-muted-foreground">{student.name} has no active goals. Assign goals in Students first.</p>
      ) : goals.length === 0 ? (
        <p className="text-muted-foreground">Select at least one goal to include.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-muted/40 p-2 sm:p-6">
          <ProgressReportDocument {...documentProps} onEdit={onEdit} onTargetDate={onTargetDate} />
        </div>
      )}

      {/* The copy that is printed, outside the app's layout (see .print-only in globals.css). */}
      {portalReady && student && goals.length > 0 && createPortal(
        <div className="print-only" aria-hidden>
          <ProgressReportDocument {...documentProps} />
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function ProgressReportRoute() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <ProgressReportPage />
    </Suspense>
  );
}
