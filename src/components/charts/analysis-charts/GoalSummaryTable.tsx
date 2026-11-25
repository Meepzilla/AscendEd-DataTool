'use client';

import React, { useMemo, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import type { Goal, SessionData, Student } from '@/lib/types';
import { buildProgressReport, type GoalProgress } from '@/lib/report-narrative';
import { AIM_STATUS_LABELS } from '@/lib/aim-line';
import { captureTypeOf, goalDirection } from '@/lib/goal-constants';
import { goalMeasureInfo } from '@/lib/goal-measures';
import { formatDateOnly } from '@/lib/helpers';
import { fillNameBlanks } from '@/lib/goal-blanks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusPill } from '@/components/reports/ProgressReportDocument';
import { goalCardId } from '@/lib/report-filters';
import ViewModeToggle from './ViewModeToggle';

// Reports → "At a glance": one row per goal in view, with the same progress status, latest value, average and
// target as the Progress Report, so the whole caseload of goals for a student can be read before the charts.
// Can be viewed as a table or as visual comparison bars; each goal's name jumps to its card under "Goal by Goal".

const TREND_LABELS = { improving: 'Improving', declining: 'Declining', stable: 'Steady', 'too few': '—' } as const;

type SummaryMode = 'table' | 'bars';

interface Props {
  student: Student;
  goals: Goal[];
  /** The sessions held in the date range, oldest first. */
  sessions: SessionData[];
}

/** Normalizes a goal's numeric average, latest value, and target onto a 0..100 visual bar scale. */
function goalVisualScale(g: GoalProgress) {
  const info = goalMeasureInfo(g.goal);
  const isGas = captureTypeOf(g.goal) === 'GOAL_ATTAINMENT_SCALE';
  const min = isGas ? -2 : (info.min ?? 0);
  const values = g.points.map(p => p.value);
  const avgNum = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const latestNum = values.length ? values[values.length - 1] : null;
  const maxCandidate = Math.max(
    info.max ?? 0,
    ...values,
    g.target ?? 0,
    1,
  );
  const max = isGas ? 2 : (info.max ?? Math.ceil(maxCandidate * 1.15));
  const span = Math.max(max - min, 1);
  const toPct = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v)
      ? null
      : Math.min(100, Math.max(0, ((v - min) / span) * 100));

  const avgBarPct = toPct(avgNum);
  const latestBarPct = toPct(latestNum);
  const targetMarkerPct = toPct(g.target);
  const metSharePct = g.target !== undefined && g.sessionCount > 0
    ? Math.round((g.metCount / g.sessionCount) * 100)
    : null;
  const isDecrease = goalDirection(g.goal) === 'decrease';

  return { avgBarPct, latestBarPct, targetMarkerPct, metSharePct, isDecrease };
}

export default function GoalSummaryTable({ student, goals, sessions }: Props) {
  const rows = useMemo(() => buildProgressReport({ student, goals, sessions }), [student, goals, sessions]);
  const [mode, setMode] = useState<SummaryMode>('table');

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>At a glance</CardTitle>
            <CardDescription>
              {mode === 'table'
                ? 'Every goal in view for the selected dates. Tap a goal\'s name to jump to its chart below.'
                : 'Visual comparison of each goal\'s period average (filled bar), latest score (dot), and target line. Tap a goal\'s name to jump to its chart.'}
            </CardDescription>
          </div>
          <ViewModeToggle
            label="At a glance display mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'table', label: 'Summary Table', icon: <Table2 className="h-3.5 w-3.5" aria-hidden /> },
              { value: 'bars', label: 'Comparison Bars', icon: <BarChart3 className="h-3.5 w-3.5" aria-hidden /> },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'table' ? (
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
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm bg-primary/80" aria-hidden /> Period average
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground shadow-sm" aria-hidden /> Latest session
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-0.5 bg-[hsl(var(--chart-5))]" aria-hidden /> Target
              </span>
            </div>
            <div className="divide-y divide-border">
              {rows.map(g => {
                const { avgBarPct, latestBarPct, targetMarkerPct, metSharePct, isDecrease } = goalVisualScale(g);
                return (
                  <div key={g.goal.id} className="py-3 first:pt-1 last:pb-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <a
                          href={`#${goalCardId(g.goal.id)}`}
                          className="font-medium text-sm underline-offset-2 hover:underline focus-visible:underline"
                        >
                          {fillNameBlanks(g.goal)}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {g.typeLabel} · {g.measureLabel}
                          {isDecrease ? ' (lower is better)' : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={g.status} />
                      </div>
                    </div>

                    {avgBarPct === null ? (
                      <p className="text-xs text-muted-foreground">No sessions recorded for this goal in the selected dates.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative h-5 w-full rounded-md bg-muted">
                          <div
                            className="h-full rounded-md bg-primary/80 transition-all"
                            style={{ width: `${Math.max(avgBarPct, 2)}%` }}
                            title={`Average: ${g.average ?? '—'}`}
                          />
                          {targetMarkerPct !== null && (
                            <div
                              className="absolute -top-1 -bottom-1 w-0.5 bg-[hsl(var(--chart-5))]"
                              style={{ left: `${targetMarkerPct}%` }}
                              title={`Target: ${g.targetLabel ?? ''}`}
                            />
                          )}
                          {latestBarPct !== null && (
                            <div
                              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
                              style={{ left: `${latestBarPct}%` }}
                              title={`Latest: ${g.latest ?? '—'}`}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>Avg: <strong className="font-medium text-foreground">{g.average ?? '—'}</strong></span>
                            <span>Latest: <strong className="font-medium text-foreground">{g.latest ?? '—'}</strong></span>
                            {g.targetLabel && <span>Target: <strong className="font-medium text-foreground">{g.targetLabel}</strong></span>}
                          </div>
                          <div className="flex flex-wrap gap-x-3">
                            {metSharePct !== null && (
                              <span>Met target: <strong className="font-medium text-foreground">{g.metCount}/{g.sessionCount} ({metSharePct}%)</strong></span>
                            )}
                            <span>Trend: <strong className="font-medium text-foreground">{TREND_LABELS[g.trend]}</strong></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
