'use client';

import React, { useMemo } from 'react';
import { Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import SelectionModal from '@/components/modals/selection-modal';

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
      <div className="flex justify-start items-center gap-2">
          {/* Student Controls */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelectionModalType('student')}
            disabled={studentSlots.length <= 1}
            size="lg"
            aria-label="Select Student"
            title="Select Focused Student (Alt+U)"
          >
            <Users className="mr-2 h-5 w-5" />
            <span className="hidden sm:inline">Select Student</span>
          </Button>

          {/* Goal Controls */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelectionModalType('goal')}
            disabled={visibleGoals.length <= 1}
            size="lg"
            aria-label="Select Goal"
            title="Select Focused Goal (Alt+T)"
          >
            <Target className="mr-2 h-5 w-5" />
            <span className="hidden sm:inline">Select Goal</span>
          </Button>
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
