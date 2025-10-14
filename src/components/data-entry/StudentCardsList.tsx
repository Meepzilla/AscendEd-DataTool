
'use client';

import React, { lazy, Suspense } from 'react';
import type { Student, StudentSessionState, Goal, SessionGoalData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

const StudentDataCard = lazy(() => import('@/components/forms/StudentDataCard'));

interface StudentCardsListProps {
  dataEntrySelectedStudentIds: string[];
  students: Student[];
  dataEntryStudentSessionStates: Record<string, StudentSessionState>;
  dataEntryFocusedStudentSlotIndex: number;
  availableStudentsForDropdown: Student[];
  dataEntryShowArchivedByStudentId: Record<string, boolean>;
  setDataEntryShowArchivedByStudentId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  dataEntryVisibleGoalCountByStudentId: Record<string, number>;
  setDataEntryVisibleGoalCountByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  dataEntryFocusedGoalIndexByStudentId: Record<string, number>;
  setDataEntryFocusedGoalIndexByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  dataEntryAiActivitySuggestions: Record<string, string[]>;
  isAiLoading: Record<string, boolean>;
  setDataEntryFocusedStudentSlotIndex: (index: number) => void;
  openEditStudentModal: (student: Student) => void;
  handleStudentSelect: (studentId: string, index: number) => void;
  removeStudentSlot: (indexToRemove: number) => void;
  handleInputChange: (studentId: string, field: 'activity' | 'notes', value: string) => void;
  handleGoalDataChange: (studentId: string, goalId: string, field: keyof SessionGoalData['data'], value: any) => void;
  handleMoveGoal: (studentId: string, goalId: string, direction: 'up' | 'down') => void;
  handleLocalAiFetch: (studentId: string) => Promise<void>;
  addStudentSlot: () => void;
}

const StudentCardsList: React.FC<StudentCardsListProps> = ({
  dataEntrySelectedStudentIds,
  students,
  dataEntryStudentSessionStates,
  dataEntryFocusedStudentSlotIndex,
  availableStudentsForDropdown,
  dataEntryShowArchivedByStudentId,
  setDataEntryShowArchivedByStudentId,
  dataEntryVisibleGoalCountByStudentId,
  setDataEntryVisibleGoalCountByStudentId,
  dataEntryFocusedGoalIndexByStudentId,
  setDataEntryFocusedGoalIndexByStudentId,
  dataEntryAiActivitySuggestions,
  isAiLoading,
  setDataEntryFocusedStudentSlotIndex,
  openEditStudentModal,
  handleStudentSelect,
  removeStudentSlot,
  handleInputChange,
  handleGoalDataChange,
  handleMoveGoal,
  handleLocalAiFetch,
  addStudentSlot,
}) => {
  return (
    <div className="flex flex-row gap-6 items-start py-4 px-1">
      {dataEntrySelectedStudentIds.map((studentId, slotIndex) => {
        const student = students.find(s => s.id === studentId);
        const state = dataEntryStudentSessionStates[studentId];
        if (!student || !state) return null;

        const isStudentFocused = slotIndex === dataEntryFocusedStudentSlotIndex;

        return (
          <Suspense key={studentId} fallback={<div>Loading student card...</div>}>
            <StudentDataCard
              student={student}
              state={state}
              slotIndex={slotIndex}
              isStudentFocused={isStudentFocused}
              availableStudentsForDropdown={availableStudentsForDropdown}
              dataEntrySelectedStudentIds={dataEntrySelectedStudentIds}
              dataEntryShowArchivedByStudentId={dataEntryShowArchivedByStudentId}
              setDataEntryShowArchivedByStudentId={setDataEntryShowArchivedByStudentId}
              dataEntryVisibleGoalCountByStudentId={dataEntryVisibleGoalCountByStudentId}
              setDataEntryVisibleGoalCountByStudentId={setDataEntryVisibleGoalCountByStudentId}
              dataEntryFocusedGoalIndexByStudentId={dataEntryFocusedGoalIndexByStudentId}
              setDataEntryFocusedGoalIndexByStudentId={setDataEntryFocusedGoalIndexByStudentId}
              dataEntryAiActivitySuggestions={dataEntryAiActivitySuggestions}
              isAiLoading={isAiLoading}
              setDataEntryFocusedStudentSlotIndex={setDataEntryFocusedStudentSlotIndex}
              openEditStudentModal={openEditStudentModal}
              handleStudentSelect={handleStudentSelect}
              removeStudentSlot={removeStudentSlot}
              handleInputChange={handleInputChange}
              handleGoalDataChange={handleGoalDataChange}
              handleMoveGoal={handleMoveGoal}
              handleLocalAiFetch={handleLocalAiFetch}
            />
          </Suspense>
        );
      })}

      {dataEntrySelectedStudentIds.length < students.length && (
        <Button
          variant="outline"
          onClick={addStudentSlot}
          className="flex-shrink-0 w-[300px] min-h-[200px] flex items-center justify-center py-8 border-dashed hover:border-primary hover:text-primary"
          title="Add another student data entry card"
        >
          <PlusCircle className="mr-2 h-5 w-5" /> Add Student Slot
        </Button>
      )}
    </div>
  );
};

export default StudentCardsList;
