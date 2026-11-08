'use client';

import React, { useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, Clock, Pencil, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentData } from '@/hooks/use-student-data';
import { formatDate, formatDateOnly } from '@/lib/helpers';
import { MISSED_REASON_SHORT } from '@/lib/attendance';
import { daysUntil, formatMinutes, serviceLines, sessionServiceMinutes, studentOverview, type ServiceLineSummary } from '@/lib/student-overview';
import { schoolYearLabel } from '@/lib/school-year';
import type { ServicePer, ServiceRequirement, ServiceType, SessionData, Student, StudentIep } from '@/lib/types';
import { SERVICE_TYPE_LABELS, SERVICE_TYPES } from '@/lib/types';
import { cn } from '@/lib/utils';

// The student profile's Overview: IEP dates (with how soon each is due), service minutes delivered against what
// the IEP requires (this and last week or month, and the school year), and attendance for the school year.
// IEP dates and required minutes are set with Edit IEP Details and saved with the student.

export function DueBadge({ date }: { date: string }) {
  const days = daysUntil(date);
  const text = days < 0 ? `Overdue by ${-days} day${days === -1 ? '' : 's'}` : days === 0 ? 'Due today' : `In ${days} day${days === 1 ? '' : 's'}`;
  const tone = days < 0 ? 'border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300' : days <= 30 ? 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'border-border bg-muted/50 text-muted-foreground';
  return <span className={cn('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold', tone)}>{text}</span>;
}

function Panel({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border p-4" aria-label={title}>
      <h3 className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" aria-hidden />{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium">{children}</span>
    </div>
  );
}

/** One service type's block in the multi-type layout: its own requirement, period and progress. */
function ServiceLineBlock({ line }: { line: ServiceLineSummary }) {
  const periodWord = line.per === 'year' ? 'school year' : line.per === 'month' ? 'month' : 'week';
  const required = line.required ?? 0;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{line.label}</p>
      <Row label="Required">{required} min per {periodWord}</Row>
      <Row label={`This ${periodWord}`}>{line.thisPeriod} of {required} min</Row>
      <Progress
        value={required > 0 ? Math.min(100, (line.thisPeriod / required) * 100) : 0}
        className="h-2"
        indicatorClassName={line.thisPeriod >= required ? 'bg-green-500' : 'bg-primary'}
        aria-label={`${line.label} service minutes this ${periodWord}`}
      />
      {line.per === 'year' ? (
        <Row label="Remaining">{Math.max(0, required - line.thisPeriod)} min</Row>
      ) : (
        <Row label={`Last ${periodWord}`}>
          {line.lastPeriod} min
          {line.lastPeriod < required && <span className="text-xs text-amber-700 dark:text-amber-300">({required - line.lastPeriod} min short)</span>}
        </Row>
      )}
    </div>
  );
}

