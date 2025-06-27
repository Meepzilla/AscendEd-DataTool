
'use client';

import React, { useMemo } from 'react';
import type { Student, Goal, SessionData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TrendingUp, CheckCircle2, ListChecks, BarChart2 } from 'lucide-react';

/**
 * Calculates the progress percentage for a single goal based on its latest session data.
 * @param goal The goal to calculate progress for.
 * @param latestSessionForGoal The single latest session that contains data for this goal.
 * @returns A progress percentage (0-100).
 */
const calculateProgressForGoal = (goal: Goal, latestSessionForGoal: SessionData | undefined): number => {
  if (goal.isArchived || !latestSessionForGoal) return 0;

  const goalSessionData = latestSessionForGoal.goals.find(g => g.goalId === goal.id)?.data;
  if (!goalSessionData) return 0;

  let actualPerformancePct = 0;

  switch (goal.type) {
    case 'ARTICULATION': {
      const correct = Number(goalSessionData.correct) || 0;
      const incorrect = Number(goalSessionData.incorrect) || 0;
      const total = correct + incorrect;
      actualPerformancePct = total > 0 ? (correct / total) * 100 : 0;
      break;
    }
    case 'LANGUAGE_COMPREHENSION': {
      const correct = Number(goalSessionData.questionsCorrect) || 0;
      const incorrect = Number(goalSessionData.questionsIncorrect) || 0;
      const total = correct + incorrect;
      actualPerformancePct = total > 0 ? (correct / total) * 100 : 0;
      break;
    }
    case 'LANGUAGE_EXPRESSION': {
      const successful = Number(goalSessionData.successfulResponses) || 0;
      const unsuccessful = Number(goalSessionData.unsuccessfulResponses) || 0;
      const total = successful + unsuccessful;
      actualPerformancePct = total > 0 ? (successful / total) * 100 : 0;
      break;
    }
    case 'PHONOLOGICAL_PROCESSES': {
      const correct = Number(goalSessionData.correctProductions) || 0;
      const incorrect = Number(goalSessionData.incorrectProductions) || 0;
      const total = correct + incorrect;
      actualPerformancePct = total > 0 ? (correct / total) * 100 : 0;
      break;
    }
    case 'FLUENCY_SYLLABLE_STUTTER': {
      const totalSyllables = Number(goalSessionData.totalSyllables) || 0;
      const stutteredSyllables = Number(goalSessionData.stutteredSyllables) || 0;
      const fluentSyllables = Math.max(0, totalSyllables - stutteredSyllables);
      actualPerformancePct = totalSyllables > 0 ? (fluentSyllables / totalSyllables) * 100 : 0;
      break;
    }
    case 'FEEDING_SWALLOWING': {
      const accepted = Number(goalSessionData.trialsAccepted || 0);
      const refused = Number(goalSessionData.trialsRefused || 0);
      const total = accepted + refused;
      actualPerformancePct = total > 0 ? (accepted / total) * 100 : 0;
      break;
    }
    case 'QUALITATIVE_OBSERVATION': {
      if (goal.sessionTargetValue !== undefined && goal.sessionTargetValue > 0 && goalSessionData.rating !== undefined) {
        if (goalSessionData.rating !== undefined) {
          actualPerformancePct = (Number(goalSessionData.rating) / 5) * 100;
        } else {
          actualPerformancePct = (goalSessionData.notes && String(goalSessionData.notes).trim() !== '') ? 100 : 0;
        }
      } else {
        actualPerformancePct = (goalSessionData.notes && String(goalSessionData.notes).trim() !== '') ? 100 : 0;
      }
      break;
    }
    default:
      return 0;
  }

  actualPerformancePct = Math.min(Math.max(actualPerformancePct, 0), 100);

  if (goal.sessionTargetValue !== undefined && goal.sessionTargetValue > 0 && goal.type !== 'QUALITATIVE_OBSERVATION') {
    const progressTowardsTarget = (actualPerformancePct / goal.sessionTargetValue) * 100;
    return Math.min(Math.max(progressTowardsTarget, 0), 100);
  }

  return actualPerformancePct;
};


export default function StudentProgressSidebar({ student, studentSessions }: StudentProgressSidebarProps) {
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
    for (const session of sortedSessions) {
      for (const goalData of session.goals) {
        // Since sessions are sorted, the first time we see a goalId, it's from the latest session for that goal.
        if (!latestSessionByGoalId.has(goalData.goalId)) {
          latestSessionByGoalId.set(goalData.goalId, session);
        }
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
              ? `${Math.round(goal.progress)}% (Target: ${goal.sessionTargetValue}%)`
              : goal.type === 'QUALITATIVE_OBSERVATION'
                ? (goal.progress === 100 ? 'Noted' : 'No Notes') // Or actual rating
                : `${Math.round(goal.progress)}% (Actual)`;
            return (
              <div key={goal.id} className="p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                <div className="flex justify-between items-center text-xs mb-1">
                  <p className="font-medium text-sidebar-foreground truncate pr-2" title={goal.name}>{goal.name}</p>
                  <span className={`font-semibold ${goal.progress >= (goal.sessionTargetValue ?? 100) ? 'text-green-500' : goal.progress > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {displayValue}
                  </span>
                </div>
                <Progress value={goal.progress} className="h-1.5" indicatorClassName={goal.progress >= (goal.sessionTargetValue ?? 100) ? 'bg-green-500' : goal.progress > 0 ? 'bg-primary' : 'bg-muted'}/>
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
      <Link href={`/student-profile/${student.id}`} passHref>
        <Button variant="outline" size="sm" className="w-full border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <ListChecks className="mr-2 h-4 w-4" />
          Manage Goals
        </Button>
      </Link>
    </div>
  );
}
