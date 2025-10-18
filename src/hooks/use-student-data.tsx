
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { useToast as useShadcnToast } from "@/hooks/use-toast";
import { useErrorLog } from './use-error-log';
import type { Student, Goal, GoalTemplate, SessionData, StudentSessionState } from '@/lib/types';
import { useStudentDataFirebase } from './use-student-data-firebase';
import { useStudentDataLocal } from './use-student-data-local';
import { useModalState } from './use-modal-state';
import { useDataEntryState } from './use-data-entry-state';
import { useDataEntryActions } from './use-data-entry-actions';
import { useKeyboardShortcutHandlers }from './use-keyboard-shortcuts-data';

// The full context type remains the same, providing a consistent API to the app
interface StudentDataContextType {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  loading: boolean;
  sessionsLoading: boolean;
  error: Error | null;
  isFirebaseDBAvailable: boolean;

  addStudent: (name: string) => Promise<Student | null>;
  updateStudent: (studentId: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  assignGoalToStudent: (studentId: string, goal: Goal) => Promise<void>;
  removeGoalFromStudent: (studentId: string, goalId: string) => Promise<void>;
  updateStudentGoal: (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => Promise<void>;

  addGoalTemplate: (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId' | 'isDefault'>) => Promise<GoalTemplate | null>;
  updateGoalTemplate: (templateId: string, data: Partial<GoalTemplate>) => Promise<void>;
  deleteGoalTemplate: (templateId: string) => Promise<void>;

  addSession: (sessionData: Omit<SessionData, 'sessionId'>) => Promise<SessionData | null>;
  updateSession: (sessionId: string, data: Partial<SessionData>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  getSessionsForStudent: (studentId: string) => SessionData[];
  importSessions: (sessionsToImport: Omit<SessionData, 'sessionId'>[]) => Promise<{ newCount: number; duplicateCount: number; }>;

  // Modal states from useModalState
  isAddStudentModalOpen: boolean;
  openAddStudentModal: () => void;
  closeAddStudentModal: () => void;
  editingStudent: Student | null;
  openEditStudentModal: (student: Student) => void;
  closeEditStudentModal: () => void;
  deletingStudent: { item: Student | GoalTemplate | SessionData | null, type: 'student' | 'goalTemplate' | 'session' } | null;
  openDeleteConfirmationModal: (item: Student | GoalTemplate | SessionData, type: 'student' | 'goalTemplate' | 'session') => void;
  closeDeleteConfirmationModal: () => void;
  deletingAssignedGoal: { studentId: string; goal: Goal } | null;
  openDeleteAssignedGoalConfirmationModal: (studentId: string, goal: Goal) => void;
  closeDeleteAssignedGoalConfirmationModal: () => void;
  isAddGoalTemplateModalOpen: boolean;
  openAddGoalTemplateModal: (initialPrompt?: string) => void;
  closeAddGoalTemplateModal: () => void;
  addGoalTemplateInitialPrompt: string | null;
  editingGoalTemplate: GoalTemplate | null;
  openEditGoalTemplateModal: (template: GoalTemplate) => void;
  closeEditGoalTemplateModal: () => void;
  editingSession: SessionData | null;
  openEditSessionModal: (session: SessionData) => void;
  closeEditSessionModal: () => void;
  deletingSession: SessionData | null;
  openDeleteSessionModal: (session: SessionData | null) => void; 
  closeDeleteSessionModal: () => void;
  editingAssignedGoal: { studentId: string; goal: Goal } | null;
  openEditAssignedGoalModal: (studentId: string, goal: Goal) => void;
  closeEditAssignedGoalModal: () => void;
  selectionModalType: 'student' | 'goal' | null;
  setSelectionModalType: (type: 'student' | 'goal' | null) => void;

  // Data Entry states and actions
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySessionEndTime: string;
  setDataEntrySessionEndTime: (time: string) => void;
  dataEntrySelectedStudentIds: string[];
  setDataEntrySelectedStudentIds: React.Dispatch<React.SetStateAction<string[]>>;
  dataEntryActiveStudentsInSlots: Student[];
  dataEntryStudentSessionStates: Record<string, StudentSessionState>;
  setDataEntryStudentSessionStates: React.Dispatch<React.SetStateAction<Record<string, StudentSessionState>>>;
  dataEntryFocusedStudentSlotIndex: number;
  setDataEntryFocusedStudentSlotIndex: (index: number) => void;
  dataEntryFocusedGoalIndexByStudentId: Record<string, number>;
  setDataEntryFocusedGoalIndexByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  dataEntryAiActivitySuggestions: Record<string, string[]>;
  setDataEntryAiActivitySuggestions: (suggestions: Record<string, string[]>) => void;
  dataEntryVisibleGoalCountByStudentId: Record<string, number>;
  setDataEntryVisibleGoalCountByStudentId: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  dataEntryShowArchivedByStudentId: Record<string, boolean>;
  setDataEntryShowArchivedByStudentId: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  
  // Data Entry Actions
  fetchAiActivitySuggestions: (studentId: string) => Promise<void>;
  saveDataEntrySession: () => Promise<void>;
  saveAllDataEntrySessions: () => Promise<void>;
  resetDataEntrySession: () => void;
  handleGoalDataChange: (studentId: string, goalId: string, updatedFieldName: string, newData: StudentSessionState['goalData'][string]) => void;
  handleMoveGoal: (studentId: string, goalId: string, direction: 'up' | 'down') => void;
  addStudentSlot: () => void;
  removeStudentSlot: (indexToRemove: number) => void;
  removeFocusedStudentSlot: () => void;
  isStudentAccessLocked: boolean;
  setIsStudentAccessLocked: (isLocked: boolean) => void;
  
  // Keyboard Shortcut Handlers
  focusStudentSlot: (slotIndex: number) => void;
  cycleFocusedStudent: (direction: 'next' | 'prev') => void;
  cycleFocusedGoal: (direction: 'next' | 'prev') => void;
  handleDataEntryHotkey: (key: string, alt: boolean) => void;
  triggerEditFocusedStudent: () => void;
  toggleStudentSelectionModal: () => void;
  toggleGoalSelectionModal: () => void;
  getCurrentFocusedGoalInfo: () => { studentId: string; studentState: StudentSessionState; goal: Goal; goalData: any; goalIndex: number; } | null;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export const StudentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isFirebaseAvailable: isFirebaseAuthAvailable, loading: authLoading } = useAuth();
  const { toast } = useShadcnToast();
  const { addErrorLog } = useErrorLog();
  
  const isFirebaseDBAvailable = isFirebaseAuthAvailable;

  const [students, setStudents] = useState<Student[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // --- COMPOSITION OF REFACTORED HOOKS ---
  const dataEntryState = useDataEntryState(currentUser?.uid);
  const modalState = useModalState();

  const firebaseActions = useStudentDataFirebase({ currentUser, setStudents, setGoalTemplates, setSessions, setLoading, setSessionsLoading, setError, toast, addErrorLog });
  const localActions = useStudentDataLocal({ currentUser, students, setStudents, goalTemplates, setGoalTemplates, sessions, setSessions, toast });
  
  const dataActions = useMemo(() => isFirebaseDBAvailable ? firebaseActions : localActions, [isFirebaseDBAvailable, firebaseActions, localActions]);
  
  const activeStudentsInSlots = useMemo(() => {
    return dataEntryState.dataEntrySelectedStudentIds
      .map(id => students.find(s => s.id === id && !s.isArchived))
      .filter((s): s is Student => !!s);
  }, [dataEntryState.dataEntrySelectedStudentIds, students]);

  const removeStudentSlot = useCallback((indexToRemove: number) => {
    const { dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex } = dataEntryState;
    const currentFocusedId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    const newSelectedIds = dataEntrySelectedStudentIds.filter((_, i) => i !== indexToRemove);
    dataEntryState.setDataEntrySelectedStudentIds(newSelectedIds);

    if (newSelectedIds.length === 0) {
        dataEntryState.setDataEntryFocusedStudentSlotIndex(0);
    } else {
        let newFocusIndex = newSelectedIds.indexOf(currentFocusedId);
        if (newFocusIndex === -1) {
            newFocusIndex = Math.min(indexToRemove, newSelectedIds.length - 1);
            newFocusIndex = Math.max(0, newFocusIndex);
        }
        dataEntryState.setDataEntryFocusedStudentSlotIndex(newFocusIndex);
    }
  }, [dataEntryState]);

  const removeFocusedStudentSlot = useCallback(() => {
    const { dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex } = dataEntryState;
    if (dataEntrySelectedStudentIds.length > 0 && dataEntryFocusedStudentSlotIndex < dataEntrySelectedStudentIds.length) {
      removeStudentSlot(dataEntryFocusedStudentSlotIndex);
    }
  }, [dataEntryState, removeStudentSlot]);

  const dataEntryActions = useDataEntryActions({
    ...dataEntryState,
    students,
    activeStudentsInSlots,
    addSession: dataActions.addSession,
    getSessionsForStudent: dataActions.getSessionsForStudent,
    toast,
    addErrorLog,
    removeStudentSlot,
  });

  const keyboardShortcutHandlers = useKeyboardShortcutHandlers({
    ...dataEntryState,
    students,
    openEditStudentModal: modalState.openEditStudentModal,
    handleGoalDataChange: dataEntryActions.handleGoalDataChange,
    toggleStudentSelectionModal: modalState.toggleStudentSelectionModal,
    toggleGoalSelectionModal: modalState.toggleGoalSelectionModal,
  });
  
  // Main effect for loading initial data and setting up listeners
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      setSessionsLoading(true);
      return;
    }
    if (!currentUser) {
      setStudents([]);
      setGoalTemplates([]);
      setSessions([]);
      setSelectedStudent(null);
      setLoading(false);
      setSessionsLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setSessionsLoading(true);
    if (isFirebaseDBAvailable) {
      const unsubStudents = firebaseActions.listenToStudents();
      const unsubTemplates = firebaseActions.listenToGoalTemplates();
      const unsubSessions = firebaseActions.listenToSessions();
      
      // We are "loaded" after the first non-session data comes in
      Promise.all([new Promise(res => {const unsub = firebaseActions.listenToStudents(res)}), new Promise(res => {const unsub = firebaseActions.listenToGoalTemplates(res)})]).then(() => setLoading(false));

      return () => {
        unsubStudents();
        unsubTemplates();
        unsubSessions();
      };
    } else {
      localActions.loadAllLocalData();
      setLoading(false);
      setSessionsLoading(false);
    }
  }, [authLoading, currentUser, isFirebaseDBAvailable, firebaseActions, localActions]);
  
  const getSessionsForStudent = useCallback((studentId: string) => {
    return sessions.filter(s => s.studentId === studentId);
  }, [sessions]);


  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      toast({ title: "Error", description: "Student not found.", variant: "destructive" });
      return;
    }
    const updatedGoals = [...student.goals, goal];
    await dataActions.updateStudent(studentId, { goals: updatedGoals });
  }, [students, dataActions.updateStudent, toast]);
  
  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
      const student = students.find(s => s.id === studentId);
      if (!student) { return; }
      const updatedGoals = student.goals.filter(g => g.id !== goalId);
      await dataActions.updateStudent(studentId, { goals: updatedGoals });
  }, [students, dataActions.updateStudent]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, data: Partial<Goal>) => {
      const student = students.find(s => s.id === studentId);
      if (!student) { return; }
      const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...data } : g);
      await dataActions.updateStudent(studentId, { goals: updatedGoals });
  }, [students, dataActions.updateStudent]);


  const contextValue: StudentDataContextType = useMemo(() => ({
    students,
    goalTemplates,
    sessions,
    selectedStudent,
    setSelectedStudent,
    loading,
    sessionsLoading,
    error,
    isFirebaseDBAvailable,

    // Data Actions
    ...dataActions,
    getSessionsForStudent,
    assignGoalToStudent,
    removeGoalFromStudent,
    updateStudentGoal,

    // Modal State & Actions
    ...modalState,

    // Data Entry State & Actions
    ...dataEntryState,
    ...dataEntryActions,
    dataEntryActiveStudentsInSlots: activeStudentsInSlots,
    removeFocusedStudentSlot,

    // Keyboard Shortcut Handlers
    ...keyboardShortcutHandlers
    
  }), [
    students, goalTemplates, sessions, selectedStudent, loading, sessionsLoading, error, isFirebaseDBAvailable,
    dataActions, getSessionsForStudent, assignGoalToStudent, removeGoalFromStudent, updateStudentGoal,
    modalState,
    dataEntryState,
    dataEntryActions,
    activeStudentsInSlots,
    keyboardShortcutHandlers,
    removeFocusedStudentSlot,
  ]);

  return (
    <StudentDataContext.Provider value={contextValue}>
      {children}
    </StudentDataContext.Provider>
  );
};

export const useStudentData = (): StudentDataContextType => {
  const context = useContext(StudentDataContext);
  if (context === undefined) {
    throw new Error('useStudentData must be used within a StudentDataProvider');
  }
  return context;
};
