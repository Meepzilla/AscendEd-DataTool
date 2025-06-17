
'use client';

import React from 'react';
import type { Student, Goal, SessionData, SessionGoalData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TrendingUp, CheckCircle2, ListChecks, BarChart2 } from 'lucide-react';

interface StudentProgressSidebarProps {
  student: Student;
  studentSessions: SessionData[];
}

const getGoalProgress = (goal: Goal, studentSessions: SessionData[]): number => {
  const latestSessionForGoal = studentSessions
    .filter(s => s.goals.some(sg => sg.goalId === goal.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    [0];

  if (!latestSessionForGoal) return 0;

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
      const total = correct + incorrect; // Or use questionsAttempted if more reliable
      actualPerformancePct = total > 0 ? (correct / total) * 100 : 0;
      break;
    }
    case 'LANGUAGE_EXPRESSION': {
      const successful = Number(goalSessionData.successfulResponses) || 0;
      const unsuccessful = Number(goalSessionData.unsuccessfulResponses) || 0;
      const total = successful + unsuccessful; // Or use opportunities if more reliable
      actualPerformancePct = total > 0 ? (successful / total) * 100 : 0;
      break;
    }
    case 'PHONOLOGICAL_PROCESSES': {
      const correct = Number(goalSessionData.correctProductions) || 0;
      const incorrect = Number(goalSessionData.incorrectProductions) || 0;
      const total = correct + incorrect; // Or use opportunities if more reliable
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
    case 'QUALITATIVE_OBSERVATION': {
      // If sessionTargetValue is set (e.g. for rating target of 4 on a 1-5 scale)
      if (goal.sessionTargetValue !== undefined && goal.sessionTargetValue > 0 && goalSessionData.rating !== undefined) {
        const rating = Number(goalSessionData.rating) || 0;
        // Assuming target is max score (e.g. 5 for a 1-5 scale, qualitative goal might not have a percent target)
        // For a rating target like 4/5, the display is more complex.
        // If sessionTargetValue for qualitative is THE target rating value itself (e.g. 4) on a scale of 5:
        // Progress = (rating / targetRating) * 100, capped at 100.
        // For simplicity, if target is present, we show raw rating / 5 * 100.
        // Or if target means "target achieved if rating >= X", then this logic is different.
        // Let's assume qualitative goal progress is simply if notes exist, or for rating based on a fixed scale of 5.
        if (goalSessionData.rating !== undefined) {
           actualPerformancePct = (Number(goalSessionData.rating) / 5) * 100; // Assuming a 1-5 scale
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
    // Calculate progress towards the target percentage
    const progressTowardsTarget = (actualPerformancePct / goal.sessionTargetValue) * 100;
    return Math.min(Math.max(progressTowardsTarget, 0), 100); // Cap between 0 and 100
  }
  
  // If no percentage target, or it's qualitative, return the actual performance percentage
  return actualPerformancePct;
};

export default function StudentProgressSidebar({ student, studentSessions }: StudentProgressSidebarProps) {
  if (!student) return null;

  const activeGoalsWithProgress = student.goals.map(goal => ({
    ...goal,
    progress: getGoalProgress(goal, studentSessions),
  })).slice(0, 5); 

  const overallProgressValues = student.goals
    .map(g => getGoalProgress(g, studentSessions))
    .filter(p => p !== undefined); // Filter out undefined if any goal type doesn't yield progress
  
  const averageOverallProgress = overallProgressValues.length > 0
    ? overallProgressValues.reduce((sum, p) => sum + p, 0) / overallProgressValues.length
    : 0;

  return (
    <div className="p-2 space-y-3">
      <Card className="bg-sidebar-accent border-sidebar-border">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium text-sidebar-accent-foreground">
            Overall Progress Towards Targets
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

      {activeGoalsWithProgress.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">Active Goals Overview</h4>
          {activeGoalsWithProgress.map(goal => {
            const displayValue = goal.sessionTargetValue !== undefined && goal.type !== 'QUALITATIVE_OBSERVATION' 
              ? `${Math.round(goal.progress)}% (Target: ${goal.sessionTargetValue}%)`
              : goal.type === 'QUALITATIVE_OBSERVATION' 
                ? (goal.progress === 100 ? 'Noted' : 'No Notes')
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
      
      {student.goals.length > activeGoalsWithProgress.length && (
         <p className="text-xs text-muted-foreground text-center px-1">
            + {student.goals.length - activeGoalsWithProgress.length} more goals
          </p>
      )}

      {student.goals.length === 0 && (
         <p className="text-xs text-muted-foreground text-center px-1 py-4">
            No goals assigned yet.
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