export default function StudentOverviewCard({ student, sessions }: { student: Student; sessions: SessionData[] }) {
  const [editing, setEditing] = useState(false);
  const overview = useMemo(() => studentOverview(sessions, student.iep), [sessions, student.iep]);
  const iep = student.iep ?? {};
  const { service, attendance } = overview;
  const periodWord = service.per === 'year' ? 'school year' : service.per === 'month' ? 'month' : 'week';
  // Per-type layout once the IEP splits minutes across types, or minutes of a second type were delivered.
  const lineTypes = new Set(overview.lines.map(l => l.type));
  const otherTypeDelivered = overview.lines.length === 1 && sessions.some(s =>
    Object.entries(sessionServiceMinutes(s)).some(([t, v]) => (v ?? 0) > 0 && !lineTypes.has(t as ServiceType)));
  const multiType = overview.lines.length > 1 || otherTypeDelivered;
  const dates: [string, string | undefined, boolean][] = [
    ['IEP date', iep.iepDate, false],
    ['Annual review due', iep.annualReviewDate, true],
    ['Re-evaluation due', iep.reevaluationDate, true],
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-xl">Overview</CardTitle>
          <CardDescription>IEP dates, service minutes and attendance. School year: {schoolYearLabel()} (set in Settings).</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" />Edit IEP Details
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <Panel icon={CalendarDays} title="IEP Dates">
          {dates.some(([, d]) => d) ? dates.map(([label, date, due]) => (
            <Row key={label} label={label}>
              {date ? <>{formatDateOnly(date)}{due && <DueBadge date={date} />}</> : <span className="text-muted-foreground">—</span>}
            </Row>
          )) : <p className="text-sm text-muted-foreground">No IEP dates yet. Add them with Edit IEP Details.</p>}
        </Panel>

        <Panel icon={Clock} title="Service Minutes">
          {multiType ? (
            <>
              {overview.lines.map(line => <ServiceLineBlock key={line.type} line={line} />)}
              <Row label="School year total">{formatMinutes(service.schoolYear)}</Row>
              {service.untimed > 0 && (
                <p className="text-xs text-muted-foreground">{service.untimed} session{service.untimed === 1 ? '' : 's'} without start and end times {service.untimed === 1 ? 'isn\'t' : 'aren\'t'} counted.</p>
              )}
            </>
          ) : service.required ? (
            <>
              <Row label="Required">{service.required} min per {periodWord}</Row>
              <Row label={`This ${periodWord}`}>{service.thisPeriod} of {service.required} min</Row>
              <Progress
                value={Math.min(100, (service.thisPeriod / service.required) * 100)}
                className="h-2"
                indicatorClassName={service.thisPeriod >= service.required ? 'bg-green-500' : 'bg-primary'}
                aria-label={`Service minutes this ${periodWord}`}
              />
              {service.per === 'year' ? (
                <Row label="Remaining">{Math.max(0, service.required - service.thisPeriod)} min</Row>
              ) : (
                <Row label={`Last ${periodWord}`}>
                  {service.lastPeriod} min
                  {service.lastPeriod < service.required && <span className="text-xs text-amber-700 dark:text-amber-300">({service.required - service.lastPeriod} min short)</span>}
                </Row>
              )}
            </>
          ) : (
            <>
              <Row label={`This ${periodWord}`}>{service.thisPeriod} min</Row>
              <p className="text-sm text-muted-foreground">Add the required minutes with Edit IEP Details to track them.</p>
            </>
          )}
          {service.per !== 'year' && <Row label="School year">{formatMinutes(service.schoolYear)}</Row>}
          {service.untimed > 0 && (
            <p className="text-xs text-muted-foreground">{service.untimed} session{service.untimed === 1 ? '' : 's'} without start and end times {service.untimed === 1 ? 'isn\'t' : 'aren\'t'} counted.</p>
          )}
        </Panel>

        <Panel icon={UserCheck} title="Attendance">
          {attendance.held + attendance.missed === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions this school year yet.</p>
          ) : (
            <>
              <Row label="Attended">{overview.attendanceRate}%</Row>
              <Row label="Sessions held">{attendance.held}</Row>
              <Row label="Sessions missed">{attendance.missed}</Row>
              {attendance.byReason.map(r => (
                <Row key={r.reason} label={`· ${MISSED_REASON_SHORT[r.reason]}`}>{r.count}</Row>
              ))}
            </>
          )}
          <Row label="Last session">{overview.lastSessionDate ? formatDate(overview.lastSessionDate) : '—'}</Row>
        </Panel>
      </CardContent>
      {editing && <IepDetailsDialog student={student} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function IepDetailsDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const { updateStudent } = useStudentData();
  const [form, setForm] = useState<StudentIep>({ servicePer: 'week', ...student.iep });
  const [rows, setRows] = useState<ServiceRequirement[]>(() => {
    const initial = serviceLines(student.iep);
    return initial.length > 0 ? initial : [{ type: 'related', minutes: 0, per: 'week' }];
  });
  const [saving, setSaving] = useState(false);
  const set = (change: Partial<StudentIep>) => setForm(prev => ({ ...prev, ...change }));
  const setRow = (index: number, change: Partial<ServiceRequirement>) =>
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const unusedTypes = SERVICE_TYPES.filter(t => !rows.some(r => r.type === t));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const services = rows
      .filter(row => row.minutes > 0)
      .map(row => ({ type: row.type, minutes: Math.round(row.minutes), per: row.per }));
    const first = services[0];
    const iep: StudentIep = {
      ...(form.iepDate ? { iepDate: form.iepDate } : {}),
      ...(form.annualReviewDate ? { annualReviewDate: form.annualReviewDate } : {}),
      ...(form.reevaluationDate ? { reevaluationDate: form.reevaluationDate } : {}),
      // The per-type lines are the record; the legacy fields mirror the first line so an older build
      // reading the same data still shows the primary requirement.
      ...(first ? { serviceMinutes: first.minutes, servicePer: first.per } : {}),
      ...(services.length > 0 ? { services } : {}),
    };
    await updateStudent(student.id, { iep });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      {/* Wide enough for three date fields side by side on iPad. Safari draws date fields at their own width
          unless they are blocks without the native look, so they're kept to their column that way. */}
      <DialogContent className="sm:max-w-3xl">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" aria-hidden />IEP Details: {student.name}</DialogTitle>
            <DialogDescription>Dates from the student&apos;s IEP and the service minutes it requires. Leave any blank.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3 [&_input]:block [&_input]:w-full [&_input]:min-w-0 [&_input]:appearance-none [&_input::-webkit-date-and-time-value]:text-left">
            <div className="space-y-1">
              <Label htmlFor="iep-date" className="whitespace-nowrap">IEP date</Label>
              <Input id="iep-date" type="date" value={form.iepDate ?? ''} onChange={e => set({ iepDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iep-annual" className="whitespace-nowrap">Annual review due</Label>
              <Input id="iep-annual" type="date" value={form.annualReviewDate ?? ''} onChange={e => set({ annualReviewDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iep-reeval" className="whitespace-nowrap">Re-evaluation due</Label>
              <Input id="iep-reeval" type="date" value={form.reevaluationDate ?? ''} onChange={e => set({ reevaluationDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Service minutes required</Label>
            {rows.map((row, index) => (
              <div key={row.type} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`iep-type-${index}`} className="sr-only">Service type</Label>
                  <Select value={row.type} onValueChange={v => setRow(index, { type: v as ServiceType })}>
                    <SelectTrigger id={`iep-type-${index}`} className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES
                        .filter(t => t === row.type || !rows.some(r => r.type === t))
                        .map(t => <SelectItem key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`iep-minutes-${index}`} className="sr-only">Minutes</Label>
                  <Input id={`iep-minutes-${index}`} type="number" min="0" step="5" className="w-32" placeholder="e.g., 60"
                    value={row.minutes || ''} onChange={e => setRow(index, { minutes: e.target.value === '' ? 0 : Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`iep-per-${index}`} className="sr-only">Per</Label>
                  <Select value={row.per} onValueChange={v => setRow(index, { per: v as ServicePer })}>
                    <SelectTrigger id={`iep-per-${index}`} className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">School year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRows(prev => prev.filter((_, i) => i !== index))}>
                  Remove
                </Button>
              </div>
            ))}
            {unusedTypes.length > 0 && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => setRows(prev => [...prev, { type: unusedTypes[0], minutes: 0, per: prev[0]?.per ?? 'week' }])}>
                Add service type
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Minutes delivered come from each session&apos;s start and end times in Data Entry. Missed sessions don&apos;t count.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
