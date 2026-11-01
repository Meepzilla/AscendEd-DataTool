
'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import { useAuth } from '@/hooks/use-auth';
import { loadDataEntryDraft, saveDataEntryDraft, hasUnsavedEntry, type DataEntryDraft } from '@/lib/data-entry-draft';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Info, PlusCircle } from 'lucide-react';
import type { Student, StudentSessionState } from '@/lib/types';
import { MISSED_REASON_SHORT, type MissedReason } from '@/lib/attendance';
import { taskSteps } from '@/lib/task-analysis';
import type { StudentGroup } from '@/lib/student-groups';
import LoadGroupMenu from '@/components/student-groups/LoadGroupMenu';
import { formatDate } from '@/lib/helpers';
import { ConfettiProvider } from '@/hooks/use-confetti';
import { ScrollArea } from '../ui/scroll-area';
import { GOAL_TYPE_FIELDS, captureTypeOf } from '@/lib/goal-constants';
import { applyGoalHotkey } from '@/lib/data-entry-hotkeys';
import { freshGoalData, freshStudentState, moveGoal, sessionFromState, syncSessionStates } from '@/lib/data-entry-session';
import { useSessionTimes } from '@/hooks/use-session-times';
import { useDataEntryLayout } from '@/hooks/use-data-entry-layout';
import { useDataEntryShortcuts } from '@/hooks/use-data-entry-shortcuts';
import GoalFocusManager from './GoalFocusManager';
import AccessLockDialog, { type AccessLockDialogMode } from './AccessLockDialog';
import DataEntrySaveBar from './DataEntrySaveBar';
import { clearAccessPin, hasAccessPin } from '@/lib/access-pin';
import { getStudentGroups } from '@/lib/student-groups';
import { useRouter, useSearchParams } from 'next/navigation';

