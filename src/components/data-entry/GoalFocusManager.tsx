
'use client';

import { useEffect } from 'react';
import type { StudentSessionState } from '@/lib/types';

interface GoalFocusManagerProps {
  focusedStudentSlotIndex: number;
  studentId: string | undefined;
  focusedGoalIndex: number | undefined;
  studentState: StudentSessionState | undefined;
  showArchived: boolean | undefined;
}

const GoalFocusManager = ({
  focusedStudentSlotIndex,
  studentId,
  focusedGoalIndex,
  studentState,
  showArchived,
}: GoalFocusManagerProps) => {

  // Scrolls only when the focus moves (to another student or goal), not on every entry: entering data in a
  // goal that isn't focused would otherwise scroll the focused one back into view under the teacher's finger.
  const visibleGoals = studentState?.originalGoalHeaders?.filter(g => !g.isArchived || showArchived) ?? [];
  const focusedGoalId = focusedGoalIndex !== undefined ? visibleGoals[focusedGoalIndex]?.id : undefined;

  useEffect(() => {
    if (!studentId) return;
    document.getElementById(`student-card-slot-${focusedStudentSlotIndex}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (!focusedGoalId) return;
    // A timeout lets the goal's element render after any state updates.
    const timer = setTimeout(() => {
      document.getElementById(`goal-input-${studentId}-${focusedGoalId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
    return () => clearTimeout(timer);
  }, [focusedStudentSlotIndex, studentId, focusedGoalId]);

  // This component doesn't render anything, it just manages side effects.
  return null;
};

export default GoalFocusManager;
