'use client';

import React from 'react';
import type { Student, Goal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TrendingUp, CheckCircle2, ListChecks, BarChart2 } from 'lucide-react';

interface StudentProgressSidebarProps {
  student: Student;
}

// Placeholder: In a real app, this would come from session data analysis
const getGoalProgress = (goal: Goal): number => {
  // Example: Calculate progress based on some criteria in goal or related sessions
  // For now, returning a random progress
  if (goal.type === 'QUALITATIVE_OBSERVATION') return 100; // Or based on number of observations
  return Math.floor(Math.random() * 101); 
};

export default function StudentProgressSidebar({ student }: StudentProgressSidebarProps) {
  if (!student) return null;

  const activeGoals = student.goals.slice(0, 3); // Show a few active goals

  return (
    <div className="p-2 space-y-3">
      <Card className="bg-sidebar-accent border-sidebar-border">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium text-sidebar-accent-foreground">
            Overall Progress (Example)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>Trending Upward</span>
          </div>
          <Progress value={65} className="h-2 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">65% average completion</p>
        </CardContent>
      </Card>

      {activeGoals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">Active Goals</h4>
          {activeGoals.map(goal => {
            const progress = getGoalProgress(goal);
            return (
              <div key={goal.id} className="p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                <div className="flex justify-between items-center text-xs mb-1">
                  <p className="font-medium text-sidebar-foreground truncate pr-2" title={goal.name}>{goal.name}</p>
                  <span className={`font-semibold ${progress === 100 ? 'text-green-500' : 'text-primary'}`}>
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" indicatorClassName={progress === 100 ? 'bg-green-500' : 'bg-primary'}/>
              </div>
            );
          })}
        </div>
      )}
      
      {student.goals.length > 3 && (
         <p className="text-xs text-muted-foreground text-center px-1">
            + {student.goals.length - 3} more goals
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
