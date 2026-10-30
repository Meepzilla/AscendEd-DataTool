
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './use-auth';
import { useToast as useShadcnToast } from "@/hooks/use-toast";
import { useErrorLog } from './use-error-log';
import type { Student, Goal, GoalTemplate, SessionData, SessionGoalData, User } from '@/lib/types';
import { useModalState } from './use-modal-state';
import { goalFromTemplate, hasTemplateGoal, recordRecentTemplates } from '@/lib/goal-templates';
import { DEFAULT_GOAL_TEMPLATES, defaultTemplateKey, applyAssignedGoalRenames, applyDefaultTemplateRenames, applyDefaultTemplateRetirements, applyDefaultTemplateUpdates } from '@/lib/goal-constants';
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

/** Stored data, the default when there is none yet, or undefined when it is there but can't be read. */
const readFromLocalStorage = (key: string | null, defaultValue: any) => {
    if (typeof window === 'undefined' || !key) return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        const value = item ? JSON.parse(item) : defaultValue;
        return Array.isArray(defaultValue) && !Array.isArray(value) ? undefined : value;
    } catch (error) {
        console.warn(`Error reading from localStorage key "${key}":`, error);
        return undefined;
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
  //
  // Every change reads the latest records from refs (not the values captured when the callback was made),
  // so changes made one after another, like Save All saving several sessions in a loop, all keep each other.
  // Each change is written to storage first and only shown once it is stored: if the device's storage is
  // full, nothing is changed, an error is shown, and the action reports that it failed.

  const studentsRef = useRef<Student[]>([]);
  const templatesRef = useRef<GoalTemplate[]>([]);
  const sessionsRef = useRef<SessionData[]>([]);
  // Keys whose stored data couldn't be read: they are never written over, so the data can still be recovered.
  const unreadableKeys = useRef<Set<string>>(new Set());

    const saveToLocal = useCallback((key: string | null, data: any): boolean => {
        if (typeof window === 'undefined' || !key) return false;
        if (unreadableKeys.current.has(key)) {
            toast({ title: "Couldn't save", description: "This device's saved data couldn't be read, so it wasn't overwritten. Restore a backup in Settings.", variant: "destructive" });
            return false;
        }
        try {
            window.localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`Error writing localStorage key "${key}":`, error);
            addErrorLog({ message: `Saving failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' });
            toast({
              title: "Couldn't save",
              description: "This device's storage is full or unavailable, so the change was not saved. Back up your data in Settings, then delete old sessions to make room.",
              variant: "destructive",
            });
            return false;
        }
    }, [toast, addErrorLog]);

    const studentsKey = getLocalStorageKey(LOCAL_STORAGE_STUDENTS_BASE_KEY, currentUser?.uid);
    const templatesKey = getLocalStorageKey(LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY, currentUser?.uid);
    const sessionsKey = getLocalStorageKey(LOCAL_STORAGE_SESSIONS_BASE_KEY, currentUser?.uid);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const byDateDesc = (a: SessionData, b: SessionData) => new Date(b.date).getTime() - new Date(a.date).getTime();

  /** Stores a new list and, only if that worked, shows it. */
  const commitStudents = useCallback((next: Student[]) => {
    if (!saveToLocal(studentsKey, next)) return false;
    studentsRef.current = next;
    setStudents(next);
    return true;
  }, [saveToLocal, studentsKey]);
  const commitTemplates = useCallback((next: GoalTemplate[]) => {
    if (!saveToLocal(templatesKey, next)) return false;
    templatesRef.current = next;
    setGoalTemplates(next);
    return true;
  }, [saveToLocal, templatesKey]);
  const commitSessions = useCallback((next: SessionData[]) => {
    if (!saveToLocal(sessionsKey, next)) return false;
    sessionsRef.current = next;
    setSessions(next);
    return true;
  }, [saveToLocal, sessionsKey]);

  const addStudent = useCallback(async (name: string) => {
    if (!currentUser) return null;
    const newStudent: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: currentUser.uid, isArchived: false };
    const studentWithId = { ...newStudent, id: generateUUID()};
    if (!commitStudents([...studentsRef.current, studentWithId].sort(byName))) return null;
    toast({ title: "Success", description: `Student "${name}" added.` });
    return studentWithId;
  }, [currentUser, toast, commitStudents]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Student>) => {
      if (!currentUser) return;
      const updatedData = { ...data, updatedAt: new Date().toISOString() };
      if (!commitStudents(studentsRef.current.map(s => s.id === studentId ? { ...s, ...updatedData } : s).sort(byName))) return;
      toast({ title: "Success", description: "Student updated." });
  }, [currentUser, toast, commitStudents]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (!currentUser) return;
    // Sessions first: if that fails, the student (and so the sessions' owner) is still there.
    if (!commitSessions(sessionsRef.current.filter(s => s.studentId !== studentId))) return;
    if (!commitStudents(studentsRef.current.filter(s => s.id !== studentId))) return;
    toast({ title: "Success", description: "Student and sessions deleted." });
  }, [currentUser, toast, commitStudents, commitSessions]);

  const addGoalTemplate = useCallback(async (templateData: any) => {
    if (!currentUser) return null;
    const templateWithId = { ...templateData, userId: currentUser.uid, isDefault: false, id: generateUUID(), createdAt: new Date() };
    if (!commitTemplates([...templatesRef.current, templateWithId].sort(byName))) return null;
    toast({ title: "Success", description: `Template "${templateData.name}" added.` });
    return templateWithId;
  }, [currentUser, toast, commitTemplates]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
      if (!currentUser) return;
      if (!commitTemplates(templatesRef.current.map(t => t.id === templateId ? { ...t, ...data } : t).sort(byName))) return;
      toast({ title: "Success", description: "Goal template updated." });
  }, [currentUser, toast, commitTemplates]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    if (!currentUser) return;
    if (!commitTemplates(templatesRef.current.filter(t => t.id !== templateId))) return;
    toast({ title: "Success", description: "Goal template deleted." });
  }, [currentUser, toast, commitTemplates]);

  const archiveGoalTemplates = useCallback(async (templateIds: string[]) => {
    if (!currentUser || templateIds.length === 0) return;
    const ids = new Set(templateIds);
    if (!commitTemplates(templatesRef.current.map(t => ids.has(t.id) ? { ...t, isArchived: true } : t))) return;
    toast({ title: "Templates archived", description: `${templateIds.length} template${templateIds.length === 1 ? '' : 's'} archived. Turn on Show Archived on the Goals page to see or restore them.` });
  }, [currentUser, toast, commitTemplates]);

  const assignTemplateToStudents = useCallback(async (template: GoalTemplate, studentIds: string[]) => {
    if (!currentUser) return { assigned: 0, skipped: 0 };
    const ids = new Set(studentIds);
    let assigned = 0, skipped = 0;
    const updatedStudents = studentsRef.current.map(s => {
      if (!ids.has(s.id)) return s;
      if (hasTemplateGoal(s, template)) { skipped++; return s; }
      assigned++;
      return { ...s, goals: [...s.goals, goalFromTemplate(template)], updatedAt: new Date().toISOString() };
    });
    if (assigned > 0) {
      if (!commitStudents(updatedStudents)) return { assigned: 0, skipped };
      recordRecentTemplates(currentUser.uid, [template.id]);
    }
    return { assigned, skipped };
  }, [currentUser, commitStudents]);

  const addSession = useCallback(async (sessionData: any) => {
    if (!currentUser) return null;
    const sessionWithId = { ...sessionData, userId: currentUser.uid, sessionId: generateUUID() };
    if (!commitSessions([sessionWithId, ...sessionsRef.current].sort(byDateDesc))) return null;
    // Don't toast here; handled by consumer
    return sessionWithId;
  }, [currentUser, commitSessions]);

  const updateSession = useCallback(async (sessionId: string, data: any) => {
    if (!currentUser) return;
    if (!commitSessions(sessionsRef.current.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort(byDateDesc))) return;
    toast({ title: "Success", description: "Session updated." });
  }, [currentUser, toast, commitSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser) return;
    if (!commitSessions(sessionsRef.current.filter(s => s.sessionId !== sessionId))) return;
    toast({ title: "Success", description: "Session deleted." });
  }, [currentUser, toast, commitSessions]);
  
  /**
   * Adds imported sessions, skipping any that match a session already here (or earlier in the same file):
   * the same student, date and start time. Importing the same file twice therefore adds nothing.
   */
  const importSessions = useCallback(async (sessionsToImport: any) => {
    if (!currentUser) throw new Error("Not authenticated.");
    const sessionKey = (s: { studentId?: string; date?: string; time?: string }) => {
      const day = new Date(s.date ?? '');
      return `${s.studentId}|${Number.isNaN(day.getTime()) ? s.date : day.toDateString()}|${s.time ?? ''}`;
    };
    const seen = new Set(sessionsRef.current.map(sessionKey));
    const newSessions: SessionData[] = [];
    let duplicateCount = 0;
    for (const s of sessionsToImport) {
      const key = sessionKey(s);
      if (seen.has(key)) { duplicateCount++; continue; }
      seen.add(key);
      newSessions.push({ ...s, sessionId: generateUUID(), userId: currentUser!.uid });
    }
    if (newSessions.length > 0 && !commitSessions([...sessionsRef.current, ...newSessions].sort(byDateDesc))) {
      throw new Error("The device's storage is full, so the sessions couldn't be saved.");
    }
    return { newCount: newSessions.length, duplicateCount };
  }, [currentUser, commitSessions]);

  const exportBackup = useCallback(
    () => createBackup({ students, goalTemplates, sessions }, { abcLists: loadCustomAbcLists() ?? undefined }),
    [students, goalTemplates, sessions],
  );

  /**
   * Restores a backup. 'replace' swaps all data on this device for the backup's; 'merge' adds the
   * backup's records that aren't already here. Returns how many records were added (merge) or loaded (replace).
   * If storage fills up part way, what was already written is put back so the three lists stay consistent.
   */
  const restoreBackup = useCallback((backup: AppBackup, mode: RestoreMode): RestoreSummary => {
    if (!currentUser) throw new Error("Not authenticated.");
    const current = { students: studentsRef.current, goalTemplates: templatesRef.current, sessions: sessionsRef.current };

    let next = backup.data;
    let summary: RestoreSummary = { students: next.students.length, goalTemplates: next.goalTemplates.length, sessions: next.sessions.length, goals: 0 };
    if (mode === 'merge') {
      const result = mergeBackupData(current, backup.data);
      next = result.merged;
      summary = result.added;
    }

    const nextStudents = [...next.students].sort(byName);
    const nextTemplates = [...next.goalTemplates].sort(byName);
    const nextSessions = [...next.sessions].sort(byDateDesc);
    const writes: [string | null, unknown, unknown][] = [
      [studentsKey, nextStudents, current.students],
      [templatesKey, nextTemplates, current.goalTemplates],
      [sessionsKey, nextSessions, current.sessions],
    ];
    for (let i = 0; i < writes.length; i++) {
      if (!saveToLocal(writes[i][0], writes[i][1])) {
        writes.slice(0, i).forEach(([key, , previous]) => saveToLocal(key, previous));
        throw new Error("The backup couldn't be saved on this device (storage is full). Nothing was changed.");
      }
    }
    studentsRef.current = nextStudents;
    templatesRef.current = nextTemplates;
    sessionsRef.current = nextSessions;
    setStudents(nextStudents);
    setGoalTemplates(nextTemplates);
    setSessions(nextSessions);
    setSelectedStudent(null);
    const abcLists = backup.settings?.abcLists;
    if (abcLists) saveAbcLists(mode === 'replace' ? abcLists : mergeAbcLists(loadAbcLists(), abcLists));
    return summary;
  }, [currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal]);

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

    // A list that can't be read is kept as it is in storage (never written over) and reported.
    unreadableKeys.current.clear();
    const read = (key: string | null) => {
      const value = readFromLocalStorage(key, []);
      if (value !== undefined) return value;
      if (key) unreadableKeys.current.add(key);
      return [];
    };
    const rawStudents = read(studentsKey);
    const rawTemplates = read(templatesKey);
    const rawSessions = read(sessionsKey);
    if (unreadableKeys.current.size > 0) {
      setError(new Error('Some saved data could not be read.'));
      toast({
        title: "Some saved data couldn't be read",
        description: "It has been left as it is, and changes to it won't be saved. Restore a backup in Settings, or export the error log for help.",
        variant: "destructive",
      });
    }

    const { students: renamedStudents, changed: goalsRenamed } = applyAssignedGoalRenames<Student>(rawStudents);
    const localStudents = [...renamedStudents].sort(byName);
    if (goalsRenamed) saveToLocal(studentsKey, localStudents);
    studentsRef.current = localStudents;
    setStudents(localStudents);

    const { templates: renamedTemplates, changed: templatesRenamed } = applyDefaultTemplateRenames<GoalTemplate>(
        rawTemplates.map((t: any) => ({...t, createdAt: new Date(t.createdAt)}))
    );
    const { templates: updatedTypes, changed: typesUpdated } = applyDefaultTemplateUpdates<GoalTemplate>(renamedTemplates);
    const { templates: localTemplates, changed: templatesRetired } = applyDefaultTemplateRetirements<GoalTemplate>(updatedTypes);
    const templatesUpdated = templatesRenamed || typesUpdated || templatesRetired;
    // Built-in templates are matched by the name they were added under (defaultKey), so one the user renamed
    // isn't added again under its original name.
    const existingDefaultNames = new Set(localTemplates.filter((t: GoalTemplate) => t.isDefault).map(defaultTemplateKey));
    const missingDefaultTemplates = DEFAULT_GOAL_TEMPLATES.filter(
        defaultTemplate => !existingDefaultNames.has(defaultTemplate.name)
    ).map(t => ({ ...t, defaultKey: t.name, id: generateUUID(), createdAt: new Date(), userId: currentUser?.uid || 'local-user' }));
    const nextTemplates = [...localTemplates, ...missingDefaultTemplates].sort(byName);
    if (missingDefaultTemplates.length > 0 || templatesUpdated) saveToLocal(templatesKey, nextTemplates);
    templatesRef.current = nextTemplates;
    setGoalTemplates(nextTemplates);

    const localSessions = [...rawSessions].sort(byDateDesc);
    sessionsRef.current = localSessions;
    setSessions(localSessions);
    setLoading(false);
    setSessionsLoading(false);
  }, [authLoading, currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal, toast]);
  

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

    