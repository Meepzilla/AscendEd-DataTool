
'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { useAuth } from '@/hooks/use-auth';
import { defaultSessionTimes } from '@/lib/session-time';
import { loadDataEntryDraft, saveDataEntryDraft, hasUnsavedEntry, type DataEntryDraft } from '@/lib/data-entry-draft';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Info, PlusCircle } from 'lucide-react';
import type { Goal, Student, StudentSessionState, SessionGoalData, GoalType } from '@/lib/types';
import TouchControls from '@/components/forms/touch-controls';
import { ConfettiProvider } from '@/hooks/use-confetti';
import { ScrollArea } from '../ui/scroll-area';
import { GOAL_TYPE_FIELDS, GOAL_TYPES, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS, captureTypeOf, finalizeBehaviorData } from '@/lib/goal-constants';
import { applyGoalHotkey, hotkeyChar, hotkeysBlocked } from '@/lib/data-entry-hotkeys';
import GoalFocusManager from './GoalFocusManager';
import AccessLockDialog, { type AccessLockDialogMode } from './AccessLockDialog';
import { clearAccessPin, hasAccessPin } from '@/lib/access-pin';
import { getActivitySuggestions as getAiActivitySuggestions } from '@/ai/flows/activity-suggestions';


const ConfirmationModal = lazy(() => import('@/components/modals/confirmation-modal'));
const StudentCardsList = lazy(() => import('@/components/data-entry/StudentCardsList'));
const DataEntryHeaderCard = lazy(() => import('@/components/data-entry/DataEntryHeaderCard'));
const SelectionModal = lazy(() => import('@/components/modals/selection-modal'));

// Whether Data Entry has been open since the app loaded. Switching pages keeps the module, so the
// "restored" notice shows only when the app reopens with unsaved data, not every time the page is revisited.
let openedSinceAppLoad = false;