// The Data Entry page: the session's date and times, a card per student to record data on, and the save bar.
// Parts live in their own files: the session times (use-session-times), the layout (use-data-entry-layout),
// keyboard shortcuts (use-data-entry-shortcuts), the save bar (DataEntrySaveBar) and the per-student state
// (lib/data-entry-session). This file holds the state and the actions.

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

  const activeStudents = useMemo(() => students.filter(s => !s.isArchived), [students]);

  // Whether any student on screen has something entered that isn't saved.
  const anyUnsaved = selectedStudentIds.some(id => hasUnsavedEntry(studentSessionStates[id], goalDefaults));
  const statesBuilt = Object.keys(studentSessionStates).length > 0;
  const {
    sessionDate, sessionTime, sessionEndTime, chooseSessionDate, chooseSessionTime, chooseSessionEndTime, resetSessionToNow,
  } = useSessionTimes({
    initial: draftHadEntries ? { date: draft?.sessionDate, time: draft?.sessionTime, endTime: draft?.sessionEndTime } : undefined,
    anyUnsaved,
    statesBuilt,
  });
  // Each student's card state follows the students and their goals (see syncSessionStates).
  useEffect(() => {
    setStudentSessionStates(prev => syncSessionStates(prev, students, draftRef.current?.students));
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


  // The student whose profile opened this page fills the first slot, once. It isn't repeated after a slot is removed,
  // or the last student removed would come straight back.
  const startingStudentHandled = useRef(false);
  useEffect(() => {
    if (startingStudentHandled.current) return;
    if (selectedStudentIds.length === 0 && activeStudents.length > 0) {
      let initialIdToSelect: string | undefined = undefined;
      if (studentFromContext && activeStudents.find(s => s.id === studentFromContext.id)) {
        initialIdToSelect = studentFromContext.id;
      }
      if (initialIdToSelect) {
        startingStudentHandled.current = true;
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
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    setStudentSessionStates(prevStates => ({ ...prevStates, [studentId]: freshStudentState(student) }));
  }, [students]);


  // A date that can't be used (e.g. from a damaged draft) counts as no date, so saving asks for one.
  const validSessionDate = sessionDate && !Number.isNaN(sessionDate.getTime()) ? sessionDate : undefined;

  const handleSave = async () => {
    if (!validSessionDate) {
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
    // The buttons are released whatever happens, so a failed save can't leave them disabled.
    try {
      const session = sessionFromState(state, { date: validSessionDate, time: sessionTime, endTime: sessionEndTime });
      if (session.goals.length === 0) {
        toast({ title: "Info", description: `Cannot save for ${state.studentName}, no active goals with data.`, variant: "default" });
        return;
      }
      const savedSession = await addSession(session);
      if (savedSession) {
        toast({ title: "Success", description: `Session for ${state.studentName} saved.` });
        resetSessionStateForStudent(focusedStudentId);
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  const handleSaveAll = async () => {
    if (!validSessionDate) {
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
    try {
      let savedCount = 0, errorCount = 0, simulatedCount = 0;
      for (const studentId of selectedStudentIds) {
          const state = studentSessionStates[studentId];
          // Students with nothing entered get no (empty) session.
          if (!state || !hasUnsavedEntry(state, goalDefaults)) continue;
          if (isStudentAccessLocked) {
              simulatedCount++;
              continue;
          }
          const session = sessionFromState(state, { date: validSessionDate, time: sessionTime, endTime: sessionEndTime });
          if (session.goals.length === 0) continue;
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
    } finally {
      savingRef.current = false;
      setIsSavingAll(false);
    }
  }

  // A student card's Missed button: saves a session with the reason and no goal data (attendance.ts), on the
  // session date and times. What was entered on the card is kept.
  const recordMissedSession = async (studentId: string, reason: MissedReason, note: string): Promise<boolean> => {
    const student = students.find(s => s.id === studentId);
    if (!student || !validSessionDate) return false;
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to record a missed session.' });
      return false;
    }
    const saved = await addSession({
      studentId, studentName: student.name, date: validSessionDate.toISOString(), time: sessionTime, endTime: sessionEndTime,
      activity: '', notes: note, goals: [], originalGoalHeaders: student.goals, missed: { reason, ...(note ? { note } : {}) },
    });
    if (saved) toast({ title: 'Missed session recorded', description: `${student.name}: ${MISSED_REASON_SHORT[reason]}, ${formatDate(validSessionDate)}.` });
    return !!saved;
  };

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
        const processedData = { ...newData, recorded: true };
        return { ...prevStates, [studentId]: { ...studentState, goalData: { ...studentState.goalData, [goalId]: processedData } } };
    });
  }, []);

  const handleMoveGoal = useCallback((studentId: string, goalId: string, direction: 'up' | 'down') => {
    setStudentSessionStates(prevStates => {
        const studentState = prevStates[studentId];
        if (!studentState) return prevStates;
        const goals = moveGoal(studentState.originalGoalHeaders, goalId, direction);
        if (!goals) return prevStates;
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
    startingStudentHandled.current = true;
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

  // Load Group: the group's (active) students fill the slots, in the group's order. A student already in a slot
  // with unsaved entries keeps their slot (after the group), so nothing entered is lost.
  const loadGroup = useCallback((group: StudentGroup) => {
    if (isStudentAccessLocked) {
      toast({ title: 'Access Locked', description: 'Student access is locked. Unlock to make changes.' });
      return;
    }
    const ids = group.studentIds.filter(id => activeStudents.some(s => s.id === id));
    if (ids.length === 0) {
      toast({ title: 'Nothing to load', description: `${group.name} has no active students.` });
      return;
    }
    const kept = selectedStudentIds.filter(id => !ids.includes(id) && hasUnsavedEntry(studentSessionStates[id], goalDefaults));
    setSelectedStudentIds([...ids, ...kept]);
    setFocusedStudentSlotIndex(0);
    toast({
      title: `Loaded ${group.name}`,
      description: `${ids.length} student${ids.length === 1 ? '' : 's'}${kept.length ? `; kept ${kept.length} with unsaved entries` : ''}.`,
    });
  }, [isStudentAccessLocked, activeStudents, selectedStudentIds, studentSessionStates, goalDefaults, setSelectedStudentIds, setFocusedStudentSlotIndex, toast]);

  // The dashboard's group buttons open Data Entry as /data-entry?group=<id>: that group is loaded once, when the
  // students are there to load.
  // The link is then taken out of the address, so reopening or reloading the page doesn't load the group again
  // over the students chosen since.
  const groupFromLink = useSearchParams().get('group');
  const router = useRouter();
  const groupLinkHandled = useRef(false);
  useEffect(() => {
    if (!groupFromLink || groupLinkHandled.current || activeStudents.length === 0) return;
    groupLinkHandled.current = true;
    const group = getStudentGroups(uid).find(g => g.id === groupFromLink);
    if (group) loadGroup(group);
    else toast({ title: 'Group not found', description: 'That group has been deleted. Choose one with Load Group.' });
    router.replace('/data-entry', { scroll: false });
  }, [groupFromLink, activeStudents.length, uid, loadGroup, toast, router]);

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
      const current = studentState.goalData[goalId] || freshGoalData(goal);
      const next = applyGoalHotkey(type, key, current, taskSteps(goal));
      if (!next) return prevStates;
      return { ...prevStates, [studentId]: { ...studentState, goalData: { ...studentState.goalData, [goalId]: { ...next, recorded: true } } } };
    });
  }, [isStudentAccessLocked, toast]);

  useDataEntryShortcuts({
    selectedStudentIds, focusedStudentSlotIndex, studentSessionStates, showArchivedByStudentId, focusedGoalIndexByStudentId,
    activeStudentsInSlots, isStudentAccessLocked, setFocusedStudentSlotIndex, setFocusedGoalIndexByStudentId,
    setSelectionModalType, addStudentSlot, removeStudentSlot, openEditStudent: openEditStudentModalUnlocked,
    requestAccessLock, save: handleSave, applyHotkeyToGoal,
  });

  const { rootRef, headerRef, cardsRegionRef, saveBarRef, viewportProbeRef, cardScroll, scrollCards } = useDataEntryLayout(selectedStudentIds.length);

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
                  setDataEntryFocusedStudentSlotIndex={setFocusedStudentSlotIndex}
                  openEditStudentModal={openEditStudentModalUnlocked}
                  handleStudentSelect={handleStudentSelect}
                  removeStudentSlot={removeStudentSlot}
                  handleInputChange={handleInputChange}
                  handleGoalDataChange={localHandleGoalDataChange}
                  handleMoveGoal={handleMoveGoal}
                  recordMissedSession={recordMissedSession}
                  addStudentSlot={addStudentSlot}
                  isStudentAccessLocked={isStudentAccessLocked}
              />
            </Suspense>
          </ScrollArea>
        </div>
        
        {selectedStudentIds.length > 0 && (
          <DataEntrySaveBar
            barRef={saveBarRef}
            touchControls={{
              activeStudentsInSlots, studentSessionStates, focusedStudentSlotIndex, setFocusedStudentSlotIndex,
              focusedGoalIndexByStudentId, setFocusedGoalIndexByStudentId, showArchivedByStudentId,
              selectionModalType, setSelectionModalType,
            }}
            onLoadGroup={loadGroup}
            isStudentAccessLocked={isStudentAccessLocked}
            cardScroll={cardScroll}
            onScrollCards={scrollCards}
            canAddStudent={selectedStudentIds.length < activeStudents.length}
            onAddStudent={addStudentSlot}
            onReset={handleOpenResetConfirmation}
            onSave={handleSave}
            onSaveAll={handleSaveAll}
            isSaving={isSaving}
            isSavingAll={isSavingAll}
          />
        )}
        {selectedStudentIds.length === 0 && (
            <Card className="mt-6 flex-shrink-0">
              <CardContent className="p-8 text-center text-muted-foreground">
                  <Info className="h-10 w-10 mx-auto mb-3 text-primary"/>
                  <p className="text-lg mb-4">No students selected for data entry.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" onClick={addStudentSlot}>
                      <PlusCircle className="mr-2 h-5 w-5" />
                      Add Student Slot
                    </Button>
                    <LoadGroupMenu onLoad={loadGroup} disabled={isStudentAccessLocked} />
                  </div>
                  {students.length === 0 && <p className="mt-4 text-sm">You don&apos;t have any students yet. Go to Students or press (Alt+M) to add one.</p>}
              </CardContent>
            </Card>
          )}
      </div>
    </ConfettiProvider>
  );
}

    