
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, SessionData, SessionGoalData, PromptType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Save, PlusCircle, XCircle, Edit2, Info, ArrowUp, ArrowDown, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import GoalDataInputComponent from '@/components/forms/goal-data-input';
import { GOAL_TYPE_FIELDS, PROMPT_HOTKEY_MAP } from '@/lib/constants';
import { generateUUID } from '@/lib/helpers';
import { getActivitySuggestions } from '@/ai/flows/activity-suggestions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useErrorLog } from '@/hooks/use-error-log';
import ConfirmationModal from '@/components/modals/confirmation-modal';


interface StudentSessionState {
  studentId: string;
  studentName: string;
  activity: string;
  notes: string;
  goalData: Record<string, SessionGoalData['data']>;
  originalGoalHeaders: Goal[];
}

export default function DataEntryPage() {
  const {
    students,
    loading: studentsLoading,
    addSession,
    getSessionsForStudent,
    selectedStudent: studentFromContext,
    openEditStudentModal
  } = useStudentData();
  const [sessionDate, setSessionDate] = useState<Date | undefined>(new Date());
  const [sessionTime, setSessionTime] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSessionStates, setStudentSessionStates] = useState<Record<string, StudentSessionState>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [aiActivitySuggestions, setAiActivitySuggestions] = useState<Record<string, string[]>>({});
  const [isAiLoading, setIsAiLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();

  const [focusedStudentSlotIndex, setFocusedStudentSlotIndex] = useState<number>(0);
  const [focusedGoalIndexByStudentId, setFocusedGoalIndexByStudentId] = useState<Record<string, number>>({});
  const [isHeaderCardCollapsed, setIsHeaderCardCollapsed] = useState(false);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);


  const handleGoalDataChange = useCallback(
    (studentId: string, goalId: string, updatedFieldName: string, newData: SessionGoalData['data']) => {
      setStudentSessionStates(prevStates => {
        const studentState = prevStates[studentId];
        if (!studentState) return prevStates;

        const goal = studentState.originalGoalHeaders.find(g => g.id === goalId);
        if (!goal) return prevStates;

        let processedData = { ...newData };

        if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') {
          let newTotalSyllables = Math.max(0, Number(processedData.totalSyllables || 0));
          let newStutteredSyllables = Math.max(0, Number(processedData.stutteredSyllables || 0));

          if (updatedFieldName === 'stutteredSyllables') {
            newTotalSyllables = Math.max(newTotalSyllables, newStutteredSyllables);
          }
          else if (updatedFieldName === 'totalSyllables') {
            newStutteredSyllables = Math.min(newStutteredSyllables, newTotalSyllables);
          }

          processedData.totalSyllables = newTotalSyllables;
          processedData.stutteredSyllables = newStutteredSyllables;
        }

        return {
          ...prevStates,
          [studentId]: {
            ...studentState,
            goalData: {
              ...studentState.goalData,
              [goalId]: processedData,
            },
          },
        };
      });
    },
    []
  );

  const getCurrentFocusedGoalInfo = useCallback(() => {
    if (selectedStudentIds.length === 0 || focusedStudentSlotIndex >= selectedStudentIds.length) {
      return null;
    }
    const studentId = selectedStudentIds[focusedStudentSlotIndex];
    const studentState = studentSessionStates[studentId];
    if (!studentState || !studentState.originalGoalHeaders || studentState.originalGoalHeaders.length === 0) {
      return { studentId, studentState: studentState || null, goal: null, goalData: null, goalIndex: -1 };
    }
    const goalIndex = focusedGoalIndexByStudentId[studentId] ?? 0;
    if (goalIndex >= studentState.originalGoalHeaders.length) {
      return { studentId, studentState, goal: null, goalData: null, goalIndex: -1 };
    }
    const goal = studentState.originalGoalHeaders[goalIndex];
    const goalData = studentState.goalData[goal.id];
    return { studentId, studentState, goal, goalData, goalIndex };
  }, [selectedStudentIds, focusedStudentSlotIndex, studentSessionStates, focusedGoalIndexByStudentId]);

  const handleSaveSession = useCallback(async () => {
    if (!sessionDate || selectedStudentIds.length === 0) {
      toast({ title: "Error", description: "Please select a date and at least one student.", variant: "destructive"});
      return;
    }
    setIsSaving(true);
    let sessionsSavedCount = 0;
    for (const studentId of selectedStudentIds) {
      const state = studentSessionStates[studentId];
      if (state) {
        const sessionGoals: SessionGoalData[] = state.originalGoalHeaders.map(goal => ({
          goalId: goal.id,
          goalName: goal.name,
          goalType: goal.type,
          data: state.goalData[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type])),
        }));

        const session: Omit<SessionData, 'sessionId'> = {
          studentId: state.studentId,
          studentName: state.studentName,
          date: sessionDate.toISOString(),
          time: sessionTime,
          activity: state.activity,
          notes: state.notes,
          goals: sessionGoals,
          originalGoalHeaders: state.originalGoalHeaders,
        };
        await addSession(session);
        sessionsSavedCount++;
      }
    }
    setIsSaving(false);
    if (sessionsSavedCount > 0) {
        toast({ title: "Success", description: `${sessionsSavedCount} session(s) saved.`});
        const newStates = {...studentSessionStates};
        selectedStudentIds.forEach(id => {
            if(newStates[id]) {
                newStates[id].activity = '';
                newStates[id].notes = '';
                const initialGoalData: Record<string, SessionGoalData['data']> = {};
                const student = students.find(s => s.id === id);
                student?.goals.forEach(goal => {
                  initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                });
                newStates[id].goalData = initialGoalData;
            }
        });
        setStudentSessionStates(newStates);

    } else {
        toast({ title: "Info", description: "No sessions were saved. Ensure students have data.", variant: "default"});
    }
  }, [sessionDate, selectedStudentIds, studentSessionStates, students, addSession, sessionTime, toast]);


 useEffect(() => {
    if (!studentsLoading && selectedStudentIds.length === 0) {
      let initialIdToSelect: string | undefined = undefined;
      if (studentFromContext && students.find(s => s.id === studentFromContext.id)) {
        initialIdToSelect = studentFromContext.id;
      }
      if (initialIdToSelect) {
        setSelectedStudentIds([initialIdToSelect]);
        setFocusedStudentSlotIndex(0);
      } else {
        setSelectedStudentIds([]);
      }
    }
  }, [studentsLoading, students, studentFromContext, selectedStudentIds.length, setFocusedStudentSlotIndex]);


  useEffect(() => {
    const newStates: Record<string, StudentSessionState> = {};
    const newFocusedGoalIndexes: Record<string, number> = { ...focusedGoalIndexByStudentId };

    selectedStudentIds.forEach((id, idx) => {
      const student = students.find(s => s.id === id);
      if (student) {
        const existingState = studentSessionStates[id];
        const initialGoalData: Record<string, SessionGoalData['data']> = {};

        const goalsToUse = existingState?.originalGoalHeaders &&
                           existingState.originalGoalHeaders.length > 0 &&
                           existingState.originalGoalHeaders.every(g => student.goals.some(sg => sg.id === g.id))
                           ? existingState.originalGoalHeaders
                           : student.goals;

        goalsToUse.forEach(goal => {
          initialGoalData[goal.id] = existingState?.goalData?.[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
        });

        newStates[id] = {
          studentId: student.id,
          studentName: student.name,
          activity: existingState?.activity || '',
          notes: existingState?.notes || '',
          goalData: initialGoalData,
          originalGoalHeaders: goalsToUse,
        };

        if (newFocusedGoalIndexes[id] === undefined ) {
            newFocusedGoalIndexes[id] = 0;
        } else if (existingState && focusedGoalIndexByStudentId[id] !== undefined) {
            newFocusedGoalIndexes[id] = focusedGoalIndexByStudentId[id];
        } else {
             newFocusedGoalIndexes[id] = 0;
        }
      }
    });
    setStudentSessionStates(newStates);
    setFocusedGoalIndexByStudentId(newFocusedGoalIndexes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentIds, students, focusedStudentSlotIndex]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      if (event.ctrlKey && event.key === 'Enter') {
        if (selectedStudentIds.length > 0) {
          event.preventDefault();
          handleSaveSession();
        }
        return;
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      const key = event.key.toUpperCase();
      const alt = event.altKey;

      if (alt && key === 'E') {
        event.preventDefault();
        if (selectedStudentIds.length > 0 && focusedStudentSlotIndex < selectedStudentIds.length) {
          const focusedStudentId = selectedStudentIds[focusedStudentSlotIndex];
          const studentToEdit = students.find(s => s.id === focusedStudentId);
          if (studentToEdit) {
            openEditStudentModal(studentToEdit);
          }
        }
        return;
      }


      const focusedInfo = getCurrentFocusedGoalInfo();

      if (!alt && key.match(/^[1-4]$/)) {
        event.preventDefault();
        const slotIndex = parseInt(key, 10) - 1;
        if (slotIndex < selectedStudentIds.length) {
          setFocusedStudentSlotIndex(slotIndex);
        }
        return;
      }

      if (key === 'A' && selectedStudentIds.length > 0) {
        event.preventDefault();
        if (alt) {
          setFocusedStudentSlotIndex(prev => (prev - 1 + selectedStudentIds.length) % selectedStudentIds.length);
        } else {
          setFocusedStudentSlotIndex(prev => (prev + 1) % selectedStudentIds.length);
        }
        return;
      }

      if (!focusedInfo || !focusedInfo.goal || !focusedInfo.goalData) return;

      const { studentId, studentState, goal, goalData, goalIndex } = focusedInfo;

      if (key === 'S') {
        event.preventDefault();
        const numGoals = studentState.originalGoalHeaders.length;
        if (numGoals > 0) {
          const nextIndex = alt ? (goalIndex - 1 + numGoals) % numGoals : (goalIndex + 1) % numGoals;
          setFocusedGoalIndexByStudentId(prev => ({ ...prev, [studentId]: nextIndex }));
        }
        return;
      }

      const promptToUpdate = PROMPT_HOTKEY_MAP[key];
      if (promptToUpdate && !alt && goal.type !== 'QUALITATIVE_OBSERVATION' && goal.type !== 'FLUENCY_SYLLABLE_STUTTER') {
        event.preventDefault();
        const currentCount = Number(goalData[promptToUpdate] || 0);
        const newValue = currentCount + 1;
        handleGoalDataChange(studentId, goal.id, promptToUpdate, { ...goalData, [promptToUpdate]: newValue });
        return;
      }
      if (promptToUpdate && alt && goal.type !== 'QUALITATIVE_OBSERVATION' && goal.type !== 'FLUENCY_SYLLABLE_STUTTER') {
        event.preventDefault();
        const currentCount = Number(goalData[promptToUpdate] || 0);
        const newValue = Math.max(0, currentCount - 1);
        handleGoalDataChange(studentId, goal.id, promptToUpdate, { ...goalData, [promptToUpdate]: newValue });
        return;
      }

      let fieldToUpdate: string | null = null;
      let increment = 0;

      if (goal.type === 'QUALITATIVE_OBSERVATION' && !alt) {
        if (key === 'C') {
          event.preventDefault();
          const currentRating = Number(goalData.rating ?? 3);
          const newRating = Math.min(5, currentRating + 1);
          handleGoalDataChange(studentId, goal.id, 'rating', { ...goalData, rating: newRating });
          return;
        } else if (key === 'N') {
          event.preventDefault();
          const currentRating = Number(goalData.rating ?? 3);
          const newRating = Math.max(1, currentRating - 1);
          handleGoalDataChange(studentId, goal.id, 'rating', { ...goalData, rating: newRating });
          return;
        }
      }


      if (key === 'C') {
        increment = alt ? -1 : 1;
        if (goal.type === 'ARTICULATION') fieldToUpdate = 'correct';
        else if (goal.type === 'LANGUAGE_COMPREHENSION') fieldToUpdate = 'questionsCorrect';
        else if (goal.type === 'LANGUAGE_EXPRESSION') fieldToUpdate = 'successfulResponses';
        else if (goal.type === 'PHONOLOGICAL_PROCESSES') fieldToUpdate = 'correctProductions';
        else if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') fieldToUpdate = 'totalSyllables';
      } else if (key === 'N') {
        increment = alt ? -1 : 1;
        if (goal.type === 'ARTICULATION') fieldToUpdate = 'incorrect';
        else if (goal.type === 'LANGUAGE_COMPREHENSION') fieldToUpdate = 'questionsIncorrect';
        else if (goal.type === 'LANGUAGE_EXPRESSION') fieldToUpdate = 'unsuccessfulResponses';
        else if (goal.type === 'PHONOLOGICAL_PROCESSES') fieldToUpdate = 'incorrectProductions';
        else if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') fieldToUpdate = 'stutteredSyllables';
      }

      if (fieldToUpdate && increment !== 0) {
        event.preventDefault();
        const currentValue = Number(goalData[fieldToUpdate] || 0);
        const newValue = Math.max(0, currentValue + increment);
        handleGoalDataChange(studentId, goal.id, fieldToUpdate, { ...goalData, [fieldToUpdate]: newValue });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStudentIds, studentSessionStates, focusedStudentSlotIndex, focusedGoalIndexByStudentId, handleGoalDataChange, getCurrentFocusedGoalInfo, handleSaveSession, students, openEditStudentModal]);


  useEffect(() => {
    if (selectedStudentIds.length > 0 && focusedStudentSlotIndex >= 0 && focusedStudentSlotIndex < selectedStudentIds.length) {
      const studentCardId = `student-card-slot-${focusedStudentSlotIndex}`;
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
  }, [selectedStudentIds, focusedStudentSlotIndex, focusedGoalIndexByStudentId, getCurrentFocusedGoalInfo]);


  const handleStudentSelect = (studentId: string, index: number) => {
    setSelectedStudentIds(prev => {
      const newSelection = [...prev];
      newSelection[index] = studentId;
      const uniqueSelection = Array.from(new Set(newSelection));
      return uniqueSelection;
    });
    setFocusedStudentSlotIndex(index);
  };

  const addStudentSlot = () => {
    const availableStudent = students.find(s => !selectedStudentIds.includes(s.id));
    if (availableStudent) {
      setSelectedStudentIds(prev => [...prev, availableStudent.id]);
      setFocusedStudentSlotIndex(selectedStudentIds.length); 
    } else {
      toast({ title: "Info", description: "No more unique available students to add, or all students are already in slots.", variant: "default" });
    }
  };

  const removeStudentSlot = (indexToRemove: number) => {
    const currentFocusedId = selectedStudentIds[focusedStudentSlotIndex];
    const studentIdToRemove = selectedStudentIds[indexToRemove];

    const newSelectedIds = selectedStudentIds.filter((_, i) => i !== indexToRemove);
    setSelectedStudentIds(newSelectedIds);

    setStudentSessionStates(prevStates => {
      const newStates = {...prevStates};
      delete newStates[studentIdToRemove];
      return newStates;
    });

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
  };


  const handleInputChange = (studentId: string, field: 'activity' | 'notes', value: string) => {
    setStudentSessionStates(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleMoveGoal = useCallback((studentId: string, goalId: string, direction: 'up' | 'down') => {
    setStudentSessionStates(prevStates => {
      const studentState = prevStates[studentId];
      if (!studentState) return prevStates;

      const goals = [...studentState.originalGoalHeaders];
      const goalIndex = goals.findIndex(g => g.id === goalId);

      if (goalIndex === -1) return prevStates;

      const newIndex = direction === 'up' ? goalIndex - 1 : goalIndex + 1;

      if (newIndex < 0 || newIndex >= goals.length) return prevStates;

      const [movedGoal] = goals.splice(goalIndex, 1);
      goals.splice(newIndex, 0, movedGoal);

      setFocusedGoalIndexByStudentId(prevFocused => {
        const currentFocusedIdx = prevFocused[studentId] ?? 0;
        let newFocusedIdx = currentFocusedIdx;

        if (currentFocusedIdx === goalIndex) {
          newFocusedIdx = newIndex;
        } else if (goalIndex < currentFocusedIdx && newIndex >= currentFocusedIdx) {
          newFocusedIdx = currentFocusedIdx - 1;
        } else if (goalIndex > currentFocusedIdx && newIndex <= currentFocusedIdx) {
          newFocusedIdx = currentFocusedIdx + 1;
        }
        return { ...prevFocused, [studentId]: newFocusedIdx };
      });

      return {
        ...prevStates,
        [studentId]: {
          ...studentState,
          originalGoalHeaders: goals,
        },
      };
    });
  }, []);

  const fetchAiActivitySuggestions = async (studentId: string) => {
    const studentState = studentSessionStates[studentId];
    if (!studentState || studentState.originalGoalHeaders.length === 0) {
      toast({ title: "Info", description: "Student has no goals assigned or data is missing.", variant: "default" });
      return;
    }
    setIsAiLoading(prev => ({...prev, [studentId]: true}));
    try {
      const goalDescriptions = studentState.originalGoalHeaders.map(g => `${g.name} (${g.type})`).join(', ');
      const studentProgressSummary = `Currently working on: ${goalDescriptions}. Recent activity: ${studentState.activity}. Notes: ${studentState.notes}`;
      const studentSessions = getSessionsForStudent(studentId);
      const sessionHistorySummary = studentSessions.slice(0,3).map(s => `Date: ${s.date}, Activity: ${s.activity}`).join('\n');

      const result = await getActivitySuggestions({
        goal: goalDescriptions,
        studentProgress: studentProgressSummary,
        sessionHistory: sessionHistorySummary,
      });
      setAiActivitySuggestions(prev => ({ ...prev, [studentId]: result.suggestions }));
      toast({ title: "AI Suggestions", description: `Found ${result.suggestions.length} activities. Reasoning: ${result.reasoning}` });
    } catch (error: any) {
      console.error("Error fetching AI activity suggestions:", error);
      addErrorLog({ message: 'Failed to fetch AI activity suggestions.', source: 'DataEntryPage.fetchAiActivitySuggestions', details: error.message, type: 'error' });
      toast({ title: "AI Error", description: "Could not fetch activity suggestions.", variant: "destructive" });
    } finally {
      setIsAiLoading(prev => ({...prev, [studentId]: false}));
    }
  };

  const availableStudentsForDropdown = useMemo(() => {
    return students.filter(s => !selectedStudentIds.includes(s.id));
  }, [students, selectedStudentIds]);


  const handleOpenResetConfirmation = () => {
    if (selectedStudentIds.length === 0) {
      toast({ title: "Info", description: "No students selected to reset data for.", variant: "default" });
      return;
    }
    setIsResetConfirmationOpen(true);
  };

  const handleConfirmResetSession = () => {
    const newStates = { ...studentSessionStates };
    selectedStudentIds.forEach(id => {
      if (newStates[id]) {
        newStates[id].activity = '';
        newStates[id].notes = '';
        const student = students.find(s => s.id === id);
        if (student) {
          const initialGoalData: Record<string, SessionGoalData['data']> = {};
          // Use originalGoalHeaders from the current state for this student to reset accurately
          newStates[id].originalGoalHeaders.forEach(goal => {
            initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
          });
          newStates[id].goalData = initialGoalData;
        }
      }
    });
    setStudentSessionStates(newStates);
    toast({ title: "Data Reset", description: "Current unsaved data for selected students has been reset." });
    setIsResetConfirmationOpen(false);
  };


  if (studentsLoading && students.length === 0) {
    return (
      <div className="space-y-6">
        <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <div className="flex flex-row gap-6 items-start overflow-x-auto py-4 px-1">
            <Skeleton className="h-96 w-[350px] flex-shrink-0" />
            <Skeleton className="h-96 w-[350px] flex-shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
       {isResetConfirmationOpen && (
        <ConfirmationModal
          isOpen={isResetConfirmationOpen}
          onClose={() => setIsResetConfirmationOpen(false)}
          onConfirm={handleConfirmResetSession}
          title="Reset Unsaved Data?"
          description="Are you sure you want to clear all current unsaved activity, notes, and goal data for the selected students? This action cannot be undone."
          confirmText="Yes, Reset Data"
        />
      )}
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
                <DatePicker date={sessionDate} setDate={setSessionDate} />
                </div>
                <div className="w-full sm:w-auto">
                    <Label htmlFor="sessionTime" className="block text-sm font-medium mb-1">Session Time</Label>
                    <Input
                        id="sessionTime"
                        type="time"
                        value={sessionTime}
                        onChange={(e) => setSessionTime(e.target.value)}
                        className="w-full sm:w-[150px]"
                    />
                </div>
            </div>
            <p className="text-sm text-muted-foreground">
                Hotkeys: 1-4 Focus initial slots | A/Alt+A Cycle Students | S/Alt+S Cycle Goals | C/Alt+C Correct/Total/Slider+ | N/Alt+N Incorrect/Stuttered/Slider- | V/G/P/F/I Prompts | Ctrl+Enter Save | Alt+E Edit Student.
            </p>
            </CardContent>
        )}
      </Card>

      <div className="flex flex-row gap-6 items-start overflow-x-auto py-4 px-1 flex-grow min-h-0">
        {selectedStudentIds.map((studentId, slotIndex) => {
          const student = students.find(s => s.id === studentId);
          const state = studentSessionStates[studentId];
          if (!student || !state) return null;

          const isStudentFocused = slotIndex === focusedStudentSlotIndex;
          const goalsToDisplay = state.originalGoalHeaders;

          return (
            <Card
              key={studentId}
              id={`student-card-slot-${slotIndex}`} 
              className={cn(
                `flex flex-col transition-all duration-300 ease-in-out shadow-md flex-shrink-0`,
                isStudentFocused ? 'w-[450px]' : 'w-[350px]', 
                isStudentFocused && 'ring-2 ring-primary ring-offset-2 shadow-xl'
              )}
              onClick={() => setFocusedStudentSlotIndex(slotIndex)}
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
                        <SelectItem value={student.id} key={student.id} disabled={selectedStudentIds.includes(student.id) && student.id !== studentId}>
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
                    {selectedStudentIds.length > 0 && (
                       <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); removeStudentSlot(slotIndex);}} className="h-8 w-8" title="Remove Student Slot">
                        <XCircle className="h-5 w-5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <ScrollArea className="flex-grow h-[450px]"> 
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

                  {goalsToDisplay.length === 0 ? (
                     <p className="text-sm text-muted-foreground p-4 text-center border rounded-md">No goals assigned to this student. Assign goals in the Student Profile.</p>
                  ) : (
                    <>
                      {goalsToDisplay.map((goal, goalIdx) => {
                        const isGoalFocused = isStudentFocused && (focusedGoalIndexByStudentId[studentId] ?? 0) === goalIdx;
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
                            canMoveUp={goalIdx > 0}
                            canMoveDown={goalIdx < goalsToDisplay.length - 1}
                          />
                        );
                      })}
                    </>
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
                        onClick={() => fetchAiActivitySuggestions(studentId)}
                        disabled={isAiLoading[studentId] || state.originalGoalHeaders.length === 0}
                        className="w-full"
                    >
                      {isAiLoading[studentId] ? 'Getting Suggestions...' : 'Get AI Activity Suggestions'}
                    </Button>
                    {aiActivitySuggestions[studentId] && aiActivitySuggestions[studentId].length > 0 && (
                      <div className="p-2 border rounded-md bg-accent/30">
                        <h4 className="text-xs font-semibold mb-1">Suggested Activities:</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {aiActivitySuggestions[studentId].map((sugg, i) => <li key={i}>{sugg}</li>)}
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

      {selectedStudentIds.length > 0 && (
        <div className="mt-auto flex-shrink-0 flex justify-end items-center gap-2 py-4 border-t">
           <Button variant="outline" onClick={handleOpenResetConfirmation} disabled={isSaving} size="lg">
            <RotateCcw className="mr-2 h-5 w-5" />
            Reset Current Data
          </Button>
          <Button onClick={handleSaveSession} disabled={isSaving} size="lg">
            <Save className="mr-2 h-5 w-5" />
            {isSaving ? 'Saving Session(s)...' : 'Save Session(s)'}
          </Button>
        </div>
      )}
       {selectedStudentIds.length === 0 && !studentsLoading && (
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
    
    
