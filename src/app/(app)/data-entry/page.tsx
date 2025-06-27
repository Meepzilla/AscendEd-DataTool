
'use client';

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, SessionData, SessionGoalData, PromptType, StudentSessionState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Save, PlusCircle, XCircle, Edit2, Info, ChevronDown, ChevronUp, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { GOAL_TYPE_FIELDS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useErrorLog } from '@/hooks/use-error-log';
import { Switch } from '@/components/ui/switch';

const AppLoadingSkeleton = lazy(() => import('@/components/layout/AppLoadingSkeleton'));
const GoalDataInputComponent = lazy(() => import('@/components/forms/goal-data-input'));
const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));

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
    setDataEntryAiActivitySuggestions,
    getSessionsForStudent,
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
      <AppLoadingSkeleton />
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
            title="Reset Unsaved Data?"
            description="Are you sure you want to clear all current unsaved activity, notes, and goal data for the selected students? This action cannot be undone."
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

      <div className="flex flex-row gap-6 items-start overflow-x-auto py-4 px-1 flex-grow min-h-0">
        {dataEntrySelectedStudentIds.map((studentId, slotIndex) => {
          const student = students.find(s => s.id === studentId);
          const state = dataEntryStudentSessionStates[studentId];
          if (!student || !state) return null;

          const isStudentFocused = slotIndex === dataEntryFocusedStudentSlotIndex;

          const showArchived = dataEntryShowArchivedByStudentId[studentId] || false;
          const allStudentGoals = state.originalGoalHeaders;
          const filteredStudentGoals = allStudentGoals.filter(g => !g.isArchived || showArchived);

          const visibleGoalCount = dataEntryVisibleGoalCountByStudentId[studentId] ?? 10;
          const displayedGoals = filteredStudentGoals.slice(0, visibleGoalCount);


          return (
            <Card
              key={studentId}
              id={`student-card-slot-${slotIndex}`}
              className={cn(
                `flex flex-col transition-all duration-300 ease-in-out shadow-md flex-shrink-0`,
                isStudentFocused ? 'w-[450px]' : 'w-[350px]',
                isStudentFocused && 'ring-2 ring-primary ring-offset-2 shadow-xl'
              )}
              onClick={() => setDataEntryFocusedStudentSlotIndex(slotIndex)}
            >
              <CardHeader className="bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 w-full">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            openEditStudentModal(student);
                        }}
                        
                        title={`Manage ${student.name}'s goals and info (Alt+E)`}
                        aria-label={`Manage ${student.name}'s goals and info`}
                    >
                        <Users className="h-5 w-5 text-primary" />
                    </Button>
                    <Select value={studentId} onValueChange={(newStudentId) => handleStudentSelect(newStudentId, slotIndex)}>
                      <SelectTrigger className="flex-grow truncate">
                        <SelectValue placeholder="Select Student" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={student.id} key={student.id} disabled={dataEntrySelectedStudentIds.includes(student.id) && student.id !== studentId}>
                          {student.name}
                        </SelectItem>
                        {availableStudentsForDropdown.map(s => (
                          <SelectItem value={s.id} key={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center">
                    {dataEntrySelectedStudentIds.length > 0 && (
                       <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); removeStudentSlot(slotIndex);}} className="h-8 w-8" title="Remove Student Slot">
                        <XCircle className="h-5 w-5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="h-[450px]">
                <CardContent className="p-3 space-y-3">
                  <div>
                    <Label htmlFor={`activity-${studentId}`}>Activity</Label>
                    <Input
                      id={`activity-${studentId}`}
                      placeholder="Describe the session activity"
                      value={state.activity}
                      onChange={(e) => handleInputChange(studentId, 'activity', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                        id={`show-archived-${studentId}`}
                        checked={dataEntryShowArchivedByStudentId[studentId] || false}
                        onCheckedChange={(checked) => setDataEntryShowArchivedByStudentId(prev => ({...prev, [studentId]: checked}))}
                    />
                    <Label htmlFor={`show-archived-${studentId}`} className="text-xs text-muted-foreground">
                        {dataEntryShowArchivedByStudentId[studentId] ? "Showing Archived Goals" : "Show Archived Goals"}
                    </Label>
                  </div>


                  {allStudentGoals.length === 0 ? (
                     <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No goals assigned to this student. Assign goals in the Student Profile.</p>
                  ) : displayedGoals.length === 0 && !showArchived ? (
                     <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No active goals. Toggle "Show Archived Goals" to view them.</p>
                  ) : displayedGoals.length === 0 && showArchived ? (
                     <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No goals (active or archived) for this student.</p>
                  ) : (
                    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                      <>
                        {displayedGoals.map((goal) => {
                          // Find the index of the goal in the currently *displayed* list for focus purposes
                          const displayedGoalIndex = displayedGoals.findIndex(dg => dg.id === goal.id);
                          const isGoalFocused = isStudentFocused && (dataEntryFocusedGoalIndexByStudentId[studentId] ?? 0) === displayedGoalIndex;

                          // Find index in the original full list for move up/down logic
                          const actualGoalIndexInOriginal = allStudentGoals.findIndex(g => g.id === goal.id);

                          return (
                            <GoalDataInputComponent
                              key={goal.id}
                              id={`goal-input-${studentId}-${goal.id}`}
                              goal={goal}
                              data={state.goalData[goal.id] || GOAL_TYPE_FIELDS[goal.type]}
                              onChange={(updatedField, newData) => handleGoalDataChange(studentId, goal.id, updatedField, newData)}
                              isFocused={isGoalFocused}
                              onMoveUp={() => handleMoveGoal(studentId, goal.id, 'up')}
                              onMoveDown={() => handleMoveGoal(studentId, goal.id, 'down')}
                              canMoveUp={actualGoalIndexInOriginal > 0}
                              canMoveDown={actualGoalIndexInOriginal < allStudentGoals.length - 1}
                              isArchived={goal.isArchived}
                            />
                          );
                        })}
                         {filteredStudentGoals.length > 10 && (
                          <div className="flex justify-center mt-2">
                            {visibleGoalCount < filteredStudentGoals.length ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDataEntryVisibleGoalCountByStudentId(prev => ({ ...prev, [studentId]: filteredStudentGoals.length }))}
                                className="text-xs"
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Show More ({filteredStudentGoals.length - visibleGoalCount} more)
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDataEntryVisibleGoalCountByStudentId(prev => ({ ...prev, [studentId]: 10 }))}
                                className="text-xs"
                              >
                                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                                Show Less
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    </Suspense>
                  )}

                  <div>
                    <Label htmlFor={`notes-${studentId}`}>General Notes</Label>
                    <Textarea
                      id={`notes-${studentId}`}
                      placeholder="Any additional observations or notes for this student's session"
                      value={state.notes}
                      onChange={(e) => handleInputChange(studentId, 'notes', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLocalAiFetch(studentId)}
                        disabled={isAiLoading[studentId] || allStudentGoals.filter(g => !g.isArchived).length === 0}
                        className="w-full"
                    >
                      {isAiLoading[studentId] ? 'Getting Suggestions...' : 'Get AI Activity Suggestions'}
                    </Button>
                    {dataEntryAiActivitySuggestions[studentId] && dataEntryAiActivitySuggestions[studentId].length > 0 && (
                      <div className="p-2 border rounded-md bg-accent/30">
                        <h4 className="text-xs font-semibold mb-1">Suggested Activities:</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {dataEntryAiActivitySuggestions[studentId].map((sugg, i) => <li key={i}>{sugg}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </ScrollArea>
            </Card>
          );
        })}

        <Button
          variant="outline"
          onClick={addStudentSlot}
          className="flex-shrink-0 w-[300px] min-h-[200px] flex items-center justify-center py-8 border-dashed hover:border-primary hover:text-primary"
          title="Add another student data entry card"
        >
          <PlusCircle className="mr-2 h-5 w-5" /> Add Student Slot
        </Button>
      </div>

      {dataEntrySelectedStudentIds.length > 0 && (
        <div className="mt-auto flex-shrink-0 flex justify-end items-center gap-2 py-4 border-t">
           <Button variant="outline" onClick={handleOpenResetConfirmation} disabled={isSaving} size="lg">
            <RotateCcw className="mr-2 h-5 w-5" />
            Reset Current Data
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            <Save className="mr-2 h-5 w-5" />
            {isSaving ? 'Saving Session(s)...' : 'Save Session(s)'}
          </Button>
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
