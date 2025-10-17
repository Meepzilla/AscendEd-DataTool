
'use client';

import React, { useMemo, useState } from 'react';
import { Users, Target, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import SelectionModal from '@/components/modals/selection-modal';
import { cn } from '@/lib/utils';

export default function TouchControls() {
  const {
    dataEntryActiveStudentsInSlots,
    dataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex,
    setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId,
    setDataEntryFocusedGoalIndexByStudentId,
    dataEntryShowArchivedByStudentId,
    selectionModalType,
    setSelectionModalType,
  } = useStudentData();

  const [isHovered, setIsHovered] = useState(false);

  const focusedStudentId = useMemo(() => {
    if (dataEntryFocusedStudentSlotIndex >= 0 && dataEntryFocusedStudentSlotIndex < dataEntryActiveStudentsInSlots.length) {
      return dataEntryActiveStudentsInSlots[dataEntryFocusedStudentSlotIndex]?.id;
    }
    return null;
  }, [dataEntryFocusedStudentSlotIndex, dataEntryActiveStudentsInSlots]);

  const focusedStudentState = useMemo(() => {
    return focusedStudentId ? dataEntryStudentSessionStates[focusedStudentId] : null;
  }, [focusedStudentId, dataEntryStudentSessionStates]);

  const visibleGoals = useMemo(() => {
    if (!focusedStudentState?.originalGoalHeaders || !focusedStudentId) return [];
    const showArchived = dataEntryShowArchivedByStudentId[focusedStudentId] || false;
    return focusedStudentState.originalGoalHeaders.filter(g => !g.isArchived || showArchived);
  }, [focusedStudentState, focusedStudentId, dataEntryShowArchivedByStudentId]);

  const studentSlots = useMemo(() => {
    return dataEntryActiveStudentsInSlots.map((student, index) => ({
      id: index.toString(),
      name: student.name,
    }));
  }, [dataEntryActiveStudentsInSlots]);

  const handleStudentSelect = (indexStr: string) => {
    setDataEntryFocusedStudentSlotIndex(parseInt(indexStr, 10));
    setSelectionModalType(null);
  };

  const handleGoalSelect = (goalId: string) => {
    if (!focusedStudentId) return;
    const goalIndex = visibleGoals.findIndex(g => g.id === goalId);
    if (goalIndex !== -1) {
      setDataEntryFocusedGoalIndexByStudentId(prev => ({ ...prev, [focusedStudentId]: goalIndex }));
    }
    setSelectionModalType(null);
  };
  
  const selectedGoalId = useMemo(() => {
    if (focusedStudentId && visibleGoals.length > 0) {
      const focusedIndex = dataEntryFocusedGoalIndexByStudentId[focusedStudentId] ?? 0;
      if (focusedIndex < visibleGoals.length) {
         return visibleGoals[focusedIndex]?.id;
      }
    }
    return undefined;
  }, [focusedStudentId, visibleGoals, dataEntryFocusedGoalIndexByStudentId]);

  return (
    <>
      <div 
        className="relative flex flex-col items-end gap-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Button
          className={cn(
            "rounded-full w-14 h-14 shadow-lg transition-all duration-300",
            !isHovered && "opacity-80"
          )}
        >
          <ChevronUp className={cn("h-6 w-6 transition-transform", isHovered && "rotate-180")} />
        </Button>
        <div className={cn(
          "flex flex-col gap-2 transition-all duration-300 ease-in-out",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectionModalType('student')}
            disabled={studentSlots.length <= 1}
            size="lg"
            className="shadow-md"
            aria-label="Select Student"
            title="Select Focused Student (Alt+U)"
          >
            <Users className="mr-2 h-5 w-5" />
            <span className="hidden sm:inline">Student</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectionModalType('goal')}
            disabled={visibleGoals.length <= 1}
            size="lg"
            className="shadow-md"
            aria-label="Select Goal"
            title="Select Focused Goal (Alt+T)"
          >
            <Target className="mr-2 h-5 w-5" />
            <span className="hidden sm:inline">Goal</span>
          </Button>
        </div>
      </div>
      
      <SelectionModal
        isOpen={selectionModalType !== null}
        onClose={() => setSelectionModalType(null)}
        title={selectionModalType === 'student' ? 'Select Student' : 'Select Goal'}
        items={
          selectionModalType === 'student'
            ? studentSlots
            : visibleGoals.map(g => ({ id: g.id, name: g.name }))
        }
        onSelect={
          selectionModalType === 'student'
            ? handleStudentSelect
            : handleGoalSelect
        }
        selectedId={
            selectionModalType === 'student'
            ? dataEntryFocusedStudentSlotIndex.toString()
            : selectedGoalId
        }
      />
    </>
  );
}
