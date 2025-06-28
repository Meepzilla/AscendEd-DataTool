'use client';

import React, { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import { useIsMobile } from '@/hooks/use-mobile';
import SelectionModal from '@/components/modals/selection-modal';

export default function TouchControls() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
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

  const showControls = isMobile && pathname.startsWith('/data-entry') && dataEntrySelectedStudentIds.length > 0;

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

  if (!showControls) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-2 bg-background/80 backdrop-blur-sm border-t md:hidden">
        <div className="container mx-auto flex justify-around items-center gap-2">
          {/* Student Controls */}
          <Button
            variant="outline"
            onClick={() => setModalType('student')}
            disabled={studentSlots.length <= 1}
            className="flex-1 flex flex-col items-center h-auto py-2 gap-1"
            aria-label="Select Student"
          >
            <Users className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Student</span>
          </Button>

          {/* Goal Controls */}
          <Button
            variant="outline"
            onClick={() => setModalType('goal')}
            disabled={visibleGoals.length <= 1}
            className="flex-1 flex flex-col items-center h-auto py-2 gap-1"
            aria-label="Select Goal"
          >
            <Target className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Goal</span>
          </Button>
        </div>
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
