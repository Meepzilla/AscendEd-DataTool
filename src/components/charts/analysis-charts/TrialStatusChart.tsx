'use client';

import React, { useMemo } from 'react';
import type { Student, SessionData } from '@/lib/types';
import { buildGoalTrialSequences, type ScoredTrialStatus } from '@/lib/report-chart-views';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckSquare, Check, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TrialSequenceChartProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
}

const STATUS_CLASSES: Record<ScoredTrialStatus, string> = {
  correct: 'bg-green-100 dark:bg-green-900/50 border-green-500 text-green-700 dark:text-green-400',
  approximate: 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-500 text-yellow-700 dark:text-yellow-400',
  incorrect: 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-700 dark:text-red-400',
};

const STATUS_NAMES: Record<ScoredTrialStatus, string> = {
  correct: 'Correct',
  approximate: 'Approximate',
  incorrect: 'Incorrect',
};

const TrialStatusSequenceChart: React.FC<TrialSequenceChartProps> = ({
  studentSessions,
  selectedStudent,
  selectedGoalId,
}) => {
  const groups = useMemo(() => {
    if (!selectedStudent) return [];
    return buildGoalTrialSequences(studentSessions, selectedStudent.goals, selectedGoalId);
  }, [studentSessions, selectedStudent, selectedGoalId]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" aria-hidden />
          Trial-by-Trial Sequence by Goal
        </CardTitle>
        <CardDescription>
          Order of trial outcomes within each session for Discrete Trials and Sequenced Trials goals. Look for warm-up errors on early trials or fatigue toward the end of a session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-label="Trial outcome legend">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-sm border', STATUS_CLASSES.correct)} aria-hidden>
              <Check className="h-3.5 w-3.5" />
            </span>
            Correct
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-sm border text-[11px] font-bold', STATUS_CLASSES.approximate)} aria-hidden>
              A
            </span>
            Approximate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-sm border', STATUS_CLASSES.incorrect)} aria-hidden>
              <X className="h-3.5 w-3.5" />
            </span>
            Incorrect
          </span>
        </div>

        <TooltipProvider>
          <div className="space-y-6 divide-y divide-border">
            {groups.map(group => (
              <div key={group.goalId} className="pt-5 first:pt-0 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{group.goalName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.typeLabel} · {group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'} · {group.totalTrials} {group.totalTrials === 1 ? 'trial' : 'trials'} ({group.overallAccuracyPct}% correct)
                    </p>
                  </div>
                  {group.firstHalfAccuracyPct !== null && group.secondHalfAccuracyPct !== null && (
                    <div className="rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground tabular-nums">
                      First half of trials: <strong className="font-medium text-foreground">{group.firstHalfAccuracyPct}%</strong>
                      {' · '}
                      Second half: <strong className="font-medium text-foreground">{group.secondHalfAccuracyPct}%</strong>
                    </div>
                  )}
                </div>

                <ScrollArea className={cn('w-full pr-3', group.sessions.length > 6 && 'h-[260px]')}>
                  <div className="space-y-2.5">
                    {group.sessions.map(session => (
                      <div key={session.sessionId} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2 sm:w-44 shrink-0">
                          <span className="text-xs font-medium text-foreground w-20 shrink-0" title={session.fullDate}>
                            {session.dateLabel}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {session.correct}/{session.total} ({session.accuracyPct}%)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {session.trials.map((trial, trialIndex) => (
                            <Tooltip key={trialIndex}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'h-6 w-6 rounded-sm flex items-center justify-center border text-xs font-bold',
                                    STATUS_CLASSES[trial],
                                  )}
                                  aria-label={`Trial ${trialIndex + 1}: ${STATUS_NAMES[trial]}`}
                                >
                                  {trial === 'correct' ? (
                                    <Check className="h-3.5 w-3.5" aria-hidden />
                                  ) : trial === 'incorrect' ? (
                                    <X className="h-3.5 w-3.5" aria-hidden />
                                  ) : (
                                    <span aria-hidden>A</span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{session.fullDate} · Trial {trialIndex + 1}: {STATUS_NAMES[trial]}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default TrialStatusSequenceChart;
