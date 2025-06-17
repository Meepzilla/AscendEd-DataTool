
'use client';

import React from 'react';
import type { Student, Goal, SessionData } from '@/lib/types';
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
  if (!goal.sessionTargetValue || goal.sessionTargetValue <= 0) {
    // If qualitative, check if any session has notes for this goal
    if (goal.type === 'QUALITATIVE_OBSERVATION') {
      const relevantSession = studentSessions
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .find(s => s.goals.some(sg => sg.goalId === goal.id && sg.data.notes && String(sg.data.notes).trim() !== ''));
      return relevantSession ? 100 : 0;
    }
    return 0; // No target or invalid target for quantitative goals
  }

  const latestSessionForGoal = studentSessions
    .filter(s => s.goals.some(sg => sg.goalId === goal.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    [0];

  if (!latestSessionForGoal) return 0;

  const goalData = latestSessionForGoal.goals.find(g => g.goalId === goal.id)?.data;
  if (!goalData) return 0;

  let achievedValue = 0;

  switch (goal.type) {
    case 'ARTICULATION':
      achievedValue = Number(goalData.correct) || 0;
      break;
    case 'LANGUAGE_COMPREHENSION':
      achievedValue = Number(goalData.questionsCorrect) || 0;
      break;
    case 'LANGUAGE_EXPRESSION':
      achievedValue = Number(goalData.successfulResponses) || 0;
      break;
    case 'PHONOLOGICAL_PROCESSES':
      achievedValue = Number(goalData.correctProductions) || 0;
      break;
    case 'FLUENCY_SYLLABLE_STUTTER':
      // Assuming target is for *fluent* syllables
      const totalSyllables = Number(goalData.totalSyllables) || 0;
      const stutteredSyllables = Number(goalData.stutteredSyllables) || 0;
      achievedValue = totalSyllables - stutteredSyllables;
      // If target is 0 stutters (i.e. sessionTargetValue = totalSyllables for 100% fluency)
      // and actual stutters are 0, progress is 100% if totalSyllables > 0.
      // If goal.sessionTargetValue is explicitly 0 (meaning target is 0 fluent syllables, which is odd, or 0 stutters)
      // this logic needs to be robust. If sessionTargetValue is for *number of fluent syllables*.
      if (goal.sessionTargetValue === 0 && stutteredSyllables === 0 && totalSyllables > 0) return 100;
      if (goal.sessionTargetValue === 0 && stutteredSyllables > 0) return 0;

      break;
    case 'QUALITATIVE_OBSERVATION':
      // If sessionTargetValue is set (e.g. for rating)
      achievedValue = Number(goalData.rating) || 0;
      break;
    default:
      return 0;
  }
  
  const progress = (achievedValue / goal.sessionTargetValue) * 100;
  return Math.min(Math.max(progress, 0), 100); // Cap between 0 and 100
};

export default function StudentProgressSidebar({ student, studentSessions }: StudentProgressSidebarProps) {
  if (!student) return null;

  const activeGoalsWithProgress = student.goals.map(goal => ({
    ...goal,
    progress: getGoalProgress(goal, studentSessions),
  })).slice(0, 5); // Show a few active goals (e.g. first 5)

  const overallProgressValues = activeGoalsWithProgress
    .filter(g => g.sessionTargetValue !== undefined && g.sessionTargetValue > 0 || g.type === 'QUALITATIVE_OBSERVATION') // Only average quantifiable goals or completed qualitative
    .map(g => g.progress);
  
  const averageOverallProgress = overallProgressValues.length > 0
    ? overallProgressValues.reduce((sum, p) => sum + p, 0) / overallProgressValues.length
    : 0;


  return (
    <div className="p-2 space-y-3">
      <Card className="bg-sidebar-accent border-sidebar-border">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium text-sidebar-accent-foreground">
            Overall Progress
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
          <p className="text-xs text-muted-foreground mt-1">{Math.round(averageOverallProgress)}% average completion</p>
        </CardContent>
      </Card>

      {activeGoalsWithProgress.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">Active Goals Overview</h4>
          {activeGoalsWithProgress.map(goal => {
            return (
              <div key={goal.id} className="p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                <div className="flex justify-between items-center text-xs mb-1">
                  <p className="font-medium text-sidebar-foreground truncate pr-2" title={goal.name}>{goal.name}</p>
                  <span className={`font-semibold ${goal.progress === 100 ? 'text-green-500' : goal.progress > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {goal.sessionTargetValue ? `${Math.round(goal.progress)}%` : goal.type === 'QUALITATIVE_OBSERVATION' && goal.progress === 100 ? 'Noted' : 'N/A'}
                  </span>
                </div>
                <Progress value={goal.progress} className="h-1.5" indicatorClassName={goal.progress === 100 ? 'bg-green-500' : goal.progress > 0 ? 'bg-primary' : 'bg-muted'}/>
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

