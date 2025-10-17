
'use client';

import React, { useMemo, useState } from 'react';
import { Users, Target, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import SelectionModal from '@/components/modals/selection-modal';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

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
  const { state: sidebarState } = useSidebar();

  const [isExpanded, setIsExpanded] = useState(false);

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

  if (sidebarState === 'collapsed') {
    return (
        <div className="flex flex-col gap-2 items-center">
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
      <div className="w-full space-y-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectionModalType('student')}
          disabled={studentSlots.length <= 1}
          size="sm"
          className="w-full justify-start"
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
          disabled={visibleGoals.length <= 1}
          size="sm"
          className="w-full justify-start"
          aria-label="Select Goal"
          title="Select Focused Goal (Alt+T)"
        >
          <Target className="mr-2 h-4 w-4" />
          <span>Goal</span>
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
