'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import { LAST_BACKUP_KEY } from '@/lib/backup';
import { studentProfilePath } from '@/lib/helpers';
import { REPORT_VIEWED_KEY } from '@/lib/onboarding';

// The dashboard's Getting Started checklist for someone new to the app: the five steps from Help → Getting
// started, each ticked off from what has been done (a student, a goal, a session, a report, a backup). It goes
// away once every step is done, or when hidden; both are remembered on this device.

const HIDDEN_KEY = 'ascended_getting_started_hidden';

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

export default function GettingStarted() {
  const { students, sessions, sessionsLoading, openAddStudentModal } = useStudentData();
  const [stored, setStored] = useState<{ hidden: boolean; reportViewed: boolean; backedUp: boolean } | null>(null);
  // Read after the first render (the page made at build time has no stored state).
  useEffect(() => {
    setStored({ hidden: read(HIDDEN_KEY) === '1', reportViewed: read(REPORT_VIEWED_KEY) === '1', backedUp: !!read(LAST_BACKUP_KEY) });
  }, [students.length, sessions.length]);

  if (!stored || stored.hidden || sessionsLoading) return null;

  const active = students.filter(s => !s.isArchived);
  const withGoals = active.find(s => s.goals.some(g => !g.isArchived));
  // Someone who has recorded sessions on several days has seen the reports before this checklist existed.
  const sessionDays = new Set(sessions.map(s => new Date(s.date).toDateString())).size;
  const steps = [
    { done: active.length > 0, title: 'Add your first student', detail: 'Use Add Student, or import several with their IEP dates and goals from a spreadsheet or IEP at a Glance PDF (Settings → Import Students).',
      action: { label: 'Add Student', onClick: openAddStudentModal } },
    { done: !!withGoals, title: 'Give them goals', detail: 'On the student\'s profile, choose Assign / Create Goal: pick from the goal bank, or paste your own goal and the rest is filled in.',
      action: active[0] ? { label: 'Open profile', href: studentProfilePath(active[0].id) } : { label: 'Students', href: '/student-profile' } },
    { done: sessions.length > 0, title: 'Record a session', detail: 'In Data Entry, add the student, tap to count correct and incorrect responses (and prompts), then Save All.',
      action: { label: 'Data Entry', href: '/data-entry' } },
    { done: stored.reportViewed || sessionDays >= 3, title: 'See their progress', detail: 'Reports shows charts for each goal, writes a progress narrative and prints a progress report.',
      action: { label: 'Reports', href: '/analysis-report' } },
    { done: stored.backedUp, title: 'Back up your data', detail: 'Everything is stored only on this device. A backup file is the only way to get it back if the device is lost or reset.',
      action: { label: 'Back Up', href: '/settings' } },
  ];
  const doneCount = steps.filter(s => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.findIndex(s => !s.done);

  const hide = () => {
    try { localStorage.setItem(HIDDEN_KEY, '1'); } catch { /* hidden for this visit */ }
    setStored(prev => prev && { ...prev, hidden: true });
  };

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Rocket className="h-5 w-5 text-primary" aria-hidden />Getting Started</CardTitle>
            <CardDescription>
              {doneCount} of {steps.length} done. Each step ticks off by itself. More in <Link href="/help#start" className="underline hover:text-primary">Help</Link>.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={hide} aria-label="Hide Getting Started">
            <X className="mr-1 h-4 w-4" aria-hidden />Hide
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={step.title} className={`flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center ${i === next ? 'border-primary/60 bg-primary/5' : ''}`}>
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {step.done
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-500" aria-label="Done" />
                  : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="To do" />}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}>{i + 1}. {step.title}</p>
                  {!step.done && <p className="text-xs text-muted-foreground">{step.detail}</p>}
                </div>
              </div>
              {!step.done && (
                'href' in step.action
                  ? <Button asChild size="sm" variant={i === next ? 'default' : 'outline'} className="shrink-0"><Link href={step.action.href!}>{step.action.label}</Link></Button>
                  : <Button type="button" size="sm" variant={i === next ? 'default' : 'outline'} className="shrink-0" onClick={step.action.onClick}>{step.action.label}</Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