// Student cards fill the screen height below the header card, down to the save bar.
const MIN_STUDENT_CARD_HEIGHT = 420;
const CARD_TO_SAVE_BAR = 32; // the cards list's bottom padding plus room for its horizontal scrollbar

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
      if (goal) return GOAL_TYPE_FIELDS[captureTypeOf(goal)];
    }
    return undefined;
  }, [students]);
  // The draft's date and times are kept only when something was entered; otherwise the session starts now.
  const [draftHadEntries] = useState(() => !!draft && draft.selectedStudentIds.some(id => hasUnsavedEntry(draft.students[id], goalDefaults)));
  
  const [sessionDate, setSessionDate] = useState<Date | undefined>(() =>
    draftHadEntries && draft?.sessionDate ? new Date(draft.sessionDate) : new Date());
  const [sessionTime, setSessionTime] = useState<string>(() => (draftHadEntries && draft?.sessionTime) || '');
  const [sessionEndTime, setSessionEndTime] = useState<string>(() => (draftHadEntries && draft?.sessionEndTime) || '');
  
  const [focusedGoalIndexByStudentId, setFocusedGoalIndexByStudentId] = useState<Record<string, number>>(() => draft?.focusedGoalIndexByStudentId ?? {});
  const [visibleGoalCountByStudentId, setVisibleGoalCountByStudentId] = useState<Record<string, number>>({});
  const [showArchivedByStudentId, setShowArchivedByStudentId] = useState<Record<string, boolean>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  // Set at once (state updates later), so a second save started meanwhile is ignored.
  const savingRef = useRef(false);
  const [isHeaderCardCollapsed, setIsHeaderCardCollapsed] = useState(() => draft?.isHeaderCardCollapsed ?? false);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [selectionModalType, setSelectionModalType] = useState<'student' | 'goal' | null>(null);
  const [isStudentAccessLocked, setIsStudentAccessLocked] = useState(() => draft?.isStudentAccessLocked ?? false);
  // Turning the lock off takes the teacher's PIN; the first time it's turned on, the PIN is chosen.
  const [accessLockDialog, setAccessLockDialog] = useState<AccessLockDialogMode>(null);
  const requestAccessLock = useCallback((locked: boolean) => {
    if (!locked) setAccessLockDialog('unlock');
    else if (hasAccessPin(uid)) setIsStudentAccessLocked(true);
    else setAccessLockDialog('set');
  }, [uid]);
  
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
            
            // Rebuilt when goals are added or removed, and when a goal is edited mid-session (its name, type,
            // data capture type, target or archived state), so the cards and the save use the current goal.
            const goalSignature = (goals: Goal[]) => JSON.stringify(goals.map(g => [g.id, g.name, g.type, g.dataCaptureType, g.isArchived, g.sessionTargetValue, g.targetDirection]));

            if (!existingState || goalSignature(existingState.originalGoalHeaders) !== goalSignature(studentGoals)) {
                statesChanged = true;
                // A student's first state comes from the unsaved draft, if it has one.
                const drafted = existingState ? undefined : draftRef.current?.students[student.id];
                const updatedGoalData = { ...(existingState?.goalData || drafted?.goalData || {}) };
                const previousGoals = new Map((existingState?.originalGoalHeaders || []).map(g => [g.id, g]));
                
                studentGoals.forEach(goal => {
                    const previous = previousGoals.get(goal.id);
                    // Data entered with another type's inputs doesn't fit the new ones, so that goal starts over.
                    const typeChanged = previous && captureTypeOf(previous) !== captureTypeOf(goal);
                    if (!updatedGoalData[goal.id] || typeChanged) {
                        updatedGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[captureTypeOf(goal)] || {}));
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
        .filter(state => selectedStudentIds.includes(state.studentId) && hasUnsavedEntry(state, goalDefaults))
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
      const { start, end } = defaultSessionTimes();
      setSessionTime(start);
      setSessionEndTime(end);
    }
  }, [setSessionTime, setSessionEndTime, sessionTime]);

  // The session's date and times follow "now" unless the teacher set them. The page can stay open all day
  // (or for days): when data entry starts for a new session (the first entry after everything was saved), the
  // date moves to today and the times to now; when the app comes back to the foreground on a later day with
  // nothing entered, the date moves to today. A past date or a time chosen in the pickers is kept: the date
  // until it is changed back (or Reset Time to Now), the times until that session is saved. Unsaved entries
  // restored from another day keep their date and times until they are saved.
  const sessionStatesRef = useRef(studentSessionStates);
  sessionStatesRef.current = studentSessionStates;
  const selectedIdsRef = useRef(selectedStudentIds);
  selectedIdsRef.current = selectedStudentIds;
  const pastDateChosenRef = useRef(false);
  const timeChosenRef = useRef(false);
  const chooseSessionDate = useCallback((date: Date | undefined) => {
    pastDateChosenRef.current = !!date && date.toDateString() !== new Date().toDateString();
    setSessionDate(date);
  }, []);
  const chooseSessionTime = useCallback((time: string) => { timeChosenRef.current = true; setSessionTime(time); }, []);
  const chooseSessionEndTime = useCallback((time: string) => { timeChosenRef.current = true; setSessionEndTime(time); }, []);
  const resetSessionToNow = useCallback(() => {
    pastDateChosenRef.current = false;
    timeChosenRef.current = false;
    const now = new Date();
    const { start, end } = defaultSessionTimes(now);
    setSessionDate(now);
    setSessionTime(start);
    setSessionEndTime(end);
  }, []);
  // Whether any student on screen has something entered that isn't saved.
  const anyUnsaved = selectedStudentIds.some(id => hasUnsavedEntry(studentSessionStates[id], goalDefaults));
  const statesBuilt = Object.keys(studentSessionStates).length > 0;
  const prevUnsavedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!statesBuilt) return;
    const previous = prevUnsavedRef.current;
    prevUnsavedRef.current = anyUnsaved;
    // The first look (restored entries included) only records the state.
    if (previous === null || previous === anyUnsaved) return;
    if (!anyUnsaved) {
      // Everything saved (or reset): the times chosen were for that session.
      timeChosenRef.current = false;
      return;
    }
    // A new session's first entry.
    if (pastDateChosenRef.current) return;
    const now = new Date();
    setSessionDate(now);
    if (!timeChosenRef.current) {
      const { start, end } = defaultSessionTimes(now);
      setSessionTime(start);
      setSessionEndTime(end);
    }
  }, [anyUnsaved, statesBuilt]);
  useEffect(() => {
    const refreshDate = () => {
      if (document.visibilityState !== 'visible') return;
      const now = new Date();
      if (pastDateChosenRef.current || !sessionDate || sessionDate.toDateString() === now.toDateString()) return;
      // Until the students' states are built (first render), what's entered isn't known yet.
      const states = sessionStatesRef.current;
      if (Object.keys(states).length === 0 || selectedIdsRef.current.some(id => hasUnsavedEntry(states[id], goalDefaults))) return;
      const { start, end } = defaultSessionTimes(now);
      timeChosenRef.current = false;
      setSessionDate(now);
      setSessionTime(start);
      setSessionEndTime(end);
    };
    refreshDate();
    document.addEventListener('visibilitychange', refreshDate);
    window.addEventListener('focus', refreshDate);
    return () => {
      document.removeEventListener('visibilitychange', refreshDate);
      window.removeEventListener('focus', refreshDate);
    };
  }, [sessionDate, goalDefaults]);

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
  

  const applyStudentSelect = useCallback((studentId: string, index: number) => {
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
                initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[captureTypeOf(goal)] || {}));
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
    // Nothing entered: saving would only add an empty session (e.g. Save tapped twice, or Ctrl+Enter held).
    if (!hasUnsavedEntry(state, goalDefaults)) {
        toast({ title: "Nothing to save", description: `Nothing has been entered for ${state.studentName} yet.` });
        return;
    }
    if (savingRef.current) return;
    savingRef.current = true;

    setIsSaving(true);
    const sessionGoals: SessionGoalData[] = state.originalGoalHeaders
        .filter((goal: any) => !goal.isArchived)
        .map((goal: any) => ({
            goalId: goal.id,
            goalName: goal.name,
            goalType: goal.type,
            // Stops a running behavior timer and stores totals.
            data: finalizeBehaviorData(captureTypeOf(goal), state.goalData[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[captureTypeOf(goal)]))),
        }));

    if (sessionGoals.length === 0) {
        toast({ title: "Info", description: `Cannot save for ${state.studentName}, no active goals with data.`, variant: "default" });
        savingRef.current = false;
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
    savingRef.current = false;
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
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSavingAll(true);
    let savedCount = 0, errorCount = 0, simulatedCount = 0;
    for (const studentId of selectedStudentIds) {
        const state = studentSessionStates[studentId];
        // Students with nothing entered get no (empty) session.
        if (!state || !hasUnsavedEntry(state, goalDefaults)) continue;
        if (isStudentAccessLocked) {
            simulatedCount++;
            continue;
        }
        const sessionGoals = state.originalGoalHeaders.filter((g: any) => !g.isArchived).map((g: any) => ({ goalId: g.id, goalName: g.name, goalType: g.type, data: finalizeBehaviorData(captureTypeOf(g), state.goalData[g.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[captureTypeOf(g)] || {}))) }));
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
    if (savedCount + simulatedCount + errorCount === 0) toast({ title: "Nothing to save", description: "Nothing has been entered for these students yet." });
    savingRef.current = false;
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
        // Marks the goal as worked on this session, so reports count it even when its values equal the
        // starting ones (e.g. a rating left at 3).
        let processedData = { ...newData, recorded: true };
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
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.' });
      return;
    }
    const availableStudent = activeStudents.find(s => !selectedStudentIds.includes(s.id));
    if (availableStudent) {
      const newIndex = selectedStudentIds.length;
      setSelectedStudentIds(prevIds => [...prevIds, availableStudent.id]);
      setFocusedStudentSlotIndex(newIndex);
    } else {
      toast({ title: "Info", description: "No more unique available students to add.", variant: "default" });
    }
  }, [activeStudents, selectedStudentIds, toast, setSelectedStudentIds, setFocusedStudentSlotIndex, isStudentAccessLocked]);

  const applyRemoveStudentSlot = useCallback((indexToRemove: number) => {
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

  // Removing a slot or switching it to another student would hide the slot's unsaved entries (they'd stay in
  // the background and come back later), so that asks first and the entries are discarded if confirmed.
  const [pendingSlotChange, setPendingSlotChange] = useState<{ studentId: string; studentName: string; apply: () => void } | null>(null);
  const guardSlotChange = useCallback((index: number, apply: () => void) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.' });
      return;
    }
    const outgoingId = selectedStudentIds[index];
    const state = outgoingId ? studentSessionStates[outgoingId] : undefined;
    if (state && hasUnsavedEntry(state, goalDefaults)) {
      setPendingSlotChange({ studentId: outgoingId, studentName: state.studentName, apply });
      return;
    }
    apply();
  }, [isStudentAccessLocked, selectedStudentIds, studentSessionStates, goalDefaults, toast]);
  const handleStudentSelect = useCallback((studentId: string, index: number) => {
    if (selectedStudentIds[index] === studentId) return;
    guardSlotChange(index, () => applyStudentSelect(studentId, index));
  }, [guardSlotChange, applyStudentSelect, selectedStudentIds]);
  const removeStudentSlot = useCallback((indexToRemove: number) => {
    guardSlotChange(indexToRemove, () => applyRemoveStudentSlot(indexToRemove));
  }, [guardSlotChange, applyRemoveStudentSlot]);

  // Editing the student (name, goals) from Data Entry is also covered by the Student Access Lock.
  const openEditStudentModalUnlocked = useCallback((student: Student) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.' });
      return;
    }
    openEditStudentModal(student);
  }, [isStudentAccessLocked, openEditStudentModal, toast]);

  const availableStudentsForDropdown = useMemo(() => {
    return activeStudents.filter(s => !selectedStudentIds.includes(s.id));
  }, [activeStudents, selectedStudentIds]);

  const handleOpenResetConfirmation = () => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.' });
      return;
    }
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


  // Records a hotkey's data for a goal. Works from the latest state, so keys pressed in quick
  // succession all count.
  const applyHotkeyToGoal = useCallback((studentId: string, goalId: string, key: string) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Unlock to make changes.', variant: 'default' });
      return;
    }
    setStudentSessionStates(prevStates => {
      const studentState = prevStates[studentId];
      const goal = studentState?.originalGoalHeaders.find(g => g.id === goalId);
      if (!studentState || !goal || goal.isArchived) return prevStates;
      const type = captureTypeOf(goal);
      const current = studentState.goalData[goalId] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[type] || {}));
      const next = applyGoalHotkey(type, key, current);
      if (!next) return prevStates;
      return { ...prevStates, [studentId]: { ...studentState, goalData: { ...studentState.goalData, [goalId]: { ...next, recorded: true } } } };
    });
  }, [isStudentAccessLocked, toast]);

  // Data Entry Hotkeys (listed in Help → Hotkeys)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = hotkeyChar(event);
    const alt = event.altKey;
    // Ctrl+Enter saves (Cmd+Enter on Apple keyboards), even while typing in a field.
    if ((event.ctrlKey || event.metaKey) && key === 'ENTER') {
      event.preventDefault();
      if (!event.repeat) handleSave();
      return;
    }
    // Other Ctrl/Cmd combinations are the browser's (copy, paste...), and typing or an open dialog
    // takes the keys.
    if (event.ctrlKey || event.metaKey || hotkeysBlocked(event)) return;

    const studentId = selectedStudentIds[focusedStudentSlotIndex];
    const visibleGoals = (studentId && studentSessionStates[studentId]?.originalGoalHeaders
      .filter(g => !g.isArchived || showArchivedByStudentId[studentId])) || [];
    const cycleGoal = (step: number) => {
      if (!studentId || visibleGoals.length === 0) return;
      setFocusedGoalIndexByStudentId(p => ({ ...p, [studentId]: ((p[studentId] || 0) + step + visibleGoals.length) % visibleGoals.length }));
    };
    const slotCount = selectedStudentIds.length;

    if (alt) {
      let handled = true;
      switch (key) {
        case 'A': if (slotCount) setFocusedStudentSlotIndex(p => (p - 1 + slotCount) % slotCount); break; // previous student
        case 'S': cycleGoal(-1); break; // previous goal
        case 'W': addStudentSlot(); break;
        case 'Q': if (slotCount) removeStudentSlot(focusedStudentSlotIndex); break;
        case 'U': setSelectionModalType('student'); break;
        case 'T': setSelectionModalType('goal'); break;
        case 'E': {
          const focusedStudent = activeStudentsInSlots[focusedStudentSlotIndex];
          if (focusedStudent) openEditStudentModalUnlocked(focusedStudent);
          break;
        }
        case 'L': requestAccessLock(!isStudentAccessLocked); break;
        default: handled = false;
      }
      if (handled) event.preventDefault();
      return;
    }

    if (/^[1-4]$/.test(key)) {
      const slotIndex = Number(key) - 1;
      if (slotIndex < slotCount) setFocusedStudentSlotIndex(slotIndex);
      return;
    }
    if (key === 'A') { if (slotCount) setFocusedStudentSlotIndex(p => (p + 1) % slotCount); return; } // next student
    if (key === 'S') { cycleGoal(1); return; } // next goal

    // Data for the focused goal. Holding a key down doesn't repeat it.
    if (event.repeat || !studentId) return;
    const focusedGoal = visibleGoals[focusedGoalIndexByStudentId[studentId] ?? 0];
    if (!focusedGoal || !applyGoalHotkey(captureTypeOf(focusedGoal), key, {})) return;
    event.preventDefault();
    applyHotkeyToGoal(studentId, focusedGoal.id, key);
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
    openEditStudentModalUnlocked,
    activeStudentsInSlots,
    requestAccessLock,
    isStudentAccessLocked,
    handleSave,
    applyHotkeyToGoal,
  ]);

  // Size the student cards to the space left on screen. Collapsing the date and time card frees space, so
  // the cards grow; the header and save bar are observed so any change in their height is picked up.
  // The app sets CSS zoom on <body>, and browsers differ in how element rects account for it (iPad Safari
  // differs from Chrome), so every measurement is a rect of an element in the same zoomed context,
  // converted to CSS pixels with the save bar's rect-to-CSS-pixel ratio.
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRegionRef = useRef<HTMLDivElement>(null);
  const saveBarRef = useRef<HTMLDivElement>(null);
  const viewportProbeRef = useRef<HTMLDivElement>(null);
  const hasSelectedStudents = selectedStudentIds.length > 0;
  useEffect(() => {
    const update = () => {
      const root = rootRef.current;
      const region = cardsRegionRef.current;
      const probe = viewportProbeRef.current;
      if (!root || !region || !probe) return;
      const card = root.querySelector<HTMLElement>('[id^="student-card-slot-"]');
      const saveBar = saveBarRef.current;
      if (!card || !saveBar || saveBar.offsetHeight === 0) return;
      // Rect units per CSS pixel, from an element whose size isn't animating (the card animates height changes).
      const saveBarRect = saveBar.getBoundingClientRect();
      const ratio = saveBarRect.height / saveBar.offsetHeight || 1;
      // Where the save bar ends with the page scrolled to the top: the card's top, its height, its padding and
      // the bar itself. (The bar's own position isn't used: it is sticky, which can hide an overflow.)
      const cardTop = (card.getBoundingClientRect().top - document.body.getBoundingClientRect().top) / ratio;
      const screenBottom = probe.getBoundingClientRect().height / ratio;
      const available = screenBottom - cardTop - CARD_TO_SAVE_BAR - saveBar.offsetHeight;
      root.style.setProperty('--student-card-height', `${Math.max(MIN_STUDENT_CARD_HEIGHT, Math.floor(available))}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    // The region changes size when cards appear, and the full-height probe when the screen size changes
    // (rotation, Safari's toolbars, the display size setting). The result doesn't depend on the card's
    // height, so this can't loop.
    [headerRef.current, saveBarRef.current, cardsRegionRef.current, viewportProbeRef.current].forEach(el => el && observer.observe(el));
    // Cards load after the page, so also update when they are added (at most once a frame).
    let frame = 0;
    const cardsObserver = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    if (cardsRegionRef.current) cardsObserver.observe(cardsRegionRef.current, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      cardsObserver.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [hasSelectedStudents]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);


  return (
    <ConfettiProvider>
      <div ref={rootRef} className="flex flex-col h-full">
        <div ref={viewportProbeRef} aria-hidden className="pointer-events-none invisible fixed inset-y-0 left-0 w-px" />
        <GoalFocusManager
          focusedStudentSlotIndex={focusedStudentSlotIndex}
          studentId={selectedStudentIds[focusedStudentSlotIndex]}
          focusedGoalIndex={focusedGoalIndexByStudentId[selectedStudentIds[focusedStudentSlotIndex]]}
          studentState={studentSessionStates[selectedStudentIds[focusedStudentSlotIndex]]}
          showArchived={showArchivedByStudentId[selectedStudentIds[focusedStudentSlotIndex]]}
        />
        <AccessLockDialog
          uid={uid}
          mode={accessLockDialog}
          onClose={() => setAccessLockDialog(null)}
          onDone={() => { setIsStudentAccessLocked(accessLockDialog === 'set'); setAccessLockDialog(null); }}
          onForgot={() => {
            Object.keys(studentSessionStates).forEach(resetSessionStateForStudent);
            clearAccessPin(uid);
            setIsStudentAccessLocked(false);
            setAccessLockDialog(null);
            toast({ title: 'Unlocked', description: 'Unsaved entries were discarded and the PIN was removed.' });
          }}
        />
        <Suspense fallback={null}>
          {pendingSlotChange && (
            <ConfirmationModal
              isOpen={!!pendingSlotChange}
              onClose={() => setPendingSlotChange(null)}
              onConfirm={() => {
                resetSessionStateForStudent(pendingSlotChange.studentId);
                pendingSlotChange.apply();
                setPendingSlotChange(null);
              }}
              title={`Discard ${pendingSlotChange.studentName}'s unsaved data?`}
              description={`${pendingSlotChange.studentName} has data entered that hasn't been saved. Save it first, or continue to discard it.`}
              confirmText="Discard and Continue"
            />
          )}
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
        
        <div ref={headerRef} className="flex-shrink-0">
          <Suspense fallback={<Card><CardContent>Loading header...</CardContent></Card>}>
            <DataEntryHeaderCard
              isHeaderCardCollapsed={isHeaderCardCollapsed}
              setIsHeaderCardCollapsed={setIsHeaderCardCollapsed}
              dataEntrySessionDate={sessionDate}
              setDataEntrySessionDate={chooseSessionDate}
              dataEntrySessionTime={sessionTime}
              setDataEntrySessionTime={chooseSessionTime}
              dataEntrySessionEndTime={sessionEndTime}
              setDataEntrySessionEndTime={chooseSessionEndTime}
              onResetToNow={resetSessionToNow}
              isStudentAccessLocked={isStudentAccessLocked}
              setIsStudentAccessLocked={requestAccessLock}
            />
          </Suspense>
        </div>

        <div ref={cardsRegionRef} className="flex-grow min-h-0 relative group">
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
                  openEditStudentModal={openEditStudentModalUnlocked}
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
            <div ref={saveBarRef} className="sticky bottom-0 left-0 right-0 z-10 bg-background mt-auto">
                {/* On wider screens, right padding keeps the buttons to the left of the host's corner badge (a phone
                    has no room for it, so the buttons use the full width and wrap). */}
                <div className="flex flex-wrap justify-between items-center gap-2 p-2 md:pr-[var(--host-badge-width)] border-t">
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

                    <div className="flex flex-wrap justify-end gap-2 ml-auto">
                        <Button variant="outline" onClick={handleOpenResetConfirmation} disabled={isSaving || isSavingAll} size="lg" aria-label="Reset Focused">
                        <RotateCcw className="mr-2 h-5 w-5" />
                        Reset<span className="hidden sm:inline">&nbsp;Focused</span>
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || isSavingAll} size="lg" aria-label="Save Focused">
                          <Save className="mr-2 h-5 w-5" />
                          {isSaving ? 'Saving...' : <>Save<span className="hidden sm:inline">&nbsp;Focused</span></>}
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

    