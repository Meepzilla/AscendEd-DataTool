
'use client';

import React, { useMemo } from 'react';
import { Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SelectionModal from '@/components/modals/selection-modal';
import { useSidebar } from '@/components/ui/sidebar';
import type { Student, StudentSessionState } from '@/lib/types';

interface TouchControlsProps {
  activeStudentsInSlots: Student[];
  studentSessionStates: Record<string, StudentSessionState>;
  focusedStudentSlotIndex: number;
  setFocusedStudentSlotIndex: (index: number) => void;
  focusedGoalIndexByStudentId: Record<string, number>;
  setFocusedGoalIndexByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  showArchivedByStudentId: Record<string, boolean>;
  selectionModalType: 'student' | 'goal' | null;
  setSelectionModalType: (type: 'student' | 'goal' | null) => void;
}


export default function TouchControls({
  activeStudentsInSlots,
  studentSessionStates,
  focusedStudentSlotIndex,
  focusedGoalIndexByStudentId,
  setFocusedGoalIndexByStudentId,
  showArchivedByStudentId,
  selectionModalType,
  setSelectionModalType,
}: TouchControlsProps) {
  const { state: sidebarState } = useSidebar();

  const focusedStudentId = useMemo(() => {
    if (focusedStudentSlotIndex >= 0 && focusedStudentSlotIndex < activeStudentsInSlots.length) {
      return activeStudentsInSlots[focusedStudentSlotIndex]?.id;
    }
    return null;
  }, [focusedStudentSlotIndex, activeStudentsInSlots]);

  const focusedStudentState = useMemo(() => {
    return focusedStudentId ? studentSessionStates[focusedStudentId] : null;
  }, [focusedStudentId, studentSessionStates]);

  const visibleGoals = useMemo(() => {
    if (!focusedStudentState?.originalGoalHeaders || !focusedStudentId) return [];
    const showArchived = showArchivedByStudentId[focusedStudentId] || false;
    return focusedStudentState.originalGoalHeaders.filter(g => !g.isArchived || showArchived);
  }, [focusedStudentState, focusedStudentId, showArchivedByStudentId]);

  const studentSlots = useMemo(() => {
    if (!activeStudentsInSlots) return [];
    return activeStudentsInSlots.map((student, index) => ({
      id: index.toString(),
      name: student.name,
    }));
  }, [activeStudentsInSlots]);

  const handleGoalSelect = (goalId: string) => {
    if (!focusedStudentId) return;
    const goalIndex = visibleGoals.findIndex(g => g.id === goalId);
    if (goalIndex !== -1) {
      setFocusedGoalIndexByStudentId(prev => ({ ...prev, [focusedStudentId]: goalIndex }));
    }
    setSelectionModalType(null);
  };
  
  const selectedGoalId = useMemo(() => {
    if (focusedStudentId && visibleGoals.length > 0) {
      const focusedIndex = focusedGoalIndexByStudentId[focusedStudentId] ?? 0;
      if (focusedIndex < visibleGoals.length) {
         return visibleGoals[focusedIndex]?.id;
      }
    }
    return undefined;
  }, [focusedStudentId, visibleGoals, focusedGoalIndexByStudentId]);

  if (sidebarState === 'collapsed') {
    return (
        <div className="flex flex-col short:flex-row gap-2 items-center">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectionModalType('student')}
                disabled={studentSlots.length <= 1}
                aria-label="Select Student"
                title="Select Focused Student (Alt+U)"
            >
                <Users className="h-5 w-5" />
            </Button>
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectionModalType('goal')}
                disabled={visibleGoals.length <= 1}
                aria-label="Select Goal"
                title="Select Focused Goal (Alt+T)"
            >
                <Target className="h-5 w-5" />
            </Button>
        </div>
    );
  }

  return (
    <>
      <div className="w-full space-y-1 short:flex short:gap-2 short:space-y-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectionModalType('student')}
          disabled={!studentSlots || studentSlots.length <= 1}
          size="sm"
          className="w-full justify-start short:w-auto"
          aria-label="Select Student"
          title="Select Focused Student (Alt+U)"
        >
          <Users className="mr-2 h-4 w-4" />
          <span>Student</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectionModalType('goal')}
          disabled={!visibleGoals || visibleGoals.length <= 1}
          size="sm"
          className="w-full justify-start short:w-auto"
          aria-label="Select Goal"
          title="Select Focused Goal (Alt+T)"
        >
          <Target className="mr-2 h-4 w-4" />
          <span>Goal</span>
        </Button>
      </div>
      
      <SelectionModal
        isOpen={selectionModalType === 'goal'}
        onClose={() => setSelectionModalType(null)}
        title={'Select Goal'}
        items={visibleGoals.map(g => ({ id: g.id, name: g.name }))}
        onSelect={handleGoalSelect}
        selectedId={selectedGoalId}
      />
    </>
  );
}
