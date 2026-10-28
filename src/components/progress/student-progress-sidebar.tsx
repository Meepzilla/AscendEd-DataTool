
'use client';

import React, { useMemo } from 'react';
import type { Student, Goal, SessionData } from '@/lib/types';
import { goalDirection, progressTowardTarget } from '@/lib/goal-constants';
import { goalMeasure, goalMeasureInfo } from '@/lib/goal-measures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TrendingUp, CheckCircle2, ListChecks, BarChart2 } from 'lucide-react';
import { formatGoalTarget, studentProfilePath } from '@/lib/helpers';

/**
 * Progress (0-100) toward a goal's session target, from the latest session that has data for it: the goal's
 * measure (accuracy, story score, functions, rating, behavior measure...; see goal-measures) compared with
 * the target, where decrease goals are met at or below it. Without a target, the measure's own scale is used.
 */
const calculateProgressForGoal = (goal: Goal, latestSessionForGoal: SessionData | undefined): number => {
  if (goal.isArchived || !latestSessionForGoal) return 0;
  const data = latestSessionForGoal.goals.find(g => g.goalId === goal.id)?.data;
  if (!data) return 0;

  // Qualitative observations without a rating target count as met once notes are written.
  if (goal.type === 'QUALITATIVE_OBSERVATION' && !(goal.sessionTargetValue && goal.sessionTargetValue > 0)) {
    return String(data.notes || '').trim() ? 100 : 0;
  }

  const value = goalMeasure(goal, data);
  if (value === null) return 0;
  const target = goal.sessionTargetValue;
  if (target !== undefined && (target > 0 || goalDirection(goal) === 'decrease')) {
    return progressTowardTarget(value, target, goalDirection(goal));
  }
  const max = goalMeasureInfo(goal).max;
  return max ? Math.min(100, (value / max) * 100) : 0;
};


export default function StudentProgressSidebar({ student, studentSessions }: {student: Student, studentSessions: SessionData[]}) {
  if (!student) return null;

  const activeGoals = student.goals.filter(goal => !goal.isArchived);

  // Memoize the expensive calculation to run only when student or sessions change.
  const goalsWithProgress = useMemo(() => {
    if (!studentSessions || studentSessions.length === 0) {
      return activeGoals.map(goal => ({ ...goal, progress: 0 }));
    }

    // Create a map to store the latest session for each goal
    const latestSessionByGoalId = new Map<string, SessionData>();

    // Sort sessions once by date, descending. A copy is made to avoid mutating props.
    const sortedSessions = [...studentSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Iterate through sorted sessions to find the latest one for each goal
    // Every session stores all of the student's goals, so a goal's latest session is the latest one
    // where something was recorded for it (not one where it wasn't worked on).
    for (const session of sortedSessions) {
      for (const goalData of session.goals) {
        if (latestSessionByGoalId.has(goalData.goalId)) continue;
        const goal = activeGoals.find(g => g.id === goalData.goalId);
        const recorded = goal && (goal.type === 'QUALITATIVE_OBSERVATION' || goalMeasure(goal, goalData.data || {}) !== null);
        if (recorded) latestSessionByGoalId.set(goalData.goalId, session);
      }
    }

    // Now calculate progress for each active goal using its latest session
    return activeGoals.map(goal => {
      const latestSession = latestSessionByGoalId.get(goal.id);
      const progress = calculateProgressForGoal(goal, latestSession);
      return { ...goal, progress };
    });
  }, [activeGoals, studentSessions]);


  const activeGoalsWithProgressSliced = goalsWithProgress.slice(0, 5);

  const overallProgressValues = goalsWithProgress
    .map(g => g.progress)
    .filter(p => p !== undefined);

  const averageOverallProgress = overallProgressValues.length > 0
    ? overallProgressValues.reduce((sum, p) => sum + p, 0) / overallProgressValues.length
    : 0;

  return (
    <div className="p-2 space-y-3">
      <Card className="bg-sidebar-accent border-sidebar-border">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium text-sidebar-accent-foreground">
            Overall Progress (Active Goals)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>
              {averageOverallProgress > 75 ? "Excellent" : averageOverallProgress > 50 ? "Good" : averageOverallProgress > 25 ? "Fair" : "Needs Focus"}
            </span>
          </div>
          <Progress value={averageOverallProgress} className="h-2 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">{Math.round(averageOverallProgress)}% average completion of targets</p>
        </CardContent>
      </Card>

      {activeGoalsWithProgressSliced.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">Active Goals Overview</h4>
          {activeGoalsWithProgressSliced.map(goal => {
            const displayValue = goal.sessionTargetValue !== undefined && goal.type !== 'QUALITATIVE_OBSERVATION'
              ? `${Math.round(goal.progress)}% (Target: ${formatGoalTarget(goal.type, goal.sessionTargetValue, goal.targetDirection)})`
              : goal.type === 'QUALITATIVE_OBSERVATION'
                ? (goal.progress === 100 ? 'Noted' : 'No Notes') // Or actual rating
                : `${Math.round(goal.progress)}% (Actual)`;
            return (
              <div key={goal.id} className="p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                {/* The goal name gets its own line so it can wrap in full; the progress and target go below it. */}
                <p className="text-xs font-medium text-sidebar-foreground whitespace-normal break-words" title={goal.name}>{goal.name}</p>
                <p className={`text-[11px] font-semibold mt-0.5 mb-1 whitespace-normal break-words ${goal.progress >= 100 ? 'text-green-500' : goal.progress > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {displayValue}
                </p>
                <Progress value={goal.progress} className="h-1.5" indicatorClassName={goal.progress >= 100 ? 'bg-green-500' : goal.progress > 0 ? 'bg-primary' : 'bg-muted'}/>
              </div>
            );
          })}
        </div>
      )}

      {activeGoals.length > activeGoalsWithProgressSliced.length && (
         <p className="text-xs text-muted-foreground text-center px-1">
            + {activeGoals.length - activeGoalsWithProgressSliced.length} more active goals
          </p>
      )}

      {activeGoals.length === 0 && (
         <p className="text-xs text-muted-foreground text-center px-1 py-4">
            No active goals assigned.
          </p>
      )}

      <Link href={`/analysis-report?studentId=${student.id}`} passHref>
        <Button variant="outline" size="sm" className="w-full border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <BarChart2 className="mr-2 h-4 w-4" />
          View Full Analysis
        </Button>
      </Link>
      <Link href={studentProfilePath(student.id)} passHref>
        <Button variant="outline" size="sm" className="w-full border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <ListChecks className="mr-2 h-4 w-4" />
          Manage Goals
        </Button>
      </Link>
    </div>
  );
}
