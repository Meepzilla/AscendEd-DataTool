
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './use-auth';
import { useToast as useShadcnToast } from "@/hooks/use-toast";
import { useErrorLog } from './use-error-log';
import type { Student, Goal, GoalTemplate, SessionData, SessionGoalData } from '@/lib/types';
import { useModalState } from './use-modal-state';
import { goalFromTemplate, hasTemplateGoal, linkGoalsToTemplates, recordRecentTemplates } from '@/lib/goal-templates';
import { DEFAULT_GOAL_TEMPLATES, defaultTemplateKey, applyAssignedGoalRenames, applyDefaultTemplateRenames, applyDefaultTemplateRetirements, applyDefaultTemplateUpdates } from '@/lib/goal-constants';
import { compareSessionsOldestFirst, generateUUID } from '@/lib/helpers';
import * as secureStore from '@/lib/secure-store';
import { reviveGoalTypes } from '@/lib/legacy-goal-types';
import type { ImportedSession } from '@/components/modals/import-data-modal';
import { createBackup, mergeBackupData, type AppBackup, type RestoreMode, type RestoreSummary } from '@/lib/backup';
import { loadAbcLists, loadCustomAbcLists, mergeAbcLists, saveAbcLists } from '@/lib/abc-lists';
import { getStudentGroups, saveStudentGroups } from '@/lib/student-groups';
import { mergeProblem, mergeSessions } from '@/lib/session-merge';

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
        const item = secureStore.getItem(key);
        const value = item ? JSON.parse(item, reviveGoalTypes) : defaultValue;
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
  // Keys whose stored data couldn't be read: they are never written over, so the data can still be recovered.
  const unreadableKeys = useRef<Set<string>>(new Set());

    const saveToLocal = useCallback((key: string | null, data: any): boolean => {
        if (typeof window === 'undefined' || !key) return false;
        if (unreadableKeys.current.has(key)) {
            toast({ title: "Couldn't save", description: "This device's saved data couldn't be read, so it wasn't overwritten. Restore a backup in Settings.", variant: "destructive" });
            return false;
        }
        try {
            secureStore.setItem(key, JSON.stringify(data));
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

    // With passcode protection, data is encrypted into storage in the background; a write that fails there
    // is reported the same way.
    useEffect(() => {
        secureStore.setWriteErrorHandler(error => {
            addErrorLog({ message: `Saving (encrypted) failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' });
            toast({ title: "Couldn't save", description: "This device's storage is full or unavailable, so the latest change was not saved. Back up your data in Settings.", variant: "destructive" });
        });
        return () => secureStore.setWriteErrorHandler(null);
    }, [toast, addErrorLog]);

    const studentsKey = getLocalStorageKey(LOCAL_STORAGE_STUDENTS_BASE_KEY, currentUser?.uid);
    const templatesKey = getLocalStorageKey(LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY, currentUser?.uid);
    const sessionsKey = getLocalStorageKey(LOCAL_STORAGE_SESSIONS_BASE_KEY, currentUser?.uid);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const byDateDesc = (a: SessionData, b: SessionData) => compareSessionsOldestFirst(b, a);

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
  
  /**
   * Adds imported sessions. Ids differ between devices, so each session's student is found by id, then by name,
   * and its goals by id, then by name and type; a goal the student doesn't have is added to them (otherwise its
   * data would be stored but never shown). Sessions for students not on this device are skipped (unmatchedCount).
   * A session keeps the Session ID it had in the file, so a later backup merge recognizes it. It is skipped as
   * already here (duplicateCount) when that id is on this device, or when a session of the same student, day and
   * start time with the same data is (sessions imported before ids were kept). Importing a file twice adds nothing.
   */
  const importSessions = useCallback(async (sessionsToImport: ImportedSession[]) => {
    if (!currentUser) throw new Error("Not authenticated.");
    const contentKey = (s: { studentId?: string; date?: string; time?: string; notes?: string; goals?: SessionGoalData[] }) => {
      const day = new Date(s.date ?? '');
      const goals = (s.goals || []).map(g => [g.goalId, g.data]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
      return JSON.stringify([s.studentId, Number.isNaN(day.getTime()) ? s.date : day.toDateString(), s.time ?? '', s.notes ?? '', goals]);
    };
    const nameKey = (name?: string) => (name || '').trim().toLowerCase();
    const students = studentsRef.current.map(st => ({ ...st, goals: [...(st.goals || [])] }));
    const findStudent = (s: ImportedSession) =>
      students.find(st => st.id === s.studentId) ?? students.find(st => nameKey(st.name) === nameKey(s.studentName));
    const ids = new Set(sessionsRef.current.map(s => s.sessionId));
    const contents = new Set(sessionsRef.current.map(contentKey));
    const newSessions: SessionData[] = [];
    let duplicateCount = 0;
    let unmatchedCount = 0;
    let addedGoalCount = 0;
    for (const { sourceSessionId, ...s } of sessionsToImport) {
      const student = findStudent(s as ImportedSession);
      if (!student) { unmatchedCount++; continue; }
      const goals = (s.goals || []).map(g => {
        let goal = student.goals.find(sg => sg.id === g.goalId)
          ?? student.goals.find(sg => nameKey(sg.name) === nameKey(g.goalName) && sg.type === g.goalType);
        if (!goal) {
          goal = { id: g.goalId || generateUUID(), name: g.goalName, type: g.goalType, smartGoal: '' };
          student.goals.push(goal);
          addedGoalCount++;
        }
        return { ...g, goalId: goal.id, goalName: goal.name };
      });
      const session = { ...s, studentId: student.id, studentName: student.name, goals };
      if ((sourceSessionId && ids.has(sourceSessionId)) || contents.has(contentKey(session))) { duplicateCount++; continue; }
      const sessionId = sourceSessionId && !ids.has(sourceSessionId) ? sourceSessionId : generateUUID();
      ids.add(sessionId);
      contents.add(contentKey(session));
      newSessions.push({ ...session, sessionId, userId: currentUser!.uid });
    }
    if (addedGoalCount > 0 && !commitStudents(students.sort(byName))) {
      throw new Error("The device's storage is full, so the sessions couldn't be saved.");
    }
    if (newSessions.length > 0 && !commitSessions([...sessionsRef.current, ...newSessions].sort(byDateDesc))) {
      throw new Error("The device's storage is full, so the sessions couldn't be saved.");
    }
    return { newCount: newSessions.length, duplicateCount, unmatchedCount, addedGoalCount };
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
    const damaged = keys.filter((key): key is string => !!key && unreadableKeys.current.has(key));
    if (mode === 'merge' && damaged.length > 0) {
      // Merging would keep this device's lists, but part of them couldn't be read.
      throw new Error("Some of this device's data couldn't be read, so the backup can't be added to it. Use Replace to restore the backup instead.");
    }

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
    // Replacing is how damaged data is recovered, so those lists may be overwritten now. If storage fills
    // part way, each list is put back exactly as it was stored (damaged ones too).
    const stored = keys.map(key => (key ? secureStore.snapshotItem(key) : null));
    damaged.forEach(key => unreadableKeys.current.delete(key));
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
        damaged.forEach(key => unreadableKeys.current.add(key));
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
    const abcLists = backup.settings?.abcLists;
    try {
      // Replace also clears custom lists when the backup has none (it was made with the built-in lists).
      if (mode === 'replace') saveAbcLists(abcLists ?? null);
      else if (abcLists) saveAbcLists(mergeAbcLists(loadAbcLists(), abcLists));
    } catch (error) {
      // The student data is restored; only the custom ABC lists didn't fit.
      addErrorLog({ message: `Restoring ABC lists failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' });
    }
    // Saved groups: replace uses the backup's; merge adds groups this device doesn't have.
    const groups = backup.settings?.studentGroups;
    if (mode === 'replace') saveStudentGroups(currentUser?.uid, groups ?? []);
    else if (groups?.length) {
      const existing = getStudentGroups(currentUser?.uid);
      saveStudentGroups(currentUser?.uid, [...existing, ...groups.filter(g => !existing.some(e => e.id === g.id))]);
    }
    return summary;
  }, [currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal, addErrorLog]);

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
    const { templates: retiredTemplates, changed: templatesRetired } = applyDefaultTemplateRetirements<GoalTemplate>(updatedTypes);
    // Built-in templates stored before defaultKey existed get it now (their current name), so renaming one later
    // doesn't bring the original back.
    let keysAdded = false;
    const localTemplates = retiredTemplates.map(t => {
      if (!t.isDefault || t.defaultKey) return t;
      keysAdded = true;
      return { ...t, defaultKey: t.name };
    });
    const templatesUpdated = templatesRenamed || typesUpdated || templatesRetired || keysAdded;
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

    // Goals assigned before they kept their template's id get it now (see linkGoalsToTemplates).
    const { students: linkedStudents, changed: goalsLinked } = linkGoalsToTemplates(localStudents, nextTemplates);
    if (goalsLinked) {
      if (saveToLocal(studentsKey, linkedStudents)) {
        studentsRef.current = linkedStudents;
        setStudents(linkedStudents);
      }
    }

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

    