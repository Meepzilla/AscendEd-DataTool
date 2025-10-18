
'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import type { StudentSessionState } from '@/lib/types';
import TouchControls from '@/components/forms/touch-controls';
import { cn } from '@/lib/utils';
import { ConfettiProvider } from '@/hooks/use-confetti';
import { ScrollArea } from '../ui/scroll-area';

const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const StudentCardsList = lazy(() => import('@/components/data-entry/StudentCardsList'));
const DataEntryHeaderCard = lazy(() => import('@/components/data-entry/DataEntryHeaderCard'));

export default function DataEntryContent() {
  const {
    students,
    selectedStudent: studentFromContext,
    openEditStudentModal,
    dataEntrySessionDate,
    setDataEntrySessionDate,
    dataEntrySessionTime,
    setDataEntrySessionTime,
    dataEntrySessionEndTime,
    setDataEntrySessionEndTime,
    dataEntrySelectedStudentIds,
    setDataEntrySelectedStudentIds,
    dataEntryStudentSessionStates,
    setDataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex,
    setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId,
    setDataEntryFocusedGoalIndexByStudentId,
    dataEntryShowArchivedByStudentId,
    setDataEntryShowArchivedByStudentId,
    dataEntryVisibleGoalCountByStudentId,
    setDataEntryVisibleGoalCountByStudentId,
    dataEntryAiActivitySuggestions,
    fetchAiActivitySuggestions,
    saveDataEntrySession: contextSaveDataEntrySession, // Renamed to avoid conflict
    saveAllDataEntrySessions,
    resetDataEntrySession,
    handleGoalDataChange,
    handleMoveGoal,
    getCurrentFocusedGoalInfo,
    addStudentSlot,
    isStudentAccessLocked,
    setIsStudentAccessLocked,
  } = useStudentData();

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isHeaderCardCollapsed, setIsHeaderCardCollapsed] = useState(false);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);

  const activeStudents = useMemo(() => students.filter(s => !s.isArchived), [students]);

  useEffect(() => {
    if (dataEntrySessionDate === undefined) {
      setDataEntrySessionDate(new Date());
    }
    if (dataEntrySessionTime === '') {
      const now = new Date();
      setDataEntrySessionTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      now.setHours(now.getHours() + 1);
      setDataEntrySessionEndTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [setDataEntrySessionDate, setDataEntrySessionTime, setDataEntrySessionEndTime, dataEntrySessionDate, dataEntrySessionTime]);

  useEffect(() => {
    if (dataEntrySelectedStudentIds.length === 0 && activeStudents.length > 0) {
      let initialIdToSelect: string | undefined = undefined;
      if (studentFromContext && activeStudents.find(s => s.id === studentFromContext.id)) {
        initialIdToSelect = studentFromContext.id;
      }
      if (initialIdToSelect) {
        setDataEntrySelectedStudentIds([initialIdToSelect]);
        setDataEntryFocusedStudentSlotIndex(0);
      }
    }
  }, [activeStudents, studentFromContext, dataEntrySelectedStudentIds, setDataEntrySelectedStudentIds, setDataEntryFocusedStudentSlotIndex]);

 useEffect(() => {
    if (dataEntrySelectedStudentIds.length > 0 && dataEntryFocusedStudentSlotIndex >= 0 && dataEntryFocusedStudentSlotIndex < dataEntrySelectedStudentIds.length) {
      const studentCardId = `student-card-slot-${dataEntryFocusedStudentSlotIndex}`;
      const studentCardElement = document.getElementById(studentCardId);
      if (studentCardElement) {
        studentCardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }

    setTimeout(() => {
        const focusedInfo = getCurrentFocusedGoalInfo();
        if (focusedInfo && focusedInfo.goal && focusedInfo.studentState) {
          const { studentId: studentIdForGoal, goal } = focusedInfo;
          const goalElementId = `goal-input-${studentIdForGoal}-${goal.id}`;
          const goalElement = document.getElementById(goalElementId);

          if (goalElement) {
              goalElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
    }, 50); // Small delay to ensure DOM is updated after student focus changes

  }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, dataEntryFocusedGoalIndexByStudentId, getCurrentFocusedGoalInfo]);

  const handleStudentSelect = useCallback((studentId: string, index: number) => {
    setDataEntrySelectedStudentIds((prev: string[]) => {
      const newSelection = [...prev];
      newSelection[index] = studentId;
      return newSelection;
    });
    setDataEntryFocusedStudentSlotIndex(index);
  }, [setDataEntrySelectedStudentIds, setDataEntryFocusedStudentSlotIndex]);

  const removeStudentSlot = (indexToRemove: number) => {
    const currentFocusedId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    const newSelectedIds = dataEntrySelectedStudentIds.filter((_, i) => i !== indexToRemove);
    setDataEntrySelectedStudentIds(newSelectedIds);

    if (newSelectedIds.length === 0) {
        setDataEntryFocusedStudentSlotIndex(0);
    } else {
        let newFocusIndex = newSelectedIds.indexOf(currentFocusedId);
        if (newFocusIndex === -1) {
            newFocusIndex = Math.min(indexToRemove, newSelectedIds.length - 1);
            newFocusIndex = Math.max(0, newFocusIndex);
        }
        setDataEntryFocusedStudentSlotIndex(newFocusIndex);
    }
  };

  const handleInputChange = (studentId: string, field: 'activity' | 'notes', value: string) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.', variant: 'default' });
      return;
    }
    setDataEntryStudentSessionStates(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };
  
  const handleLocalAiFetch = async (studentId: string) => {
    const studentState = dataEntryStudentSessionStates[studentId];
    const activeGoals = studentState?.originalGoalHeaders.filter(g => !g.isArchived);

    if (!studentState || !activeGoals || activeGoals.length === 0) {
      toast({ title: "Info", description: "Student has no active goals assigned or data is missing.", variant: "default" });
      return;
    }
    setIsAiLoading(prev => ({...prev, [studentId]: true}));
    await fetchAiActivitySuggestions(studentId);
    setIsAiLoading(prev => ({...prev, [studentId]: false}));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await contextSaveDataEntrySession();
    setIsSaving(false);
  }

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    await saveAllDataEntrySessions();
    setIsSavingAll(false);
  }

  const handleReset = () => {
    resetDataEntrySession();
    setIsResetConfirmationOpen(false);
  }

  const availableStudentsForDropdown = useMemo(() => {
    return activeStudents.filter(s => !dataEntrySelectedStudentIds.includes(s.id));
  }, [activeStudents, dataEntrySelectedStudentIds]);

  const handleOpenResetConfirmation = () => {
    if (dataEntrySelectedStudentIds.length === 0) {
      toast({ title: "Info", description: "No students selected to reset data for.", variant: "default" });
      return;
    }
    setIsResetConfirmationOpen(true);
  };

  return (
    <ConfettiProvider>
      <div className="flex flex-col h-full">
        <Suspense fallback={null}>
          {isResetConfirmationOpen && (
            <ConfirmationModal
              isOpen={isResetConfirmationOpen}
              onClose={() => setIsResetConfirmationOpen(false)}
              onConfirm={handleReset}
              title="Reset Focused Student Data?"
              description="Are you sure you want to clear all current unsaved activity, notes, and goal data for the selected student? This action cannot be undone."
              confirmText="Yes, Reset Data"
            />
          )}
        </Suspense>
        
        <div className="flex-shrink-0">
          <Suspense fallback={<Card><CardContent>Loading header...</CardContent></Card>}>
            <DataEntryHeaderCard
              isHeaderCardCollapsed={isHeaderCardCollapsed}
              setIsHeaderCardCollapsed={setIsHeaderCardCollapsed}
              dataEntrySessionDate={dataEntrySessionDate}
              setDataEntrySessionDate={setDataEntrySessionDate}
              dataEntrySessionTime={dataEntrySessionTime}
              setDataEntrySessionTime={setDataEntrySessionTime}
              dataEntrySessionEndTime={dataEntrySessionEndTime}
              setDataEntrySessionEndTime={setDataEntrySessionEndTime}
              isStudentAccessLocked={isStudentAccessLocked}
              setIsStudentAccessLocked={setIsStudentAccessLocked}
            />
          </Suspense>
        </div>

        <div className="flex-grow min-h-0">
          <ScrollArea className="h-full w-full" orientation="horizontal">
            <Suspense fallback={<div>Loading student cards...</div>}>
              <StudentCardsList
                  dataEntrySelectedStudentIds={dataEntrySelectedStudentIds}
                  students={students}
                  dataEntryStudentSessionStates={dataEntryStudentSessionStates}
                  dataEntryFocusedStudentSlotIndex={dataEntryFocusedStudentSlotIndex}
                  availableStudentsForDropdown={availableStudentsForDropdown}
                  dataEntryShowArchivedByStudentId={dataEntryShowArchivedByStudentId}
                  setDataEntryShowArchivedByStudentId={setDataEntryShowArchivedByStudentId}
                  dataEntryVisibleGoalCountByStudentId={dataEntryVisibleGoalCountByStudentId}
                  setDataEntryVisibleGoalCountByStudentId={setDataEntryVisibleGoalCountByStudentId}
                  dataEntryFocusedGoalIndexByStudentId={dataEntryFocusedGoalIndexByStudentId}
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
                  addStudentSlot={addStudentSlot}
                  isStudentAccessLocked={isStudentAccessLocked}
              />
            </Suspense>
          </ScrollArea>
        </div>
        
        {dataEntrySelectedStudentIds.length > 0 && (
            <div className="sticky bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm mt-auto">
                <div className="flex justify-between items-center gap-2 p-2 border-t">
                    <div className="hidden sm:block">
                      <TouchControls />
                    </div>
                    
                    <div className="sm:hidden">
                      <TouchControls />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={handleOpenResetConfirmation} disabled={isSaving || isSavingAll} size="lg">
                        <RotateCcw className="mr-2 h-5 w-5" />
                        Reset Focused
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || isSavingAll} size="lg">
                          <Save className="mr-2 h-5 w-5" />
                          {isSaving ? 'Saving...' : 'Save Focused'}
                        </Button>
                        <Button onClick={handleSaveAll} disabled={isSaving || isSavingAll} size="lg">
                          <Save className="mr-2 h-5 w-5" />
                          {isSavingAll ? 'Saving All...' : 'Save All'}
                        </Button>
                    </div>
                </div>
            </div>
        )}
        {dataEntrySelectedStudentIds.length === 0 && (
            <Card className="mt-6 flex-shrink-0">
              <CardContent className="p-8 text-center text-muted-foreground">
                  <Info className="h-10 w-10 mx-auto mb-3 text-primary"/>
                  <p className="text-lg mb-4">No students selected for data entry.</p>
                  <Button variant="outline" onClick={addStudentSlot}>
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Add Student Slot
                  </Button>
                  {students.length === 0 && <p className="mt-4 text-sm">You don't have any students yet. Go to 'Students' or press (Alt+M) to add one.</p>}
              </CardContent>
            </Card>
          )}
      </div>
    </ConfettiProvider>
  );
}
