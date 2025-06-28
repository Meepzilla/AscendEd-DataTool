'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function TouchControls() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const {
    cycleFocusedStudent,
    cycleFocusedGoal,
    dataEntrySelectedStudentIds,
    getCurrentFocusedGoalInfo,
    dataEntryShowArchivedByStudentId,
  } = useStudentData();

  const focusedInfo = getCurrentFocusedGoalInfo();
  
  const visibleGoalsCount = useMemo(() => {
    if (!focusedInfo?.studentState?.originalGoalHeaders || !focusedInfo?.studentId) return 0;
    const showArchived = dataEntryShowArchivedByStudentId[focusedInfo.studentId] || false;
    return focusedInfo.studentState.originalGoalHeaders.filter(g => !g.isArchived || showArchived).length;
  }, [focusedInfo, dataEntryShowArchivedByStudentId]);


  const showControls = isMobile && pathname.startsWith('/data-entry') && dataEntrySelectedStudentIds.length > 0;

  if (!showControls) {
    return null;
  }

  const handlePrevStudent = () => cycleFocusedStudent('prev');
  const handleNextStudent = () => cycleFocusedStudent('next');
  const handlePrevGoal = () => cycleFocusedGoal('prev');
  const handleNextGoal = () => cycleFocusedGoal('next');

  const canCycleStudents = dataEntrySelectedStudentIds.length > 1;
  const canCycleGoals = visibleGoalsCount > 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 bg-background/80 backdrop-blur-sm border-t md:hidden">
      <div className="container mx-auto flex justify-around items-center gap-2">
        {/* Student Controls */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg shadow-md">
           <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevStudent}
            disabled={!canCycleStudents}
            className="h-10 w-10"
            aria-label="Previous Student"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex flex-col items-center">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Student</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextStudent}
            disabled={!canCycleStudents}
            className="h-10 w-10"
            aria-label="Next Student"
          >
            <ArrowRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Goal Controls */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg shadow-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevGoal}
            disabled={!canCycleGoals}
            className="h-10 w-10"
            aria-label="Previous Goal"
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
          <div className="flex flex-col items-center">
             <Target className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Goal</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextGoal}
            disabled={!canCycleGoals}
            className="h-10 w-10"
            aria-label="Next Goal"
          >
            <ArrowDown className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
