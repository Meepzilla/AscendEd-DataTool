
'use client';

import React, { useMemo, useState } from 'react';
import { Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import SelectionModal from '@/components/modals/selection-modal';

export default function TouchControls() {
  const [modalType, setModalType] = useState<'student' | 'goal' | null>(null);

  const {
    students,
    dataEntrySelectedStudentIds,
    dataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex,
    setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId,
    setDataEntryFocusedGoalIndexByStudentId,
    dataEntryShowArchivedByStudentId,
  } = useStudentData();

  const focusedStudentId = useMemo(() => {
    if (dataEntryFocusedStudentSlotIndex >= 0 && dataEntryFocusedStudentSlotIndex < dataEntrySelectedStudentIds.length) {
      return dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    }
    return null;
  }, [dataEntryFocusedStudentSlotIndex, dataEntrySelectedStudentIds]);

  const focusedStudentState = useMemo(() => {
    return focusedStudentId ? dataEntryStudentSessionStates[focusedStudentId] : null;
  }, [focusedStudentId, dataEntryStudentSessionStates]);

  const visibleGoals = useMemo(() => {
    if (!focusedStudentState?.originalGoalHeaders || !focusedStudentId) return [];
    const showArchived = dataEntryShowArchivedByStudentId[focusedStudentId] || false;
    return focusedStudentState.originalGoalHeaders.filter(g => !g.isArchived || showArchived);
  }, [focusedStudentState, focusedStudentId, dataEntryShowArchivedByStudentId]);

  const studentSlots = useMemo(() => {
    return dataEntrySelectedStudentIds.map((id, index) => {
        const student = students.find(s => s.id === id);
        return { id: index.toString(), name: student ? student.name : `Slot ${index + 1}: Empty` };
    }).filter(s => s.name.indexOf('Empty') === -1);
  }, [dataEntrySelectedStudentIds, students]);


  const handleStudentSelect = (indexStr: string) => {
    setDataEntryFocusedStudentSlotIndex(parseInt(indexStr, 10));
    setModalType(null);
  };

  const handleGoalSelect = (goalId: string) => {
    if (!focusedStudentId) return;
    const goalIndex = visibleGoals.findIndex(g => g.id === goalId);
    if (goalIndex !== -1) {
      setDataEntryFocusedGoalIndexByStudentId(prev => ({ ...prev, [focusedStudentId]: goalIndex }));
    }
    setModalType(null);
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
            onClick={() => setModalType('student')}
            disabled={studentSlots.length <= 1}
            size="lg"
            aria-label="Select Student"
          >
            <Users className="mr-2 h-5 w-5" />
            Select Student
          </Button>

          {/* Goal Controls */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalType('goal')}
            disabled={visibleGoals.length <= 1}
            size="lg"
            aria-label="Select Goal"
          >
            <Target className="mr-2 h-5 w-5" />
            Select Goal
          </Button>
      </div>
      
      <SelectionModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === 'student' ? 'Select Student' : 'Select Goal'}
        items={
          modalType === 'student'
            ? studentSlots
            : visibleGoals.map(g => ({ id: g.id, name: g.name }))
        }
        onSelect={
          modalType === 'student'
            ? handleStudentSelect
            : handleGoalSelect
        }
        selectedId={
            modalType === 'student'
            ? dataEntryFocusedStudentSlotIndex.toString()
            : selectedGoalId
        }
      />
    </>
  );
}

