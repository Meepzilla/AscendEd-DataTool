
'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import type { Student, StudentSessionState, SessionGoalData } from '@/lib/types';
import TouchControls from '@/components/forms/touch-controls';
import { ConfettiProvider } from '@/hooks/use-confetti';
import { ScrollArea } from '../ui/scroll-area';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import { getActivitySuggestions } from '@/ai/flows/activity-suggestions';
import { cn } from '@/lib/utils';

const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const StudentCardsList = lazy(() => import('@/components/data-entry/StudentCardsList'));
const DataEntryHeaderCard = lazy(() => import('@/components/data-entry/DataEntryHeaderCard'));
const SelectionModal = lazy(() => import('@/components/modals/selection-modal'));

const getLocalStorageKey = (base: string, uid: string | undefined): string | null => {
  if (!uid) return null;
  return `ascended_de_v2_${uid}_${base}`;
};

const useStickyState = <T,>(key: string | null, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined' || !key) return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (key) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  return [value, setValue];
};


export default function DataEntryContent() {
  const {
    students,
    currentUser,
    studentFromContext,
    openEditStudentModal,
    addSession,
    getSessionsForStudent,
    isStudentAccessLocked,
    setIsStudentAccessLocked,
    addErrorLog,
  } = useStudentData();
  const { toast } = useToast();
  
  const uid = currentUser?.uid;
  const dateKey = getLocalStorageKey('date', uid);
  const timeKey = getLocalStorageKey('time', uid);
  const endTimeKey = getLocalStorageKey('endTime', uid);
  const selectedIdsKey = getLocalStorageKey('selected_ids', uid);
  const sessionStatesKey = getLocalStorageKey('session_states', uid);
  const focusedSlotKey = getLocalStorageKey('focused_slot', uid);
  const focusedGoalsKey = getLocalStorageKey('focused_goals', uid);
  const visibleCountsKey = getLocalStorageKey('visible_counts', uid);
  const showArchivedKey = getLocalStorageKey('show_archived', uid);

  const [sessionDate, setSessionDate] = useStickyState<Date | undefined>(dateKey, undefined);
  const [sessionTime, setSessionTime] = useStickyState<string>(timeKey, '');
  const [sessionEndTime, setSessionEndTime] = useStickyState<string>(endTimeKey, '');
  const [selectedStudentIds, setSelectedStudentIds] = useStickyState<string[]>(selectedIdsKey, []);
  const [studentSessionStates, setStudentSessionStates] = useStickyState<Record<string, StudentSessionState>>(sessionStatesKey, {});
  const [focusedStudentSlotIndex, setFocusedStudentSlotIndex] = useStickyState<number>(focusedSlotKey, 0);
  const [focusedGoalIndexByStudentId, setFocusedGoalIndexByStudentId] = useStickyState<Record<string, number>>(focusedGoalsKey, {});
  const [aiActivitySuggestions, setAiActivitySuggestions] = useState<Record<string, string[]>>({});
  const [visibleGoalCountByStudentId, setVisibleGoalCountByStudentId] = useStickyState<Record<string, number>>(visibleCountsKey, {});
  const [showArchivedByStudentId, setShowArchivedByStudentId] = useStickyState<Record<string, boolean>>(showArchivedKey, {});

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState<Record<string, boolean>>({});
  const [isHeaderCardCollapsed, setIsHeaderCardCollapsed] = useState(false);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [selectionModalType, setSelectionModalType] = useState<'student' | 'goal' | null>(null);

  useEffect(() => {
    setStudentSessionStates(prevStates => {
      const newStates = { ...prevStates };
      let stateChanged = false;
  
      students.forEach(student => {
        const existingState = newStates[student.id];
        // Deep comparison of goals can be heavy. A simpler check might be student.goals.length or stringify.
        const goalsAreDifferent = !existingState || JSON.stringify(existingState.originalGoalHeaders) !== JSON.stringify(student.goals);

        if (goalsAreDifferent) {
          stateChanged = true;
          const initialGoalData: Record<string, SessionGoalData['data']> = {};
          student.goals.forEach(goal => {
            // Preserve existing data if goal still exists, otherwise initialize.
            initialGoalData[goal.id] = (existingState?.goalData?.[goal.id]) || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type] || {}));
          });
          newStates[student.id] = {
            studentId: student.id,
            studentName: student.name,
            activity: existingState?.activity || '',
            notes: existingState?.notes || '',
            originalGoalHeaders: student.goals,
            goalData: initialGoalData,
          };
        }
      });
  
      if (stateChanged) {
        return newStates;
      }
      return prevStates;
    });
  }, [students, setStudentSessionStates]);


  useEffect(() => {
    if (sessionDate === undefined) {
      setSessionDate(new Date());
    }
    if (sessionTime === '') {
      const now = new Date();
      setSessionTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      now.setHours(now.getHours() + 1);
      setSessionEndTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [setSessionDate, setSessionTime, setSessionEndTime, sessionDate, sessionTime]);

  useEffect(() => {
    const activeStudents = students.filter(s => !s.isArchived);
    if (selectedStudentIds.length === 0 && activeStudents.length > 0) {
      let initialIdToSelect: string | undefined = undefined;
      if (studentFromContext && activeStudents.find(s => s.id === studentFromContext.id)) {
        initialIdToSelect = studentFromContext.id;
      }
      if (initialIdToSelect) {
        setSelectedStudentIds([initialIdToSelect]);
        setFocusedStudentSlotIndex(0);
      }
    }
  }, [students, studentFromContext, selectedStudentIds.length, setSelectedStudentIds, setFocusedStudentSlotIndex]);
  
  const studentIdForEffect = selectedStudentIds[focusedStudentSlotIndex];
  const focusedGoalIndexForEffect = focusedGoalIndexByStudentId[studentIdForEffect];

  useEffect(() => {
    if (studentIdForEffect) {
        const studentCardId = `student-card-slot-${focusedStudentSlotIndex}`;
        const studentCardElement = document.getElementById(studentCardId);
        if (studentCardElement) {
            studentCardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        const studentState = studentSessionStates[studentIdForEffect];
        const focusedGoalIndex = focusedGoalIndexForEffect ?? 0;
        
        if (studentState?.originalGoalHeaders) {
            const visibleGoals = studentState.originalGoalHeaders.filter((g: any) => !g.isArchived || showArchivedByStudentId[studentIdForEffect]);
            if (visibleGoals.length > focusedGoalIndex) {
                const focusedGoal = visibleGoals[focusedGoalIndex];
                if (focusedGoal) {
                    const goalElementId = `goal-input-${studentIdForEffect}-${focusedGoal.id}`;
                    setTimeout(() => {
                        const goalElement = document.getElementById(goalElementId);
                        if (goalElement) {
                            goalElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 50);
                }
            }
        }
    }
  }, [focusedStudentSlotIndex, studentIdForEffect, focusedGoalIndexForEffect, showArchivedByStudentId, studentSessionStates]);


  const handleStudentSelect = useCallback((studentId: string, index: number) => {
    setSelectedStudentIds((prev: string[]) => {
      const newSelection = [...prev];
      newSelection[index] = studentId;
      return newSelection;
    });
    setFocusedStudentSlotIndex(index);
  }, [setSelectedStudentIds, setFocusedStudentSlotIndex]);

  const handleInputChange = (studentId: string, field: 'activity' | 'notes', value: string) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.', variant: 'default' });
      return;
    }
    setStudentSessionStates(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };
  
  const handleLocalAiFetch = async (studentId: string) => {
    const studentState = studentSessionStates[studentId];
    const activeGoals = studentState?.originalGoalHeaders.filter((g: any) => !g.isArchived);

    if (!studentState || !activeGoals || activeGoals.length === 0) {
      toast({ title: "Info", description: "Student has no active goals assigned or data is missing.", variant: "default" });
      return;
    }
    setIsAiLoading(prev => ({...prev, [studentId]: true}));
    
    try {
        const goalDescriptions = activeGoals.map(g => `${g.name} (${g.type})`).join(', ');
        const studentProgressSummary = `Currently working on: ${goalDescriptions}. Recent activity: ${studentState.activity}. Notes: ${studentState.notes}`;
        const sessionsForStudent = getSessionsForStudent(studentId);
        const sessionHistorySummary = sessionsForStudent.slice(0, 3).map(s => `Date: ${s.date}, Activity: ${s.activity}`).join('\n');

        const result = await getActivitySuggestions({
            goal: goalDescriptions,
            studentProgress: studentProgressSummary,
            sessionHistory: sessionHistorySummary,
        });
        setAiActivitySuggestions(prev => ({ ...prev, [studentId]: result.suggestions }));
        toast({ title: "AI Suggestions", description: `Found ${result.suggestions.length} activities. Reasoning: ${result.reasoning}` });
    } catch (error: any) {
        console.error("Error fetching AI activity suggestions:", error);
        addErrorLog({ message: 'Failed to fetch AI activity suggestions.', source: 'DataEntryContent.handleLocalAiFetch', details: error.message, type: 'error' });
        toast({ title: "AI Error", description: "Could not fetch activity suggestions.", variant: "destructive" });
    } finally {
        setIsAiLoading(prev => ({...prev, [studentId]: false}));
    }
  };
  
  const resetSessionStateForStudent = useCallback((studentId: string) => {
    setStudentSessionStates(prevStates => {
        const newStates = { ...prevStates };
        const studentState = newStates[studentId];
        if (studentState) {
            studentState.activity = '';
            studentState.notes = '';
            const initialGoalData: Record<string, SessionGoalData['data']> = {};
            studentState.originalGoalHeaders.forEach((goal: any) => {
                initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type] || {}));
            });
            studentState.goalData = initialGoalData;
        }
        return newStates;
    });
  }, [setStudentSessionStates]);


  const handleSave = async () => {
    if (!sessionDate) {
        toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
        return;
    }
    if (selectedStudentIds.length === 0 || focusedStudentSlotIndex >= selectedStudentIds.length) {
        toast({ title: "Error", description: "Please select a student to save a session for.", variant: "destructive" });
        return;
    }
    const focusedStudentId = selectedStudentIds[focusedStudentSlotIndex];
    if (!focusedStudentId) {
        toast({ title: "Error", description: "No student is currently focused.", variant: "destructive" });
        return;
    }
    const state = studentSessionStates[focusedStudentId];
    if (!state) {
        toast({ title: "Error", description: "Session data for the focused student is missing.", variant: "destructive" });
        addErrorLog({ message: 'Session state missing for focused student on save.', source: 'DataEntryContent.handleSave', details: `Student ID: ${focusedStudentId}`, type: 'error' });
        return;
    }
    if (isStudentAccessLocked) {
        toast({ title: "Simulated Save", description: `Access is locked. Session for ${state.studentName} not saved.` });
        return;
    }
    
    setIsSaving(true);
    const sessionGoals: SessionGoalData[] = state.originalGoalHeaders
        .filter((goal: any) => !goal.isArchived)
        .map((goal: any) => ({
            goalId: goal.id,
            goalName: goal.name,
            goalType: goal.type,
            data: state.goalData[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type])),
        }));

    if (sessionGoals.length === 0) {
        toast({ title: "Info", description: `Cannot save for ${state.studentName}, no active goals with data.`, variant: "default" });
        setIsSaving(false);
        return;
    }

    const session: Omit<any, 'sessionId'> = {
        studentId: state.studentId,
        studentName: state.studentName,
        date: sessionDate.toISOString(),
        time: sessionTime,
        endTime: sessionEndTime,
        activity: state.activity,
        notes: state.notes,
        goals: sessionGoals,
        originalGoalHeaders: state.originalGoalHeaders,
    };

    const savedSession = await addSession(session);
    if (savedSession) {
        toast({ title: "Success", description: `Session for ${state.studentName} saved.` });
        resetSessionStateForStudent(focusedStudentId);
    }
    setIsSaving(false);
  }

  const handleSaveAll = async () => {
    if (!sessionDate) {
        toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
        return;
    }
    if (selectedStudentIds.length === 0) {
        toast({ title: "Error", description: "No students selected to save sessions for.", variant: "destructive" });
        return;
    }
    setIsSavingAll(true);
    let savedCount = 0, errorCount = 0, simulatedCount = 0;
    for (const studentId of selectedStudentIds) {
        const state = studentSessionStates[studentId];
        if (!state) continue;
        if (isStudentAccessLocked) {
            simulatedCount++;
            continue;
        }
        const sessionGoals = state.originalGoalHeaders.filter((g: any) => !g.isArchived).map((g: any) => ({ goalId: g.id, goalName: g.name, goalType: g.type, data: state.goalData[g.id] || {} }));
        if (sessionGoals.length === 0) continue;
        const session = { studentId: state.studentId, studentName: state.studentName, date: sessionDate.toISOString(), time: sessionTime, endTime: sessionEndTime, activity: state.activity, notes: state.notes, goals: sessionGoals, originalGoalHeaders: state.originalGoalHeaders };
        const savedSession = await addSession(session);
        if (savedSession) {
            savedCount++;
            resetSessionStateForStudent(studentId);
        } else {
            errorCount++;
        }
    }
    if (savedCount > 0) toast({ title: "Success", description: `Saved ${savedCount} session(s).` });
    if (simulatedCount > 0) toast({ title: "Simulated Save", description: `${simulatedCount} session(s) not saved due to lock.` });
    if (errorCount > 0) toast({ title: "Error", description: `Failed to save ${errorCount} session(s).`, variant: "destructive" });
    setIsSavingAll(false);
  }

  const handleReset = () => {
    if (selectedStudentIds.length === 0 || focusedStudentSlotIndex >= selectedStudentIds.length) {
        toast({ title: "Info", description: "No student is focused to reset data for.", variant: "default" });
        return;
    }
    const focusedStudentId = selectedStudentIds[focusedStudentSlotIndex];
    resetSessionStateForStudent(focusedStudentId);
    toast({ title: "Data Reset", description: `Current unsaved data for the focused student has been reset.` });
    setIsResetConfirmationOpen(false);
  }
  
  const handleGoalDataChange = useCallback((studentId: string, goalId: string, updatedFieldName: string, newData: any) => {
    setStudentSessionStates(prevStates => {
        const studentState = prevStates[studentId];
        if (!studentState) return prevStates;
        const goal = studentState.originalGoalHeaders.find((g: any) => g.id === goalId);
        if (!goal) return prevStates;
        let processedData = { ...newData };
        return { ...prevStates, [studentId]: { ...studentState, goalData: { ...studentState.goalData, [goalId]: processedData } } };
    });
    const studentSlotIndex = selectedStudentIds.indexOf(studentId);
    if (studentSlotIndex !== -1) setFocusedStudentSlotIndex(studentSlotIndex);
    const allGoals = studentSessionStates[studentId]?.originalGoalHeaders || [];
    const visibleGoals = allGoals.filter((g: any) => !g.isArchived || showArchivedByStudentId[studentId]);
    const goalIndexInVisibleList = visibleGoals.findIndex((g: any) => g.id === goalId);
    if (goalIndexInVisibleList !== -1) setFocusedGoalIndexByStudentId(prev => ({ ...prev, [studentId]: goalIndexInVisibleList }));
  }, [studentSessionStates, selectedStudentIds, showArchivedByStudentId, setFocusedStudentSlotIndex, setFocusedGoalIndexByStudentId, setStudentSessionStates]);
    
  const handleMoveGoal = useCallback((studentId: string, goalId: string, direction: 'up' | 'down') => {
    setStudentSessionStates(prevStates => {
        const studentState = prevStates[studentId];
        if (!studentState) return prevStates;
        const goals = [...studentState.originalGoalHeaders];
        const goalIndex = goals.findIndex((g: any) => g.id === goalId);
        if (goalIndex === -1) return prevStates;
        const newIndex = direction === 'up' ? goalIndex - 1 : goalIndex + 1;
        if (newIndex < 0 || newIndex >= goals.length) return prevStates;
        const [movedGoal] = goals.splice(goalIndex, 1);
        goals.splice(newIndex, 0, movedGoal);
        const visibleGoals = goals.filter((g: any) => !g.isArchived || showArchivedByStudentId[studentId]);
        const newFocusedIndexInVisible = visibleGoals.findIndex((g: any) => g.id === goalId);
        setFocusedGoalIndexByStudentId(prev => ({ ...prev, [studentId]: newFocusedIndexInVisible !== -1 ? newFocusedIndexInVisible : 0 }));
        return { ...prevStates, [studentId]: { ...studentState, originalGoalHeaders: goals } };
    });
  }, [showArchivedByStudentId, setFocusedGoalIndexByStudentId, setStudentSessionStates]);

  const addStudentSlot = useCallback(() => {
    const activeStudents = students.filter(s => !s.isArchived);
    setSelectedStudentIds(prevIds => {
      const availableStudent = activeStudents.find(s => !prevIds.includes(s.id));
      if (availableStudent) {
        setFocusedStudentSlotIndex(prevIds.length);
        return [...prevIds, availableStudent.id];
      } else {
        toast({ title: "Info", description: "No more unique available students to add.", variant: "default" });
        return prevIds;
      }
    });
  }, [students, toast, setSelectedStudentIds, setFocusedStudentSlotIndex]);

  const removeStudentSlot = useCallback((indexToRemove: number) => {
    setSelectedStudentIds(prev => {
      const currentFocusedId = prev[focusedStudentSlotIndex];
      const newSelectedIds = prev.filter((_, i) => i !== indexToRemove);

      if (newSelectedIds.length === 0) {
          setFocusedStudentSlotIndex(0);
      } else {
          let newFocusIndex = newSelectedIds.indexOf(currentFocusedId);
          if (newFocusIndex === -1) {
              newFocusIndex = Math.min(indexToRemove, newSelectedIds.length - 1);
              newFocusIndex = Math.max(0, newFocusIndex);
          }
          setFocusedStudentSlotIndex(newFocusIndex);
      }
      return newSelectedIds;
    });
  }, [focusedStudentSlotIndex, setSelectedStudentIds, setFocusedStudentSlotIndex]);

  const availableStudentsForDropdown = useMemo(() => {
    const activeStudents = students.filter(s => !s.isArchived);
    return activeStudents.filter(s => !selectedStudentIds.includes(s.id));
  }, [students, selectedStudentIds]);

  const handleOpenResetConfirmation = () => {
    if (selectedStudentIds.length === 0) {
      toast({ title: "Info", description: "No students selected to reset data for.", variant: "default" });
      return;
    }
    setIsResetConfirmationOpen(true);
  };
  
  const studentSlotsForModal = useMemo(() => {
    const activeStudentsInSlots = selectedStudentIds
      .map(id => students.find(s => s.id === id))
      .filter((s): s is Student => !!s);
    return activeStudentsInSlots.map((student, index) => ({
      id: index.toString(),
      name: student.name,
    }));
  }, [selectedStudentIds, students]);
  
  const focusedStudentIdForModal = useMemo(() => {
    return focusedStudentSlotIndex.toString();
  }, [focusedStudentSlotIndex]);

  const handleSelectStudentFromModal = (indexStr: string) => {
    setFocusedStudentSlotIndex(parseInt(indexStr, 10));
    setSelectionModalType(null);
  };
  
  const activeStudentsInSlots = useMemo(() => selectedStudentIds
      .map(id => students.find(s => s.id === id))
      .filter((s): s is Student => !!s), [selectedStudentIds, students]);


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
          {selectionModalType === 'student' && (
            <SelectionModal
              isOpen={selectionModalType === 'student'}
              onClose={() => setSelectionModalType(null)}
              title="Select Focused Student"
              items={studentSlotsForModal}
              onSelect={handleSelectStudentFromModal}
              selectedId={focusedStudentIdForModal}
            />
          )}
        </Suspense>
        
        <div className="flex-shrink-0">
          <Suspense fallback={<Card><CardContent>Loading header...</CardContent></Card>}>
            <DataEntryHeaderCard
              isHeaderCardCollapsed={isHeaderCardCollapsed}
              setIsHeaderCardCollapsed={setIsHeaderCardCollapsed}
              dataEntrySessionDate={sessionDate}
              setDataEntrySessionDate={setSessionDate}
              dataEntrySessionTime={sessionTime}
              setDataEntrySessionTime={setSessionTime}
              dataEntrySessionEndTime={sessionEndTime}
              setDataEntrySessionEndTime={setSessionEndTime}
              isStudentAccessLocked={isStudentAccessLocked}
              setIsStudentAccessLocked={setIsStudentAccessLocked}
            />
          </Suspense>
        </div>

        <div className="flex-grow min-h-0 relative group">
          <ScrollArea 
            className="h-full w-full" 
          >
            <Suspense fallback={<div>Loading student cards...</div>}>
              <StudentCardsList
                  dataEntrySelectedStudentIds={selectedStudentIds}
                  students={students}
                  dataEntryStudentSessionStates={studentSessionStates}
                  dataEntryFocusedStudentSlotIndex={focusedStudentSlotIndex}
                  availableStudentsForDropdown={availableStudentsForDropdown}
                  dataEntryShowArchivedByStudentId={showArchivedByStudentId}
                  setDataEntryShowArchivedByStudentId={setShowArchivedByStudentId}
                  dataEntryVisibleGoalCountByStudentId={visibleGoalCountByStudentId}
                  setDataEntryVisibleGoalCountByStudentId={setVisibleGoalCountByStudentId}
                  dataEntryFocusedGoalIndexByStudentId={focusedGoalIndexByStudentId}
                  dataEntryAiActivitySuggestions={aiActivitySuggestions}
                  isAiLoading={isAiLoading}
                  setDataEntryFocusedStudentSlotIndex={setFocusedStudentSlotIndex}
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
        
        {selectedStudentIds.length > 0 && (
            <div className="sticky bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm mt-auto">
                <div className="flex justify-between items-center gap-2 p-2 border-t">
                    <div className="hidden sm:block">
                      <TouchControls
                        activeStudentsInSlots={activeStudentsInSlots}
                        studentSessionStates={studentSessionStates}
                        focusedStudentSlotIndex={focusedStudentSlotIndex}
                        setFocusedStudentSlotIndex={setFocusedStudentSlotIndex}
                        focusedGoalIndexByStudentId={focusedGoalIndexByStudentId}
                        setFocusedGoalIndexByStudentId={setFocusedGoalIndexByStudentId}
                        showArchivedByStudentId={showArchivedByStudentId}
                        selectionModalType={selectionModalType}
                        setSelectionModalType={setSelectionModalType}
                      />
                    </div>
                    
                    <div className="sm:hidden">
                       <TouchControls
                        activeStudentsInSlots={activeStudentsInSlots}
                        studentSessionStates={studentSessionStates}
                        focusedStudentSlotIndex={focusedStudentSlotIndex}
                        setFocusedStudentSlotIndex={setFocusedStudentSlotIndex}
                        focusedGoalIndexByStudentId={focusedGoalIndexByStudentId}
                        setFocusedGoalIndexByStudentId={setFocusedGoalIndexByStudentId}
                        showArchivedByStudentId={showArchivedByStudentId}
                        selectionModalType={selectionModalType}
                        setSelectionModalType={setSelectionModalType}
                      />
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
        {selectedStudentIds.length === 0 && (
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

    

    