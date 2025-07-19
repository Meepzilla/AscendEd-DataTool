
'use client';

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, SessionData, SessionGoalData, PromptType, StudentSessionState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, PlusCircle, Edit2, Info, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { GOAL_TYPE_FIELDS } from '@/lib/goalConstants';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { useErrorLog } from '@/hooks/use-error-log';
import TouchControls from '@/components/forms/touch-controls';

const AppLoadingSkeleton = lazy(() => import('@/components/layout/AppLoadingSkeleton'));
const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const StudentDataCard = lazy(() => import('@/components/forms/StudentDataCard'));

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


  // Effect to synchronize student session states when selection or student list changes
  useEffect(() => {
    setDataEntryStudentSessionStates(prevStates => {
        const newContextStudentStates: Record<string, StudentSessionState> = { ...prevStates };
        let statesChanged = false;

        dataEntrySelectedStudentIds.forEach((id) => {
            const student = students.find(s => s.id === id);
            if (student) {
                const existingState = newContextStudentStates[id];
                const goalsHaveChanged = !existingState || !existingState.originalGoalHeaders || existingState.originalGoalHeaders.length !== student.goals.length ||
                    student.goals.some((goal, index) => 
                        !existingState.originalGoalHeaders[index] || 
                        goal.id !== existingState.originalGoalHeaders[index].id || 
                        goal.name !== existingState.originalGoalHeaders[index].name ||
                        goal.isArchived !== existingState.originalGoalHeaders[index].isArchived
                    );

                if (!existingState) {
                    const initialGoalData: Record<string, SessionGoalData['data']> = {};
                    student.goals.forEach(goal => {
                        initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                    });
                    newContextStudentStates[id] = {
                        studentId: student.id, studentName: student.name, activity: '', notes: '',
                        goalData: initialGoalData, originalGoalHeaders: student.goals,
                    };
                    statesChanged = true;
                } else if (goalsHaveChanged || existingState.studentName !== student.name) {
                    const newGoalData: Record<string, SessionGoalData['data']> = {};
                    student.goals.forEach(goal => {
                        newGoalData[goal.id] = existingState.goalData?.[goal.id] ? existingState.goalData[goal.id] : JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                    });
                    newContextStudentStates[id] = {
                        ...existingState,
                        studentName: student.name,
                        goalData: newGoalData,
                        originalGoalHeaders: student.goals,
                    };
                    statesChanged = true;
                }
            }
        });

        Object.keys(newContextStudentStates).forEach(studentId => {
            if (!dataEntrySelectedStudentIds.includes(studentId)) {
                delete newContextStudentStates[studentId];
                statesChanged = true;
            }
        });

        return statesChanged ? newContextStudentStates : prevStates;
    });
  }, [dataEntrySelectedStudentIds, students, setDataEntryStudentSessionStates]);

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
                    <Edit2 className="h-7 w-7 text-primary"/>
                    <CardTitle className="text-2xl font-bold">Data Entry</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsHeaderCardCollapsed(!isHeaderCardCollapsed)} title={isHeaderCardCollapsed ? "Expand Header" : "Collapse Header"}>
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
                  dataEntryVisibleGoalCountByStudentId={dataEntryVisibleGoalCountByStudentId}
                  dataEntryFocusedGoalIndexByStudentId={dataEntryFocusedGoalIndexByStudentId}
                  dataEntryAiActivitySuggestions={dataEntryAiActivitySuggestions}
                  isAiLoading={isAiLoading}
                  setDataEntryFocusedStudentSlotIndex={setDataEntryFocusedStudentSlotIndex}
                  openEditStudentModal={openEditStudentModal}
                  handleStudentSelect={handleStudentSelect}
                  removeStudentSlot={removeStudentSlot}
                  handleInputChange={handleInputChange}
                  setDataEntryShowArchivedByStudentId={setDataEntryShowArchivedByStudentId}
                  setDataEntryVisibleGoalCountByStudentId={setDataEntryVisibleGoalCountByStudentId}
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
