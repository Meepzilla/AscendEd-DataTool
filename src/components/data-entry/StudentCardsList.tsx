
'use client';

import React, { lazy, Suspense } from 'react';
import type { Student, StudentSessionState, Goal, SessionGoalData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { MAX_STUDENTS_DATA_ENTRY } from '@/lib/appConstants';

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
  setDataEntryFocusedStudentSlotIndex: (index: number) => void;
  openEditStudentModal: (student: Student) => void;
  handleStudentSelect: (studentId: string, index: number) => void;
  removeStudentSlot: (indexToRemove: number) => void;
  handleInputChange: (studentId: string, field: 'activity' | 'notes', value: string) => void;
  handleGoalDataChange: (studentId: string, goalId: string, field: string, value: any) => void;
  handleMoveGoal: (studentId: string, goalId: string, direction: 'up' | 'down') => void;
  addStudentSlot: () => void;
  isStudentAccessLocked: boolean;
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
  setDataEntryFocusedStudentSlotIndex,
  openEditStudentModal,
  handleStudentSelect,
  removeStudentSlot,
  handleInputChange,
  handleGoalDataChange,
  handleMoveGoal,
  addStudentSlot,
  isStudentAccessLocked,
}) => {
  const activeStudents = students.filter(s => !s.isArchived);

  return (
    <div className="flex flex-row gap-4 p-4 min-h-full">
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
              setDataEntryFocusedStudentSlotIndex={setDataEntryFocusedStudentSlotIndex}
              openEditStudentModal={openEditStudentModal}
              handleStudentSelect={handleStudentSelect}
              removeStudentSlot={removeStudentSlot}
              handleInputChange={handleInputChange}
              handleGoalDataChange={handleGoalDataChange}
              handleMoveGoal={handleMoveGoal}
              isStudentAccessLocked={isStudentAccessLocked}
            />
          </Suspense>
        );
      })}

      {dataEntrySelectedStudentIds.length < (activeStudents?.length || 0) && dataEntrySelectedStudentIds.length < MAX_STUDENTS_DATA_ENTRY && (
        <div className="flex-shrink-0 w-[300px] h-full flex items-center justify-center p-4">
            <Button
              variant="outline"
              onClick={addStudentSlot}
              className="w-full h-full border-dashed hover:border-primary hover:text-primary flex flex-col items-center justify-center"
              title="Add another student data entry card (Alt+W)"
            >
              <PlusCircle className="mr-2 h-5 w-5" /> Add Student Slot
            </Button>
        </div>
      )}
    </div>
  );
};

export default StudentCardsList;

    