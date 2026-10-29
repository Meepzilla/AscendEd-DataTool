
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { useToast as useShadcnToast } from "@/hooks/use-toast";
import { useErrorLog } from './use-error-log';
import type { Student, Goal, GoalTemplate, SessionData, SessionGoalData, User } from '@/lib/types';
import { useModalState } from './use-modal-state';
import { goalFromTemplate, hasTemplateGoal, recordRecentTemplates } from '@/lib/goal-templates';
import { DEFAULT_GOAL_TEMPLATES, applyAssignedGoalRenames, applyDefaultTemplateRenames, applyDefaultTemplateRetirements, applyDefaultTemplateUpdates } from '@/lib/goal-constants';
import { generateUUID } from '@/lib/helpers';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import { createBackup, mergeBackupData, type AppBackup, type RestoreMode, type RestoreSummary } from '@/lib/backup';
import { loadAbcLists, loadCustomAbcLists, mergeAbcLists, saveAbcLists } from '@/lib/abc-lists';

const LOCAL_STORAGE_STUDENTS_BASE_KEY = 'ascended_students_v2';
const LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY = 'ascended_goal_templates_v2';
const LOCAL_STORAGE_SESSIONS_BASE_KEY = 'ascended_sessions_v2';

const getLocalStorageKey = (base: string, uid: string | undefined): string | null => {
    if (!uid) return null;
    return `${base}_${uid}`;
};

