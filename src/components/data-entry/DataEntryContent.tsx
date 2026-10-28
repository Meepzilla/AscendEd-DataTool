
'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { useAuth } from '@/hooks/use-auth';
import { loadDataEntryDraft, saveDataEntryDraft, hasUnsavedEntry, type DataEntryDraft } from '@/lib/data-entry-draft';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Info, PlusCircle } from 'lucide-react';
import type { Student, StudentSessionState, SessionGoalData, GoalType } from '@/lib/types';
import TouchControls from '@/components/forms/touch-controls';
import { ConfettiProvider } from '@/hooks/use-confetti';
import { ScrollArea } from '../ui/scroll-area';
import { GOAL_TYPE_FIELDS, GOAL_TYPES, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS, finalizeBehaviorData } from '@/lib/goal-constants';
import { PROMPT_HOTKEY_MAP } from '@/lib/promptConstants';
import GoalFocusManager from './GoalFocusManager';
import { getActivitySuggestions as getAiActivitySuggestions } from '@/ai/flows/activity-suggestions';


const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const StudentCardsList = lazy(() => import('@/components/data-entry/StudentCardsList'));
const DataEntryHeaderCard = lazy(() => import('@/components/data-entry/DataEntryHeaderCard'));
const SelectionModal = lazy(() => import('@/components/modals/selection-modal'));

// Whether Data Entry has been open since the app loaded. Switching pages keeps the module, so the
// "restored" notice shows only when the app reopens with unsaved data, not every time the page is revisited.
let openedSinceAppLoad = false;

