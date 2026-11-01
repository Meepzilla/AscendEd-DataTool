
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './use-auth';
import { useToast as useShadcnToast } from "@/hooks/use-toast";
import { useErrorLog } from './use-error-log';
import type { Student, Goal, GoalTemplate, SessionData } from '@/lib/types';
import { useModalState } from './use-modal-state';
import { useDataStorage } from './use-data-storage';
import { goalFromTemplate, hasTemplateGoal, recordRecentTemplates } from '@/lib/goal-templates';
import { generateUUID } from '@/lib/helpers';
import * as secureStore from '@/lib/secure-store';
import { byDateDesc, byName } from '@/lib/data-store';
import { prepareLoadedData } from '@/lib/data-migrations';
import { planSessionImport, type ImportedSession } from '@/lib/session-import';
import { createBackup, type AppBackup, type RestoreMode, type RestoreSummary } from '@/lib/backup';
import { planRestore, restoreBackupSettings } from '@/lib/restore';
import { loadCustomAbcLists } from '@/lib/abc-lists';
import { getStudentGroups } from '@/lib/student-groups';
import { mergeProblem, mergeSessions } from '@/lib/session-merge';

// All student data for the app (students, goal templates, sessions) and the actions that change it. Storage
// lives in use-data-storage.ts and lib/data-store.ts; what happens on load, import and restore is worked out in
// lib/data-migrations.ts, lib/session-import.ts and lib/restore.ts (plain functions, unit tested); this file
// keeps the lists in React state and saves each change.

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
  deleteStudents: (studentIds: string[]) => boolean;
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
  /** False when it couldn't be saved (the error was shown). */
  updateSession: (sessionId: string, data: Partial<SessionData>) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<void>;
  /** Merges sessions saved in parts into one (session-merge.ts); false when they can't be merged or saving failed. */
  mergeSessionRecords: (sessionIds: string[]) => Promise<boolean>;
  getSessionsForStudent: (studentId: string) => SessionData[];
  importSessions: (sessionsToImport: ImportedSession[]) => Promise<{ newCount: number; duplicateCount: number; unmatchedCount: number; addedGoalCount: number }>;
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
  const { keys, save: saveToLocal, read: readStored, resetUnreadable, isUnreadable, unmark, mark } = useDataStorage(currentUser?.uid);
  const { students: studentsKey, templates: templatesKey, sessions: sessionsKey } = keys;

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

  /** Deletes several students and all their sessions at once (end-of-year clean-up). Returns whether it worked. */
  const deleteStudents = useCallback((studentIds: string[]): boolean => {
    if (!currentUser || studentIds.length === 0) return false;
    const ids = new Set(studentIds);
    if (!commitSessions(sessionsRef.current.filter(s => !ids.has(s.studentId)))) return false;
    if (!commitStudents(studentsRef.current.filter(s => !ids.has(s.id)))) return false;
    setSelectedStudent(prev => (prev && ids.has(prev.id) ? null : prev));
    return true;
  }, [currentUser, commitStudents, commitSessions]);

  const addGoalTemplate = useCallback(async (templateData: any) => {
    if (!currentUser) return null;
    const templateWithId = { ...templateData, userId: currentUser.uid, isDefault: false, id: generateUUID(), createdAt: new Date() };
    if (!commitTemplates([...templatesRef.current, templateWithId].sort(byName))) return null;
    toast({ title: "Success", description: `Template "${templateData.name}" added.` });
    return templateWithId;
  }, [currentUser, toast, commitTemplates]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
      if (!currentUser) return;
      // A built-in template keeps the name it was added under (defaultKey) when it is renamed.
      const update = (t: GoalTemplate) => ({ ...t, ...(t.isDefault && !t.defaultKey ? { defaultKey: t.name } : {}), ...data });
      if (!commitTemplates(templatesRef.current.map(t => t.id === templateId ? update(t) : t).sort(byName))) return;
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
    if (!currentUser) return false;
    if (!commitSessions(sessionsRef.current.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort(byDateDesc))) return false;
    toast({ title: "Success", description: "Session updated." });
    return true;
  }, [currentUser, toast, commitSessions]);

  const mergeSessionRecords = useCallback(async (sessionIds: string[]) => {
    if (!currentUser) return false;
    const parts = sessionsRef.current.filter(s => sessionIds.includes(s.sessionId));
    const problem = mergeProblem(parts);
    if (problem) {
      toast({ title: 'Can\'t merge', description: problem, variant: 'destructive' });
      return false;
    }
    const merged = mergeSessions(parts);
    const next = sessionsRef.current
      .filter(s => s.sessionId === merged.sessionId || !sessionIds.includes(s.sessionId))
      .map(s => (s.sessionId === merged.sessionId ? merged : s))
      .sort(byDateDesc);
    if (!commitSessions(next)) return false;
    toast({ title: 'Sessions merged', description: `${parts.length} sessions for ${merged.studentName} are now one session (${merged.time}–${merged.endTime}).` });
    return true;
  }, [currentUser, toast, commitSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser) return;
    if (!commitSessions(sessionsRef.current.filter(s => s.sessionId !== sessionId))) return;
    toast({ title: "Success", description: "Session deleted." });
  }, [currentUser, toast, commitSessions]);
  
  /** Adds sessions imported from a CSV file (see planSessionImport for how they are matched). */
  const importSessions = useCallback(async (sessionsToImport: ImportedSession[]) => {
    if (!currentUser) throw new Error("Not authenticated.");
    const plan = planSessionImport(studentsRef.current, sessionsRef.current, sessionsToImport, currentUser.uid);
    if (plan.addedGoalCount > 0 && !commitStudents(plan.students)) {
      throw new Error("The device's storage is full, so the sessions couldn't be saved.");
    }
    if (plan.newCount > 0 && !commitSessions(plan.sessions)) {
      throw new Error("The device's storage is full, so the sessions couldn't be saved.");
    }
    const { newCount, duplicateCount, unmatchedCount, addedGoalCount } = plan;
    return { newCount, duplicateCount, unmatchedCount, addedGoalCount };
  }, [currentUser, commitSessions, commitStudents]);

  const exportBackup = useCallback(
    () => createBackup({ students, goalTemplates, sessions }, { abcLists: loadCustomAbcLists() ?? undefined, studentGroups: getStudentGroups(currentUser?.uid) }),
    [students, goalTemplates, sessions, currentUser],
  );

  /**
   * Restores a backup. 'replace' swaps all data on this device for the backup's; 'merge' adds the
   * backup's records that aren't already here. Returns how many records were added (merge) or loaded (replace).
   * If storage fills up part way, what was already written is put back so the three lists stay consistent.
   */
  const restoreBackup = useCallback((backup: AppBackup, mode: RestoreMode): RestoreSummary => {
    if (!currentUser) throw new Error("Not authenticated.");
    const current = { students: studentsRef.current, goalTemplates: templatesRef.current, sessions: sessionsRef.current };

    const keys = [studentsKey, templatesKey, sessionsKey];
    const damaged = keys.filter((key): key is string => isUnreadable(key));
    if (mode === 'merge' && damaged.length > 0) {
      // Merging would keep this device's lists, but part of them couldn't be read.
      throw new Error("Some of this device's data couldn't be read, so the backup can't be added to it. Use Replace to restore the backup instead.");
    }

    const { next, summary } = planRestore(current, backup, mode);
    const { students: nextStudents, goalTemplates: nextTemplates, sessions: nextSessions } = next;
    // Replacing is how damaged data is recovered, so those lists may be overwritten now. If storage fills
    // part way, each list is put back exactly as it was stored (damaged ones too).
    const stored = keys.map(key => (key ? secureStore.snapshotItem(key) : null));
    unmark(damaged);
    const writes: [string | null, unknown][] = [
      [studentsKey, nextStudents],
      [templatesKey, nextTemplates],
      [sessionsKey, nextSessions],
    ];
    for (let i = 0; i < writes.length; i++) {
      if (!saveToLocal(writes[i][0], writes[i][1])) {
        keys.slice(0, i).forEach((key, j) => {
          if (!key) return;
          try {
            secureStore.restoreItem(key, stored[j]!);
          } catch { /* the earlier value fit before, so it fits again */ }
        });
        mark(damaged);
        throw new Error("The backup couldn't be saved on this device (storage is full). Nothing was changed.");
      }
    }
    if (damaged.length > 0) setError(null);
    studentsRef.current = nextStudents;
    templatesRef.current = nextTemplates;
    sessionsRef.current = nextSessions;
    setStudents(nextStudents);
    setGoalTemplates(nextTemplates);
    setSessions(nextSessions);
    setSelectedStudent(null);
    // Custom ABC lists and saved groups. The student data is restored even if the ABC lists don't fit.
    restoreBackupSettings(backup, mode, currentUser?.uid, error =>
      addErrorLog({ message: `Restoring ABC lists failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' }));
    return summary;
  }, [currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal, addErrorLog, isUnreadable, unmark, mark]);

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
    resetUnreadable();
    const rawStudents = readStored<Student>(studentsKey);
    const rawTemplates = readStored<GoalTemplate>(templatesKey);
    const rawSessions = readStored<SessionData>(sessionsKey);
    const anyUnreadable = [studentsKey, templatesKey, sessionsKey].some(isUnreadable);
    if (anyUnreadable) {
      setError(new Error('Some saved data could not be read.'));
      toast({
        title: "Some saved data couldn't be read",
        description: "It has been left as it is, and changes to it won't be saved. Restore a backup in Settings, or export the error log for help.",
        variant: "destructive",
      });
    }

    // Renamed and updated built-in goals and templates, and the built-in templates this device doesn't have yet.
    // A list that couldn't be read is never written over (the warning above covers it). Templates are saved first:
    // goals are linked to template ids only once those templates are stored, so no goal points at a template
    // that was never saved. The students are then saved once, with every update.
    const prepared = prepareLoadedData(rawStudents, rawTemplates, currentUser.uid);
    const templatesStored = !prepared.templatesChanged
      || (!isUnreadable(templatesKey) && saveToLocal(templatesKey, prepared.templates));
    const nextStudents = templatesStored && prepared.linkedStudents ? prepared.linkedStudents : prepared.students;
    if ((prepared.studentsChanged || nextStudents !== prepared.students) && !isUnreadable(studentsKey)) {
      saveToLocal(studentsKey, nextStudents);
    }
    templatesRef.current = prepared.templates;
    setGoalTemplates(prepared.templates);
    studentsRef.current = nextStudents;
    setStudents(nextStudents);

    const localSessions = [...rawSessions].sort(byDateDesc);
    sessionsRef.current = localSessions;
    setSessions(localSessions);
    setLoading(false);
    setSessionsLoading(false);
  }, [authLoading, currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal, toast, readStored, resetUnreadable, isUnreadable]);
  

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
    addStudent, updateStudent, deleteStudent, deleteStudents,
    assignGoalToStudent, removeGoalFromStudent, updateStudentGoal,
    addGoalTemplate, updateGoalTemplate, deleteGoalTemplate, archiveGoalTemplates, assignTemplateToStudents,
    addSession, updateSession, deleteSession, mergeSessionRecords,
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

    