const getFromLocalStorage = (key: string | null, defaultValue: any) => {
    if (typeof window === 'undefined' || !key) return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

interface StudentDataContextType {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
  currentUser: any;
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  studentFromContext: Student | null;
  loading: boolean;
  sessionsLoading: boolean;
  error: Error | null;
  addErrorLog: (log: any) => void;

  addStudent: (name: string) => Promise<Student | null>;
  updateStudent: (studentId: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  assignGoalToStudent: (studentId: string, goal: Goal) => Promise<void>;
  removeGoalFromStudent: (studentId: string, goalId: string) => Promise<void>;
  updateStudentGoal: (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => Promise<void>;

  addGoalTemplate: (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId' | 'isDefault'>) => Promise<GoalTemplate | null>;
  updateGoalTemplate: (templateId: string, data: Partial<GoalTemplate>) => Promise<void>;
  deleteGoalTemplate: (templateId: string) => Promise<void>;
  /** Archives several templates in one save (hidden from pickers; goals already assigned are kept). */
  archiveGoalTemplates: (templateIds: string[]) => Promise<void>;
  /** Gives each listed student a goal from the template, skipping students who already have it. */
  assignTemplateToStudents: (template: GoalTemplate, studentIds: string[]) => Promise<{ assigned: number; skipped: number }>;

  addSession: (sessionData: Omit<SessionData, 'sessionId'>) => Promise<SessionData | null>;
  updateSession: (sessionId: string, data: Partial<SessionData>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  getSessionsForStudent: (studentId: string) => SessionData[];
  importSessions: (sessionsToImport: Omit<SessionData, 'sessionId'>[]) => Promise<{ newCount: number; duplicateCount: number; }>;
  exportBackup: () => AppBackup;
  restoreBackup: (backup: AppBackup, mode: RestoreMode) => RestoreSummary;

  // Modal State & Actions
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
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);


export const StudentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const { toast } = useShadcnToast();
  const { addErrorLog } = useErrorLog();

  const [students, setStudents] = useState<Student[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const modalState = useModalState();

  const studentFromContext = useMemo(() => {
    if (!selectedStudent || students.length === 0) return null;
    return students.find(s => s.id === selectedStudent.id) || null;
  }, [selectedStudent, students]);

  // --- Start Data Actions ---

    const saveToLocal = useCallback((key: string | null, data: any) => {
        if (typeof window !== 'undefined' && key) {
            window.localStorage.setItem(key, JSON.stringify(data));
        }
    }, []);

    const studentsKey = getLocalStorageKey(LOCAL_STORAGE_STUDENTS_BASE_KEY, currentUser?.uid);
    const templatesKey = getLocalStorageKey(LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY, currentUser?.uid);
    const sessionsKey = getLocalStorageKey(LOCAL_STORAGE_SESSIONS_BASE_KEY, currentUser?.uid);

  const addStudent = useCallback(async (name: string) => {
    if (!currentUser) return null;
    const newStudent: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: currentUser.uid, isArchived: false };
    const studentWithId = { ...newStudent, id: generateUUID()};
    const newStudents = [...students, studentWithId].sort((a,b) => a.name.localeCompare(b.name));
    setStudents(newStudents);
    saveToLocal(studentsKey, newStudents);
    toast({ title: "Success", description: `Student "${name}" added.` });
    return studentWithId;
  }, [currentUser, students, studentsKey, toast, saveToLocal]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Student>) => {
      if (!currentUser) return;
      const updatedData = { ...data, updatedAt: new Date().toISOString() };
      const updatedStudents = students.map(s => s.id === studentId ? { ...s, ...updatedData } : s).sort((a,b) => a.name.localeCompare(b.name));
      setStudents(updatedStudents);
      saveToLocal(studentsKey, updatedStudents);
      toast({ title: "Success", description: "Student updated." });
  }, [currentUser, students, studentsKey, toast, saveToLocal]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (!currentUser) return;
    const newStudents = students.filter(s => s.id !== studentId);
    setStudents(newStudents);
    saveToLocal(studentsKey, newStudents);
    const newSessions = sessions.filter(s => s.studentId !== studentId);
    setSessions(newSessions);
    saveToLocal(sessionsKey, newSessions);
    toast({ title: "Success", description: "Student and sessions deleted." });
  }, [currentUser, students, sessions, studentsKey, sessionsKey, toast, saveToLocal]);

  const addGoalTemplate = useCallback(async (templateData: any) => {
    if (!currentUser) return null;
    const newTemplate = { ...templateData, userId: currentUser.uid, isDefault: false };
    const templateWithId = { ...newTemplate, id: generateUUID(), createdAt: new Date() };
    const newTemplates = [...goalTemplates, templateWithId].sort((a,b) => a.name.localeCompare(b.name));
    setGoalTemplates(newTemplates);
    saveToLocal(templatesKey, newTemplates);
    toast({ title: "Success", description: `Template "${templateData.name}" added.` });
    return templateWithId;
  }, [currentUser, goalTemplates, templatesKey, toast, saveToLocal]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
      if (!currentUser) return;
      const updatedTemplates = goalTemplates.map(t => t.id === templateId ? { ...t, ...data } : t).sort((a,b) => a.name.localeCompare(b.name));
      setGoalTemplates(updatedTemplates);
      saveToLocal(templatesKey, updatedTemplates);
      toast({ title: "Success", description: "Goal template updated." });
  }, [currentUser, goalTemplates, templatesKey, toast, saveToLocal]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    if (!currentUser) return;
    const newTemplates = goalTemplates.filter(t => t.id !== templateId);
    setGoalTemplates(newTemplates);
    saveToLocal(templatesKey, newTemplates);
    toast({ title: "Success", description: "Goal template deleted." });
  }, [currentUser, goalTemplates, templatesKey, toast, saveToLocal]);

  const archiveGoalTemplates = useCallback(async (templateIds: string[]) => {
    if (!currentUser || templateIds.length === 0) return;
    const ids = new Set(templateIds);
    const updatedTemplates = goalTemplates.map(t => ids.has(t.id) ? { ...t, isArchived: true } : t);
    setGoalTemplates(updatedTemplates);
    saveToLocal(templatesKey, updatedTemplates);
    toast({ title: "Templates archived", description: `${templateIds.length} template${templateIds.length === 1 ? '' : 's'} archived. Turn on Show Archived on the Goals page to see or restore them.` });
  }, [currentUser, goalTemplates, templatesKey, toast, saveToLocal]);

  const assignTemplateToStudents = useCallback(async (template: GoalTemplate, studentIds: string[]) => {
    if (!currentUser) return { assigned: 0, skipped: 0 };
    const ids = new Set(studentIds);
    let assigned = 0, skipped = 0;
    const updatedStudents = students.map(s => {
      if (!ids.has(s.id)) return s;
      if (hasTemplateGoal(s, template)) { skipped++; return s; }
      assigned++;
      return { ...s, goals: [...s.goals, goalFromTemplate(template)], updatedAt: new Date().toISOString() };
    });
    if (assigned > 0) {
      setStudents(updatedStudents);
      saveToLocal(studentsKey, updatedStudents);
      recordRecentTemplates(currentUser.uid, [template.id]);
    }
    return { assigned, skipped };
  }, [currentUser, students, studentsKey, saveToLocal]);

  const addSession = useCallback(async (sessionData: any) => {
    if (!currentUser) return null;
    const sessionWithId = { ...sessionData, userId: currentUser.uid, sessionId: generateUUID() };
    const newSessions = [sessionWithId, ...sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSessions(newSessions);
    saveToLocal(sessionsKey, newSessions);
    // Don't toast here; handled by consumer
    return sessionWithId;
  }, [currentUser, sessions, sessionsKey, saveToLocal]);

  const updateSession = useCallback(async (sessionId: string, data: any) => {
    if (!currentUser) return;
    const newSessions = sessions.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSessions(newSessions);
    saveToLocal(sessionsKey, newSessions);
    toast({ title: "Success", description: "Session updated." });
  }, [currentUser, sessions, sessionsKey, toast, saveToLocal]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser) return;
    const newSessions = sessions.filter(s => s.sessionId !== sessionId);
    setSessions(newSessions);
    saveToLocal(sessionsKey, newSessions);
    toast({ title: "Success", description: "Session deleted." });
  }, [currentUser, sessions, sessionsKey, toast, saveToLocal]);
  
  const importSessions = useCallback(async (sessionsToImport: any) => {
    if (!currentUser) throw new Error("Not authenticated.");
    const newSessions = sessionsToImport.map((s:any) => ({ ...s, sessionId: generateUUID(), userId: currentUser!.uid }));
    const updatedSessions = [...sessions, ...newSessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSessions(updatedSessions);
    saveToLocal(sessionsKey, updatedSessions);
    return { newCount: newSessions.length, duplicateCount: 0 };
  }, [currentUser, sessions, sessionsKey, saveToLocal]);

  const exportBackup = useCallback(
    () => createBackup({ students, goalTemplates, sessions }, { abcLists: loadCustomAbcLists() ?? undefined }),
    [students, goalTemplates, sessions],
  );

  /**
   * Restores a backup. 'replace' swaps all data on this device for the backup's; 'merge' adds the
   * backup's records that aren't already here. Returns how many records were added (merge) or loaded (replace).
   */
  const restoreBackup = useCallback((backup: AppBackup, mode: RestoreMode): RestoreSummary => {
    if (!currentUser) throw new Error("Not authenticated.");
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const byDateDesc = (a: SessionData, b: SessionData) => new Date(b.date).getTime() - new Date(a.date).getTime();

    let next = backup.data;
    let summary: RestoreSummary = { students: next.students.length, goalTemplates: next.goalTemplates.length, sessions: next.sessions.length };
    if (mode === 'merge') {
      const result = mergeBackupData({ students, goalTemplates, sessions }, backup.data);
      next = result.merged;
      summary = result.added;
    }

    const nextStudents = [...next.students].sort(byName);
    const nextTemplates = [...next.goalTemplates].sort(byName);
    const nextSessions = [...next.sessions].sort(byDateDesc);
    setStudents(nextStudents);
    setGoalTemplates(nextTemplates);
    setSessions(nextSessions);
    setSelectedStudent(null);
    saveToLocal(studentsKey, nextStudents);
    saveToLocal(templatesKey, nextTemplates);
    saveToLocal(sessionsKey, nextSessions);
    const abcLists = backup.settings?.abcLists;
    if (abcLists) saveAbcLists(mode === 'replace' ? abcLists : mergeAbcLists(loadAbcLists(), abcLists));
    return summary;
  }, [currentUser, students, goalTemplates, sessions, studentsKey, templatesKey, sessionsKey, saveToLocal]);

  // --- End Data Actions ---

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

    const { students: localStudents, changed: goalsRenamed } = applyAssignedGoalRenames<Student>(getFromLocalStorage(studentsKey, []));
    if (goalsRenamed) saveToLocal(studentsKey, localStudents);
    setStudents(localStudents.sort((a: Student, b: Student) => a.name.localeCompare(b.name)));
    const rawTemplates = getFromLocalStorage(templatesKey, []);
    const { templates: renamedTemplates, changed: templatesRenamed } = applyDefaultTemplateRenames<GoalTemplate>(
        rawTemplates.map((t: any) => ({...t, createdAt: new Date(t.createdAt)}))
    );
    const { templates: updatedTypes, changed: typesUpdated } = applyDefaultTemplateUpdates<GoalTemplate>(renamedTemplates);
    const { templates: localTemplates, changed: templatesRetired } = applyDefaultTemplateRetirements<GoalTemplate>(updatedTypes);
    const templatesUpdated = templatesRenamed || typesUpdated || templatesRetired;
    const existingDefaultNames = new Set(localTemplates.filter((t: GoalTemplate) => t.isDefault).map((t: GoalTemplate) => t.name));
    const missingDefaultTemplates = DEFAULT_GOAL_TEMPLATES.filter(
        defaultTemplate => !existingDefaultNames.has(defaultTemplate.name)
    ).map(t => ({ ...t, id: generateUUID(), createdAt: new Date(), userId: currentUser?.uid || 'local-user' }));

    if (missingDefaultTemplates.length > 0 || templatesUpdated) {
        const updatedTemplates = [...localTemplates, ...missingDefaultTemplates];
        setGoalTemplates(updatedTemplates.sort((a: GoalTemplate, b: GoalTemplate) => a.name.localeCompare(b.name)));
        saveToLocal(templatesKey, updatedTemplates);
    } else {
        setGoalTemplates(localTemplates.sort((a: GoalTemplate, b: GoalTemplate) => a.name.localeCompare(b.name)));
    }
    const localSessions = getFromLocalStorage(sessionsKey, []);
    setSessions(localSessions.sort((a: SessionData, b: SessionData) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
    setSessionsLoading(false);
  }, [authLoading, currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal]);
  

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
    await updateStudent(studentId, { goals: updatedGoals });
  }, [students, updateStudent, toast]);
  
  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
      const student = students.find(s => s.id === studentId);
      if (!student) { return; }
      const updatedGoals = student.goals.filter(g => g.id !== goalId);
      await updateStudent(studentId, { goals: updatedGoals });
  }, [students, updateStudent]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, data: Partial<Goal>) => {
      const student = students.find(s => s.id === studentId);
      if (!student) { return; }
      const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...data } : g);
      await updateStudent(studentId, { goals: updatedGoals });
  }, [students, updateStudent]);

  const contextValue: StudentDataContextType = {
    students,
    goalTemplates,
    sessions,
    currentUser,
    selectedStudent,
    setSelectedStudent,
    studentFromContext,
    loading,
    sessionsLoading,
    error,
    addErrorLog,

    // Data Actions
    addStudent, updateStudent, deleteStudent,
    assignGoalToStudent, removeGoalFromStudent, updateStudentGoal,
    addGoalTemplate, updateGoalTemplate, deleteGoalTemplate, archiveGoalTemplates, assignTemplateToStudents,
    addSession, updateSession, deleteSession,
    getSessionsForStudent, importSessions,
    exportBackup, restoreBackup,

    // Modal State & Actions
    ...modalState,
  };

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

    