'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData, Student } from '@/lib/types';
import { buildProgressReport } from '@/lib/report-narrative';
import { AIM_STATUS_LABELS } from '@/lib/aim-line';
import { formatDateOnly } from '@/lib/helpers';
import { fillNameBlanks } from '@/lib/goal-blanks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusPill } from '@/components/reports/ProgressReportDocument';
import { goalCardId } from './goal-card-id';

// Reports → "At a glance": one row per goal in view, with the same progress status, latest value, average and
// target as the Progress Report, so the whole caseload of goals for a student can be read before the charts.
// Each goal's name jumps to its card under "Goal by Goal".

const TREND_LABELS = { improving: 'Improving', declining: 'Declining', stable: 'Steady', 'too few': '—' } as const;


interface Props {
  student: Student;
  goals: Goal[];
  /** The sessions held in the date range, oldest first. */
  sessions: SessionData[];
}

export default function GoalSummaryTable({ student, goals, sessions }: Props) {
  const rows = useMemo(() => buildProgressReport({ student, goals, sessions }), [student, goals, sessions]);
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>At a glance</CardTitle>
        <CardDescription>
          Every goal in view for the selected dates. Tap a goal&apos;s name to jump to its chart.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Goal</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Latest</TableHead>
              <TableHead>Average</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Target met</TableHead>
              <TableHead>Trend</TableHead>
              <TableHead>Aim line</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(g => (
              <TableRow key={g.goal.id}>
                <TableCell className="font-medium">
                  <a href={`#${goalCardId(g.goal.id)}`} className="underline-offset-2 hover:underline focus-visible:underline">
                    {fillNameBlanks(g.goal)}
                  </a>
                  <span className="block text-xs font-normal text-muted-foreground">{g.typeLabel}</span>
                </TableCell>
                <TableCell><StatusPill status={g.status} /></TableCell>
                <TableCell>
                  {g.latest ?? '—'}
                  {g.latest && g.latestDate && <span className="block text-xs text-muted-foreground">{formatDateOnly(g.latestDate)}</span>}
                </TableCell>
                <TableCell>{g.average ?? '—'}</TableCell>
                <TableCell>{g.targetLabel ?? '—'}</TableCell>
                <TableCell>{g.target !== undefined && g.sessionCount ? `${g.metCount} of ${g.sessionCount}` : '—'}</TableCell>
                <TableCell>{TREND_LABELS[g.trend]}</TableCell>
                <TableCell>{g.aimStatus ? AIM_STATUS_LABELS[g.aimStatus] : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
