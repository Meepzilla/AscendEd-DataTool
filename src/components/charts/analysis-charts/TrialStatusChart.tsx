
'use client';

import React, { useMemo } from 'react';
import type { Student, SessionData, Goal, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckSquare, Check, X, CircleHelp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TrialSequenceChartProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
}

const TrialStatusSequenceChart: React.FC<TrialSequenceChartProps> = ({ studentSessions, selectedStudent, selectedGoalId }) => {

  const trialSequenceData = useMemo(() => {
    if (!selectedStudent) return [];

    const data = studentSessions.map(session => {
      const trialsForSession: TrialStatus[] = [];

      session.goals.forEach(goalData => {
        if (selectedGoalId && goalData.goalId !== selectedGoalId) return;

        if (goalData.goalType === 'DISCRETE_TRIALS' && Array.isArray(goalData.data.trials)) {
          trialsForSession.push(...goalData.data.trials);
        } else if (goalData.goalType === 'SEQUENCED_TRIALS') {
          // For sequenced trials, we don't have the order, so we represent the counts
          const successful = Number(goalData.data.successfulAttempts) || 0;
          const failed = Number(goalData.data.failedAttempts) || 0;
          const approximate = Number(goalData.data.approximate) || 0;
          
          for(let i = 0; i < successful; i++) trialsForSession.push('correct');
          for(let i = 0; i < approximate; i++) trialsForSession.push('approximate');
          for(let i = 0; i < failed; i++) trialsForSession.push('incorrect');
        }
      });
      
      const validTrials = trialsForSession.filter(t => t !== 'untouched');
      if (validTrials.length === 0) return null;

      return {
        date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        trials: validTrials,
      };
    }).filter(item => item !== null);

    return data as { date: string; trials: TrialStatus[]; }[];
  }, [studentSessions, selectedStudent, selectedGoalId]);
  

  if (trialSequenceData.length === 0) {
    return null; // Don't render the chart if there's no relevant data
  }

  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-primary" />
            Trial Sequence
          </CardTitle>
          <CardDescription>
            Visual sequence of trial outcomes (Correct, Approximate, Incorrect) for each session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] w-full pr-4">
            <TooltipProvider>
              <div className="space-y-4">
                {trialSequenceData.map((session, sessionIndex) => (
                  <div key={sessionIndex} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <p className="font-medium text-sm text-muted-foreground w-24 shrink-0">{session.date}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {session.trials.map((trial, trialIndex) => {
                        const statusClasses = {
                          untouched: 'bg-muted/50 border-dashed text-muted-foreground',
                          correct: 'bg-green-100 dark:bg-green-900/50 border-green-500 text-green-600 dark:text-green-400',
                          incorrect: 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-600 dark:text-red-400',
                          approximate: 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-500 text-yellow-600 dark:text-yellow-400',
                        };
                        const Icon = trial === 'correct' ? Check : trial === 'incorrect' ? X : trial === 'approximate' ? () => <span className="font-bold text-xs">A</span> : CircleHelp;

                        return (
                          <Tooltip key={trialIndex}>
                            <TooltipTrigger asChild>
                              <div className={cn("h-6 w-6 rounded-sm flex items-center justify-center border", statusClasses[trial])}>
                                <Icon className="h-4 w-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Trial {trialIndex + 1}: {trial}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialStatusSequenceChart;