export default function DataEntryContent() {
  const {
    students,
    studentFromContext,
    openEditStudentModal,
    addSession,
    addErrorLog,
    getSessionsForStudent,
  } = useStudentData();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  // Unsaved work from the last visit to this page (kept while switching pages, or if the app was closed).
  // This component only renders in the browser, so the draft can seed the initial state directly.
  const draftRef = useRef<DataEntryDraft | null | undefined>(undefined);
  if (draftRef.current === undefined) draftRef.current = loadDataEntryDraft(uid);
  const draft = draftRef.current;
  const goalDefaults = useCallback((goalId: string) => {
    for (const student of students) {
      const goal = student.goals.find(g => g.id === goalId);
      if (goal) return GOAL_TYPE_FIELDS[goal.type];
    }
    return undefined;
  }, [students]);
  // The draft's date and times are kept only when something was entered; otherwise the session starts now.
  const [draftHadEntries] = useState(() => !!draft && Object.values(draft.students).some(s => hasUnsavedEntry(s, goalDefaults)));
  
  const [sessionDate, setSessionDate] = useState<Date | undefined>(() =>
    draftHadEntries && draft?.sessionDate ? new Date(draft.sessionDate) : new Date());
  const [sessionTime, setSessionTime] = useState<string>(() => (draftHadEntries && draft?.sessionTime) || '');
  const [sessionEndTime, setSessionEndTime] = useState<string>(() => (draftHadEntries && draft?.sessionEndTime) || '');
  
  const [focusedGoalIndexByStudentId, setFocusedGoalIndexByStudentId] = useState<Record<string, number>>(() => draft?.focusedGoalIndexByStudentId ?? {});
  const [visibleGoalCountByStudentId, setVisibleGoalCountByStudentId] = useState<Record<string, number>>({});
  const [showArchivedByStudentId, setShowArchivedByStudentId] = useState<Record<string, boolean>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isHeaderCardCollapsed, setIsHeaderCardCollapsed] = useState(() => draft?.isHeaderCardCollapsed ?? false);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [selectionModalType, setSelectionModalType] = useState<'student' | 'goal' | null>(null);
  const [isStudentAccessLocked, setIsStudentAccessLocked] = useState(() => draft?.isStudentAccessLocked ?? false);
  
  // UI State moved from useStudentData
  const [studentSessionStates, setStudentSessionStates] = useState<Record<string, StudentSessionState>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(() =>
    (draft?.selectedStudentIds ?? []).filter(id => students.some(s => s.id === id && !s.isArchived)));
  const [focusedStudentSlotIndex, setFocusedStudentSlotIndex] = useState<number>(() =>
    Math.max(0, Math.min(draft?.focusedStudentSlotIndex ?? 0, selectedStudentIds.length - 1)));
  const [aiActivitySuggestions, setAiActivitySuggestions] = useState<Record<string, string[]>>({});
  const [isAiLoading, setIsAiLoading] = useState<Record<string, boolean>>({});

  const activeStudents = useMemo(() => students.filter(s => !s.isArchived), [students]);

  useEffect(() => {
    // This effect synchronizes the studentSessionStates with the global students list.
    setStudentSessionStates(prevStates => {
        const newStates: Record<string, StudentSessionState> = {};
        let statesChanged = false;

        students.forEach(student => {
            const existingState = prevStates[student.id];
            const studentGoals = student.goals || [];
            
            const existingGoalIds = existingState?.originalGoalHeaders.map(g => g.id).join(',');
            const currentGoalIds = studentGoals.map(g => g.id).join(',');

            if (!existingState || existingGoalIds !== currentGoalIds) {
                statesChanged = true;
                // A student's first state comes from the unsaved draft, if it has one.
                const drafted = existingState ? undefined : draftRef.current?.students[student.id];
                const updatedGoalData = existingState?.goalData || { ...(drafted?.goalData || {}) };
                
                studentGoals.forEach(goal => {
                    if (!updatedGoalData[goal.id]) {
                        updatedGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type] || {}));
                    }
                });

                newStates[student.id] = {
                    studentId: student.id,
                    studentName: student.name,
                    activity: existingState?.activity || drafted?.activity || '',
                    notes: existingState?.notes || drafted?.notes || '',
                    originalGoalHeaders: studentGoals, 
                    goalData: updatedGoalData,
                };
            } else {
                newStates[student.id] = existingState;
            }
        });

        if (statesChanged || Object.keys(prevStates).length !== students.length) {
            return newStates;
        }
        
        return prevStates;
    });
}, [students]);


  // Keep the draft up to date. Only students with unsaved entries are stored.
  useEffect(() => {
    const studentsWithEntries = Object.fromEntries(
      Object.values(studentSessionStates)
        .filter(state => hasUnsavedEntry(state, goalDefaults))
        .map(state => [state.studentId, { activity: state.activity, notes: state.notes, goalData: state.goalData }]),
    );
    saveDataEntryDraft(uid, {
      savedAt: new Date().toISOString(),
      sessionDate: sessionDate?.toISOString(),
      sessionTime,
      sessionEndTime,
      selectedStudentIds,
      focusedStudentSlotIndex,
      focusedGoalIndexByStudentId,
      isStudentAccessLocked,
      isHeaderCardCollapsed,
      // Until every student's state is built (first render), keep the draft's entries.
      students: Object.keys(studentSessionStates).length === 0 ? draftRef.current?.students ?? {} : studentsWithEntries,
    });
  }, [uid, studentSessionStates, sessionDate, sessionTime, sessionEndTime, selectedStudentIds, focusedStudentSlotIndex,
      focusedGoalIndexByStudentId, isStudentAccessLocked, isHeaderCardCollapsed, goalDefaults]);

  useEffect(() => {
    if (draftHadEntries && !openedSinceAppLoad) {
      toast({ title: 'Unsaved data restored', description: 'Your data entry from earlier is still here. Save it when you are ready.' });
    }
    openedSinceAppLoad = true;
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionTime === '') {
      const now = new Date();
      setSessionTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      now.setHours(now.getHours() + 1);
      setSessionEndTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [setSessionTime, setSessionEndTime, sessionTime]);

  useEffect(() => {
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
  }, [students, studentFromContext, selectedStudentIds.length, setSelectedStudentIds, setFocusedStudentSlotIndex, activeStudents]);
  

  const handleStudentSelect = useCallback((studentId: string, index: number) => {
    setSelectedStudentIds((prev: string[]) => {
      const newSelection = [...prev];
      newSelection[index] = studentId;
      return newSelection;
    });
    setFocusedStudentSlotIndex(index);
  }, [setSelectedStudentIds, setFocusedStudentSlotIndex]);
  
  const resetSessionStateForStudent = useCallback((studentId: string) => {
    setStudentSessionStates(prevStates => {
        const newStates = { ...prevStates };
        const student = students.find(s => s.id === studentId);
        if (student) {
            const initialGoalData: Record<string, SessionGoalData['data']> = {};
            student.goals.forEach(goal => {
                initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type] || {}));
            });
            newStates[studentId] = {
                studentId: student.id,
                studentName: student.name,
                activity: '',
                notes: '',
                originalGoalHeaders: student.goals,
                goalData: initialGoalData,
            };
        }
        return newStates;
    });
  }, [setStudentSessionStates, students]);


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
            // Stops a running behavior timer and stores totals.
            data: finalizeBehaviorData(goal.type, state.goalData[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type as GoalType]))),
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
        const sessionGoals = state.originalGoalHeaders.filter((g: any) => !g.isArchived).map((g: any) => ({ goalId: g.id, goalName: g.name, goalType: g.type, data: finalizeBehaviorData(g.type, state.goalData[g.id] || {}) }));
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
  
  const handleGoalDataChange = useCallback((studentId: string, goalId: string, updatedFieldName: string, newData: any) => {
    setStudentSessionStates(prevStates => {
        const studentState = prevStates[studentId];
        if (!studentState) return prevStates;
        const goal = studentState.originalGoalHeaders.find((g: any) => g.id === goalId);
        if (!goal) return prevStates;
        let processedData = { ...newData };
        return { ...prevStates, [studentId]: { ...studentState, goalData: { ...studentState.goalData, [goalId]: processedData } } };
    });
  }, []);

  const getActivitySuggestions = async (studentId: string) => {
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

        const result = await getAiActivitySuggestions({
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
  }, [showArchivedByStudentId, setStudentSessionStates]);

  const addStudentSlot = useCallback(() => {
    const availableStudent = activeStudents.find(s => !selectedStudentIds.includes(s.id));
    if (availableStudent) {
      const newIndex = selectedStudentIds.length;
      setSelectedStudentIds(prevIds => [...prevIds, availableStudent.id]);
      setFocusedStudentSlotIndex(newIndex);
    } else {
      toast({ title: "Info", description: "No more unique available students to add.", variant: "default" });
    }
  }, [activeStudents, selectedStudentIds, toast, setSelectedStudentIds, setFocusedStudentSlotIndex]);

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
    return activeStudents.filter(s => !selectedStudentIds.includes(s.id));
  }, [activeStudents, selectedStudentIds]);

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

  const localHandleGoalDataChange = useCallback((studentId: string, goalId: string, field: string, value: any) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Unlock to make changes.', variant: 'default' });
      return;
    }
    handleGoalDataChange(studentId, goalId, field, value);
  }, [isStudentAccessLocked, handleGoalDataChange, toast]);


  // Data Entry Hotkeys
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !(event.ctrlKey && event.key === 'Enter')) {
      return; // Ignore hotkeys when typing in inputs, except for Ctrl+Enter
    }

    const key = event.key.toUpperCase();
    const alt = event.altKey;
    const ctrl = event.ctrlKey;

    if (ctrl && key === 'ENTER') {
      event.preventDefault();
      handleSave();
      return;
    }

    if (alt) {
      event.preventDefault();
      switch(key) {
        case 'A': // Cycle students back
          setFocusedStudentSlotIndex(p => (p - 1 + selectedStudentIds.length) % selectedStudentIds.length);
          break;
        case 'S': { // Cycle goals back
          const studentId = selectedStudentIds[focusedStudentSlotIndex];
          if (studentId) {
            const state = studentSessionStates[studentId];
            if (state) {
              const visibleGoals = state.originalGoalHeaders.filter(g => !g.isArchived || showArchivedByStudentId[studentId]);
              if (visibleGoals.length > 0) {
                setFocusedGoalIndexByStudentId(p => ({ ...p, [studentId]: ( (p[studentId] || 0) - 1 + visibleGoals.length) % visibleGoals.length }));
              }
            }
          }
          break;
        }
        case 'W': addStudentSlot(); break;
        case 'Q': removeStudentSlot(focusedStudentSlotIndex); break;
        case 'U': setSelectionModalType('student'); break;
        case 'T': setSelectionModalType('goal'); break;
        case 'E': {
          const focusedStudent = activeStudentsInSlots[focusedStudentSlotIndex];
          if(focusedStudent) openEditStudentModal(focusedStudent);
          break;
        }
        case 'L': setIsStudentAccessLocked(p => !p); break;
      }
    } else {
      if (!alt && !ctrl && /^[1-4]$/.test(key)) {
        const slotIndex = parseInt(key) - 1;
        if (slotIndex < selectedStudentIds.length) {
          setFocusedStudentSlotIndex(slotIndex);
        }
      } else if (key === 'A') { // Cycle students forward
        setFocusedStudentSlotIndex(p => (p + 1) % selectedStudentIds.length);
      } else if (key === 'S') { // Cycle goals forward
        const studentId = selectedStudentIds[focusedStudentSlotIndex];
        if (studentId) {
          const state = studentSessionStates[studentId];
          if (state) {
            const visibleGoals = state.originalGoalHeaders.filter(g => !g.isArchived || showArchivedByStudentId[studentId]);
            if (visibleGoals.length > 0) {
              setFocusedGoalIndexByStudentId(p => ({ ...p, [studentId]: ((p[studentId] || 0) + 1) % visibleGoals.length }));
            }
          }
        }
      } else {
        // Handle goal data hotkeys
        const studentId = selectedStudentIds[focusedStudentSlotIndex];
        if (studentId) {
            const state = studentSessionStates[studentId];
            const visibleGoals = state?.originalGoalHeaders.filter(g => !g.isArchived || showArchivedByStudentId[studentId]);
            const focusedGoalIndex = focusedGoalIndexByStudentId[studentId] ?? 0;
            const focusedGoal = visibleGoals?.[focusedGoalIndex];
            
            if (focusedGoal) {
                const goalData = state.goalData[focusedGoal.id];
                const increment = (field: string) => localHandleGoalDataChange(studentId, focusedGoal.id, field, (Number(goalData[field]) || 0) + 1);

                if (key === 'C') {
                    if (['ARTICULATION', 'AAC'].includes(focusedGoal.type)) increment('correct');
                    else if (['LANGUAGE_COMPREHENSION'].includes(focusedGoal.type)) increment('questionsCorrect');
                    else if (['LANGUAGE_EXPRESSION'].includes(focusedGoal.type)) increment('successfulResponses');
                    else if (['PHONOLOGICAL_PROCESSES'].includes(focusedGoal.type)) increment('correctProductions');
                    else if (['SEQUENCED_TRIALS'].includes(focusedGoal.type)) increment('successfulAttempts');
                    else if (['FEEDING_SWALLOWING'].includes(focusedGoal.type)) increment('trialsAccepted');
                } else if (key === 'N') {
                    if (['ARTICULATION', 'AAC'].includes(focusedGoal.type)) increment('incorrect');
                    else if (['LANGUAGE_COMPREHENSION'].includes(focusedGoal.type)) increment('questionsIncorrect');
                    else if (['LANGUAGE_EXPRESSION'].includes(focusedGoal.type)) increment('unsuccessfulResponses');
                    else if (['PHONOLOGICAL_PROCESSES'].includes(focusedGoal.type)) increment('incorrectProductions');
                    else if (['SEQUENCED_TRIALS'].includes(focusedGoal.type)) increment('failedAttempts');
                    else if (['FEEDING_SWALLOWING'].includes(focusedGoal.type)) increment('trialsRefused');
                } else if (key === 'B') { // Approximate
                    if (['ARTICULATION', 'AAC', 'LANGUAGE_COMPREHENSION', 'LANGUAGE_EXPRESSION', 'PHONOLOGICAL_PROCESSES', 'SEQUENCED_TRIALS'].includes(focusedGoal.type)) {
                        increment('approximate');
                    } else if (focusedGoal.type === 'FLUENCY_SYLLABLE_STUTTER') {
                        increment('blocks');
                    }
                } else if (key === 'R' && focusedGoal.type === 'FLUENCY_SYLLABLE_STUTTER') increment('repetitions');
                else if (key === 'H' && focusedGoal.type === 'FLUENCY_SYLLABLE_STUTTER') increment('prolongations');
                else if (key === 'J' && focusedGoal.type === 'FLUENCY_SYLLABLE_STUTTER') increment('interjections');


                // Prompt hotkeys
                const promptType = PROMPT_HOTKEY_MAP[key as keyof typeof PROMPT_HOTKEY_MAP];
                if(promptType && !GOAL_TYPES_WITHOUT_PROMPT_COUNTERS.includes(focusedGoal.type)) {
                    increment(promptType);
                    if (promptType === 'Independent') {
                        if (['ARTICULATION', 'AAC'].includes(focusedGoal.type)) increment('correct');
                        else if (['LANGUAGE_COMPREHENSION'].includes(focusedGoal.type)) increment('questionsCorrect');
                        else if (['LANGUAGE_EXPRESSION'].includes(focusedGoal.type)) increment('successfulResponses');
                        else if (['PHONOLOGICAL_PROCESSES'].includes(focusedGoal.type)) increment('correctProductions');
                    }
                }
            }
        }
      }
    }
  }, [
    selectedStudentIds, 
    focusedStudentSlotIndex, 
    studentSessionStates, 
    showArchivedByStudentId, 
    focusedGoalIndexByStudentId,
    setFocusedStudentSlotIndex, 
    setFocusedGoalIndexByStudentId, 
    addStudentSlot, 
    removeStudentSlot, 
    openEditStudentModal, 
    activeStudentsInSlots, 
    setIsStudentAccessLocked,
    handleSave,
    localHandleGoalDataChange,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);


  return (
    <ConfettiProvider>
      <div className="flex flex-col h-full">
        <GoalFocusManager
          focusedStudentSlotIndex={focusedStudentSlotIndex}
          studentId={selectedStudentIds[focusedStudentSlotIndex]}
          focusedGoalIndex={focusedGoalIndexByStudentId[selectedStudentIds[focusedStudentSlotIndex]]}
          studentState={studentSessionStates[selectedStudentIds[focusedStudentSlotIndex]]}
          showArchived={showArchivedByStudentId[selectedStudentIds[focusedStudentSlotIndex]]}
        />
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
                  setDataEntryFocusedGoalIndexByStudentId={setFocusedGoalIndexByStudentId}
                  dataEntryAiActivitySuggestions={aiActivitySuggestions}
                  isAiLoading={isAiLoading}
                  setDataEntryFocusedStudentSlotIndex={setFocusedStudentSlotIndex}
                  openEditStudentModal={openEditStudentModal}
                  handleStudentSelect={handleStudentSelect}
                  removeStudentSlot={removeStudentSlot}
                  handleInputChange={handleInputChange}
                  handleGoalDataChange={localHandleGoalDataChange}
                  handleMoveGoal={handleMoveGoal}
                  handleLocalAiFetch={getActivitySuggestions}
                  addStudentSlot={addStudentSlot}
                  isStudentAccessLocked={isStudentAccessLocked}
              />
            </Suspense>
          </ScrollArea>
        </div>
        
        {selectedStudentIds.length > 0 && (
            <div className="sticky bottom-0 left-0 right-0 z-10 bg-background mt-auto">
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

    