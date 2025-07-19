
'use client';

import React, { lazy } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, SessionData, SessionGoalData, PromptType, StudentSessionState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, PlusCircle, RotateCcw, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TouchControls from '@/components/forms/touch-controls';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AppLoadingSkeleton = lazy(() => import('@/components/layout/AppLoadingSkeleton'));
const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const StudentCardList = lazy(() => import('@/components/data-entry/StudentCardList'));

export default function DataEntryPage() {
  const {
    students,
    loading: studentsLoading,
    selectedStudent: studentFromContext,
    openEditStudentModal,
    dataEntrySessionDate,
    setDataEntrySessionDate,
    dataEntrySessionTime,
    setDataEntrySessionTime,
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
    saveDataEntrySession,
    resetDataEntrySession,
    handleGoalDataChange,
    handleMoveGoal,
    getCurrentFocusedGoalInfo,
  } = useStudentData();

  const [isSaving, setIsSaving] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isHeaderCardCollapsed, setIsHeaderCardCollapsed] = useState(false);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);

  useEffect(() => {
    if (dataEntrySessionDate === undefined) {
      setDataEntrySessionDate(new Date());
    }
    if (dataEntrySessionTime === '') {
      setDataEntrySessionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [setDataEntrySessionDate, setDataEntrySessionTime, dataEntrySessionDate, dataEntrySessionTime]);

  useEffect(() => {
    if (!studentsLoading && dataEntrySelectedStudentIds.length === 0 && students.length > 0) {
      let initialIdToSelect: string | undefined = undefined;
      if (studentFromContext && students.find(s => s.id === studentFromContext.id)) {
        initialIdToSelect = studentFromContext.id;
      }
      if (initialIdToSelect) {
        setDataEntrySelectedStudentIds([initialIdToSelect]);
        setDataEntryFocusedStudentSlotIndex(0);
      }
    }
  }, [studentsLoading, students, studentFromContext, dataEntrySelectedStudentIds, setDataEntrySelectedStudentIds, setDataEntryFocusedStudentSlotIndex]);


 useEffect(() => {
    if (dataEntrySelectedStudentIds.length > 0 && dataEntryFocusedStudentSlotIndex >= 0 && dataEntryFocusedStudentSlotIndex < dataEntrySelectedStudentIds.length) {
      const studentCardId = `student-card-slot-${dataEntryFocusedStudentSlotIndex}`;
      const studentCardElement = document.getElementById(studentCardId);
      if (studentCardElement) {
        studentCardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }

    const focusedInfo = getCurrentFocusedGoalInfo();
    if (focusedInfo && focusedInfo.goal && focusedInfo.studentState) {
      const { studentId: studentIdForGoal, goal } = focusedInfo;
      const goalElementId = `goal-input-${studentIdForGoal}-${goal.id}`;
      const goalElement = document.getElementById(goalElementId);

      if (goalElement) {
        setTimeout(() => {
          goalElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
  }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, dataEntryFocusedGoalIndexByStudentId, getCurrentFocusedGoalInfo]);


 // Handles the selection of a student for a specific slot.
 // Updates the selected student IDs array and sets the focus to the slot of the newly selected student.
  const handleStudentSelect = useCallback((studentId: string, index: number) => {
    setDataEntrySelectedStudentIds((prev: string[]) => {
      const newSelection = [...prev];
      // Update the student ID at the specified index
      newSelection[index] = studentId;
      return newSelection;
    });
    // Set the focused student slot index to the current index
    setDataEntryFocusedStudentSlotIndex(index);
  }, [setDataEntrySelectedStudentIds, setDataEntryFocusedStudentSlotIndex]);

  const addStudentSlot = () => {
    const availableStudent = students.find(s => !dataEntrySelectedStudentIds.includes(s.id));
    if (availableStudent) {
      setDataEntrySelectedStudentIds([...dataEntrySelectedStudentIds, availableStudent.id]);
      setDataEntryFocusedStudentSlotIndex(dataEntrySelectedStudentIds.length);
    } else {
      toast({ title: "Info", description: "No more unique available students to add, or all students are already in slots.", variant: "default" });
    }
  };

  const removeStudentSlot = (indexToRemove: number) => {
    const currentFocusedId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    const studentIdToRemove = dataEntrySelectedStudentIds[indexToRemove];

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
    await saveDataEntrySession();
    setIsSaving(false);
  }

  const handleReset = () => {
    resetDataEntrySession();
    setIsResetConfirmationOpen(false);
  }

  const availableStudentsForDropdown = useMemo(() => {
    return students.filter(s => !dataEntrySelectedStudentIds.includes(s.id));
  }, [students, dataEntrySelectedStudentIds]);


  const handleOpenResetConfirmation = () => {
    if (dataEntrySelectedStudentIds.length === 0) {
      toast({ title: "Info", description: "No students selected to reset data for.", variant: "default" });
      return;
    }
    setIsResetConfirmationOpen(true);
  };


  if (studentsLoading) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <AppLoadingSkeleton />
      </Suspense>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
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

      <Card className="shadow-lg flex-shrink-0">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Edit2 className="h-7 w-7 text-primary" />
              <CardTitle className="text-2xl font-bold">Data Entry</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsHeaderCardCollapsed(!isHeaderCardCollapsed)}
              title={isHeaderCardCollapsed ? "Expand Header" : "Collapse Header"}
            >
              {isHeaderCardCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
              <span className="sr-only">{isHeaderCardCollapsed ? "Expand Header" : "Collapse Header"}</span>
            </Button>
          </div>
          {!isHeaderCardCollapsed && (
            <CardDescription>Record session data for students. AI suggests activities. Use hotkeys for speed.</CardDescription>
          )}
        </CardHeader>
        {!isHeaderCardCollapsed && (
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="w-full sm:w-auto">
                <Label htmlFor="sessionDate" className="block text-sm font-medium mb-1">Session Date</Label>
                <DatePicker date={dataEntrySessionDate} setDate={setDataEntrySessionDate} />
              </div>
              <div className="w-full sm:w-auto">
                <Label htmlFor="sessionTime" className="block text-sm font-medium mb-1">Session Time</Label>
                <Input
                  id="sessionTime"
                  type="time"
                  value={dataEntrySessionTime}
                  onChange={(e) => setDataEntrySessionTime(e.target.value)}
                  className="w-full sm:w-[150px]"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Hotkeys: 1-4 Focus initial slots | A/Alt+A Cycle Students | S/Alt+S Cycle Goals | C/N/D/V/G/P/F/I for prompts | Ctrl+Enter Save. See Help page for full list.
            </p>
          </CardContent>
        )}
      </Card>

      <ScrollArea className="flex-grow min-h-0">
         <Suspense fallback={<div>Loading student cards...</div>}>
          <StudentCardList
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
            addStudentSlot={addStudentSlot}
          />
        </Suspense>
      </ScrollArea>

      {dataEntrySelectedStudentIds.length > 0 && (
        <div className="mt-auto flex-shrink-0 flex justify-between items-center gap-2 py-4 border-t">
          <TouchControls />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenResetConfirmation} disabled={isSaving} size="lg">
              <RotateCcw className="mr-2 h-5 w-5" />
              Reset Focused Student
            </Button>
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              <Save className="mr-2 h-5 w-5" />
              {isSaving ? 'Saving Session...' : 'Save Focused Session'}
            </Button>
          </div>
        </div>
      )}
       {dataEntrySelectedStudentIds.length === 0 && !studentsLoading && (
          <Card className="mt-6 flex-shrink-0">
            <CardContent className="p-8 text-center text-muted-foreground">
                <Info className="h-10 w-10 mx-auto mb-3 text-primary"/>
                <p className="text-lg">No students selected for data entry.</p>
                <p>Click "Add Student Slot" to begin.</p>
                 {students.length === 0 && <p className="mt-2">You don't have any students yet. Go to 'Student Profile' or use Alt+M to add one.</p>}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
