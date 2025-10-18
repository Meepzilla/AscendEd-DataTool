
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

  useEffect(() => {
    if (studentId) {
      // Scroll student card into view
      const studentCardId = `student-card-slot-${focusedStudentSlotIndex}`;
      const studentCardElement = document.getElementById(studentCardId);
      if (studentCardElement) {
        studentCardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      // Scroll focused goal into view
      if (studentState?.originalGoalHeaders && focusedGoalIndex !== undefined) {
        const visibleGoals = studentState.originalGoalHeaders.filter(g => !g.isArchived || showArchived);
        if (visibleGoals.length > focusedGoalIndex) {
          const focusedGoal = visibleGoals[focusedGoalIndex];
          if (focusedGoal) {
            const goalElementId = `goal-input-${studentId}-${focusedGoal.id}`;
            // Use a timeout to ensure the element is available after any state updates
            setTimeout(() => {
              const goalElement = document.getElementById(goalElementId);
              if (goalElement) {
                goalElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 50);
          }
        }
      }
    }
  }, [focusedStudentSlotIndex, studentId, focusedGoalIndex, studentState, showArchived]);

  // This component doesn't render anything, it just manages side effects.
  return null;
};

export default GoalFocusManager;
