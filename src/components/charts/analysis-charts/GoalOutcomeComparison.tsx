'use client';

import React, { useMemo, useState } from 'react';
import { BarChart2, Hash, Percent } from 'lucide-react';
import type { Goal, SessionData } from '@/lib/types';
import { buildGoalOutcomeComparison } from '@/lib/report-chart-views';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ViewModeToggle from './ViewModeToggle';

interface GoalOutcomeComparisonProps {
  studentSessions: SessionData[];
  activeStudentGoals: Goal[];
  selectedGoalId?: string;
}

type OutcomeScale = 'percent' | 'counts';

/**
 * Replaces the old Sankey diagram with a clear side-by-side horizontal breakdown of
 * Correct, Approximate, and Incorrect responses per trial-based goal.
 */
const GoalOutcomeComparison: React.FC<GoalOutcomeComparisonProps> = ({
  studentSessions,
  activeStudentGoals,
  selectedGoalId,
}) => {
  const [scale, setScale] = useState<OutcomeScale>('percent');

  const rows = useMemo(
    () => buildGoalOutcomeComparison(studentSessions, activeStudentGoals, selectedGoalId),
    [studentSessions, activeStudentGoals, selectedGoalId],
  );

  if (rows.length === 0) return null;

  const maxOpportunities = Math.max(...rows.map(r => r.opportunities), 1);
  const hasAnyApproximate = rows.some(r => r.approximate > 0);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" aria-hidden />
              Outcome Breakdown by Goal
            </CardTitle>
            <CardDescription>
              {scale === 'percent'
                ? 'Share of Correct, Approximate, and Incorrect responses for each trial-based goal, compared directly against its target.'
                : 'Total trial counts per goal, showing which skills received the most practice opportunities in this period.'}
            </CardDescription>
          </div>
          <ViewModeToggle
            label="Outcome comparison scale"
            value={scale}
            onChange={setScale}
            options={[
              { value: 'percent', label: 'Percentage (%)', icon: <Percent className="h-3.5 w-3.5" aria-hidden /> },
              { value: 'counts', label: 'Trial Counts', icon: <Hash className="h-3.5 w-3.5" aria-hidden /> },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-2))]" aria-hidden /> Correct
          </span>
          {hasAnyApproximate && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-4))]" aria-hidden /> Approximate
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[hsl(var(--chart-5))]" aria-hidden /> Incorrect
          </span>
          {scale === 'percent' && rows.some(r => r.target !== null && r.target >= 0 && r.target <= 100) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-0.5 bg-foreground" aria-hidden /> Goal target
            </span>
          )}
        </div>

        <div className="divide-y divide-border">
          {rows.map(row => {
            const denom = scale === 'percent' ? row.opportunities : maxOpportunities;
            const correctWidth = (row.correct / denom) * 100;
            const approxWidth = (row.approximate / denom) * 100;
            const incorrectWidth = (row.incorrect / denom) * 100;
            const showTargetLine = scale === 'percent' && row.target !== null && row.target >= 0 && row.target <= 100;

            return (
              <div key={row.goalId} className="py-3 first:pt-1 last:pb-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">{row.goalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.typeLabel} · {row.sessionCount} {row.sessionCount === 1 ? 'session' : 'sessions'} · {row.opportunities.toLocaleString()} {row.opportunities === 1 ? 'trial' : 'trials'}
                    </p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <span className="text-sm font-semibold text-foreground">{row.correctPct}% correct</span>
                    {row.target !== null && (
                      <span className="ml-2 text-muted-foreground">(Target {row.target}%)</span>
                    )}
                  </div>
                </div>

                <div
                  className="relative flex h-5 w-full overflow-hidden rounded-md bg-muted"
                  role="img"
                  aria-label={`${row.goalName}: ${row.correct} correct (${row.correctPct}%), ${row.approximate} approximate (${row.approximatePct}%), ${row.incorrect} incorrect (${row.incorrectPct}%)`}
                >
                  {row.correct > 0 && (
                    <div
                      className="h-full bg-[hsl(var(--chart-2))] transition-all"
                      style={{ width: `${correctWidth}%` }}
                      title={`Correct: ${row.correct} (${row.correctPct}%)`}
                    />
                  )}
                  {row.approximate > 0 && (
                    <div
                      className="h-full bg-[hsl(var(--chart-4))] transition-all"
                      style={{ width: `${approxWidth}%` }}
                      title={`Approximate: ${row.approximate} (${row.approximatePct}%)`}
                    />
                  )}
                  {row.incorrect > 0 && (
                    <div
                      className="h-full bg-[hsl(var(--chart-5))] transition-all"
                      style={{ width: `${incorrectWidth}%` }}
                      title={`Incorrect: ${row.incorrect} (${row.incorrectPct}%)`}
                    />
                  )}
                  {showTargetLine && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-foreground shadow-sm"
                      style={{ left: `${row.target}%` }}
                      title={`Target: ${row.target}%`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                  <span>Correct: <strong className="font-medium text-foreground">{row.correct}</strong> ({row.correctPct}%)</span>
                  {row.approximate > 0 && (
                    <span>Approximate: <strong className="font-medium text-foreground">{row.approximate}</strong> ({row.approximatePct}%)</span>
                  )}
                  <span>Incorrect: <strong className="font-medium text-foreground">{row.incorrect}</strong> ({row.incorrectPct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoalOutcomeComparison;
