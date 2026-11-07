
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
import { byDateDesc, byName, hydrateLists, readList } from '@/lib/data-store';
import { DATA_CHANGED_CHANNEL, isMainListStorageKey, isOwnDataChangedMessage, postDataChanged, runListTransactionAsync, type AsyncListTransactionStore, type MainListKey } from '@/lib/data-transaction';
import { prepareLoadedData } from '@/lib/data-migrations';
import { planSessionImport, type ImportedSession } from '@/lib/session-import';
import { createBackup, type AppBackup, type ParsedBackup, type RestoreMode, type RestoreSummary } from '@/lib/backup';
import { planRestore, restoreBackupSettings } from '@/lib/restore';
import { loadCustomAbcLists } from '@/lib/abc-lists';
import { applyStudentImport, type ImportStudent } from '@/lib/student-import';
import { getStudentGroups } from '@/lib/student-groups';
import { visibleTemplates, deletedBuiltInTemplates as listDeletedBuiltIns, restoreBuiltInTemplates as restoreBuiltInList } from '@/lib/builtin-goals';
import { mergeProblem, mergeSessions } from '@/lib/session-merge';

// All student data for the app (students, goal templates, sessions) and the actions that change it. Storage
// lives in use-data-storage.ts and lib/data-store.ts; what happens on load, import and restore is worked out in
// lib/data-migrations.ts, lib/session-import.ts and lib/restore.ts (plain functions, unit tested); this file
// keeps the lists in React state and saves each change.

interface StudentDataContextType {
  students: Student[];
  goalTemplates: GoalTemplate[];
  /** Built-in templates the user deleted (Settings → Built-in goals restores them). */
  deletedBuiltInTemplates: GoalTemplate[];
  restoreBuiltInTemplates: (templateIds: string[]) => Promise<void>;
  sessions: SessionData[];
  currentUser: any;
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  studentFromContext: Student | null;
  loading: boolean;
  sessionsLoading: boolean;
  error: Error | null;
  addErrorLog: (log: any) => void;

  /** `quiet`: no "added" message (the caller shows its own). */
  addStudent: (name: string, options?: { quiet?: boolean }) => Promise<Student | null>;
  updateStudent: (studentId: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  deleteStudents: (studentIds: string[]) => Promise<boolean>;
  /** Adds and updates students from a spreadsheet in one save. Null when it couldn't be saved (the error was shown). */
  importStudents: (students: ImportStudent[]) => Promise<{ added: number; updated: number; goals: number } | null>;
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
  restoreBackup: (backup: AppBackup, mode: RestoreMode) => Promise<RestoreSummary>;

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
  // Every stored template, including built-in ones the user deleted (see builtin-goals.ts).
  const [templateList, setTemplateList] = useState<GoalTemplate[]>([]);
  const goalTemplates = useMemo(() => visibleTemplates(templateList), [templateList]);
  const deletedBuiltInTemplates = useMemo(() => listDeletedBuiltIns(templateList), [templateList]);
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
  // Each change is written to storage first — the save resolves only after the write has landed in
  // durable storage and read back — and only then shown: if the device's storage is full, nothing is
  // changed, an error is shown, and the action reports that it failed.

  const studentsRef = useRef<Student[]>([]);
  const templatesRef = useRef<GoalTemplate[]>([]);
  const sessionsRef = useRef<SessionData[]>([]);
  const { keys, save: saveToLocal, read: readStored, resetUnreadable, isUnreadable, unmark, mark, hydrate } = useDataStorage(currentUser?.uid);
  const { students: studentsKey, templates: templatesKey, sessions: sessionsKey } = keys;

  /** Stores a new list and, only if that worked, shows it. */
  const commitStudents = useCallback(async (next: Student[]) => {
    if (!(await saveToLocal(studentsKey, next))) return false;
    studentsRef.current = next;
    setStudents(next);
    postDataChanged();
    return true;
  }, [saveToLocal, studentsKey]);
  const commitTemplates = useCallback(async (next: GoalTemplate[]) => {
    if (!(await saveToLocal(templatesKey, next))) return false;
    templatesRef.current = next;
    setTemplateList(next);
    postDataChanged();
    return true;
  }, [saveToLocal, templatesKey]);
  const commitSessions = useCallback(async (next: SessionData[]) => {
    if (!(await saveToLocal(sessionsKey, next))) return false;
    sessionsRef.current = next;
    setSessions(next);
    postDataChanged();
    return true;
  }, [saveToLocal, sessionsKey]);

  /**
   * Writes all three lists as one transaction (see data-transaction.ts): every list is
   * written, read back from durable storage, and on any failure all three are rolled back to what was
   * stored. Only when it returns true may the caller show the new lists. The save
   * itself already shows the error when storage is full.
   */
  const applyTransaction = useCallback(async (next: { students: Student[]; goalTemplates: GoalTemplate[]; sessions: SessionData[] }) => {
    const keyOf: Record<MainListKey, string | null> = { students: studentsKey, goalTemplates: templatesKey, sessions: sessionsKey };
    const store: AsyncListTransactionStore = {
      snapshot: key => (keyOf[key] ? secureStore.snapshotItem(keyOf[key]!) : null),
      restore: async (key, snapshot) => { if (keyOf[key]) await secureStore.restoreItemAsync(keyOf[key]!, snapshot as secureStore.ItemSnapshot); },
      write: (key, value) => saveToLocal(keyOf[key], value),
      read: async key => {
        const value = keyOf[key] ? await secureStore.readDurableList(keyOf[key]!) : undefined;
        return value === undefined ? null : value;
      },
    };
    return runListTransactionAsync({ store, next });
  }, [studentsKey, templatesKey, sessionsKey, saveToLocal]);

  /** Shows transaction results in state, after applyTransaction said they are stored. */
  const applyListsQuiet = useCallback((next: { students: Student[]; goalTemplates: GoalTemplate[]; sessions: SessionData[] }) => {
    studentsRef.current = next.students;
    templatesRef.current = next.goalTemplates;
    sessionsRef.current = next.sessions;
    setStudents(next.students);
    setTemplateList(next.goalTemplates);
    setSessions(next.sessions);
  }, []);

  /** applyListsQuiet, plus telling other tabs the data changed (a reload from another tab must not re-post). */
  const applyLists = useCallback((next: { students: Student[]; goalTemplates: GoalTemplate[]; sessions: SessionData[] }) => {
    applyListsQuiet(next);
    postDataChanged();
  }, [applyListsQuiet]);

  const addStudent = useCallback(async (name: string, options?: { quiet?: boolean }) => {
    if (!currentUser) return null;
    const newStudent: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: currentUser.uid, isArchived: false };
    const studentWithId = { ...newStudent, id: generateUUID()};
    if (!(await commitStudents([...studentsRef.current, studentWithId].sort(byName)))) return null;
    if (!options?.quiet) toast({ title: "Success", description: `Student "${name}" added.` });
    return studentWithId;
  }, [currentUser, toast, commitStudents]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Student>) => {
      if (!currentUser) return;
      const updatedData = { ...data, updatedAt: new Date().toISOString() };
      if (!(await commitStudents(studentsRef.current.map(s => s.id === studentId ? { ...s, ...updatedData } : s).sort(byName)))) return;
      toast({ title: "Success", description: "Student updated." });
  }, [currentUser, toast, commitStudents]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (!currentUser) return;
    const next = {
      students: studentsRef.current.filter(s => s.id !== studentId),
      goalTemplates: templatesRef.current,
      sessions: sessionsRef.current.filter(s => s.studentId !== studentId),
    };
    // One transaction: a quota failure part way must not leave the sessions deleted
    // while the student remains (or the other way round).
    if (!(await applyTransaction(next))) return;
    applyLists(next);
    toast({ title: "Success", description: "Student and sessions deleted." });
  }, [currentUser, toast, applyTransaction, applyLists]);

  /** Deletes several students and all their sessions at once (end-of-year clean-up). Returns whether it worked. */
  const deleteStudents = useCallback(async (studentIds: string[]): Promise<boolean> => {
    if (!currentUser || studentIds.length === 0) return false;
    const ids = new Set(studentIds);
    const next = {
      students: studentsRef.current.filter(s => !ids.has(s.id)),
      goalTemplates: templatesRef.current,
      sessions: sessionsRef.current.filter(s => !ids.has(s.studentId)),
    };
    if (!(await applyTransaction(next))) return false;
    applyLists(next);
    setSelectedStudent(prev => (prev && ids.has(prev.id) ? null : prev));
    return true;
  }, [currentUser, applyTransaction, applyLists]);

  const importStudents = useCallback(async (imported: ImportStudent[]) => {
    if (!currentUser || imported.length === 0) return null;
    const result = applyStudentImport(studentsRef.current, imported, currentUser.uid);
    if (!(await commitStudents(result.students.sort(byName)))) return null;
    return { added: result.added, updated: result.updated, goals: result.goals };
  }, [currentUser, commitStudents]);

  const addGoalTemplate = useCallback(async (templateData: any) => {
    if (!currentUser) return null;
    const templateWithId = { ...templateData, userId: currentUser.uid, isDefault: false, id: generateUUID(), createdAt: new Date() };
    if (!(await commitTemplates([...templatesRef.current, templateWithId].sort(byName)))) return null;
    toast({ title: "Success", description: `Template "${templateData.name}" added.` });
    return templateWithId;
  }, [currentUser, toast, commitTemplates]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
      if (!currentUser) return;
      // A built-in template keeps the name it was added under (defaultKey) when it is renamed.
      const update = (t: GoalTemplate) => ({ ...t, ...(t.isDefault && !t.defaultKey ? { defaultKey: t.name } : {}), ...data });
      if (!(await commitTemplates(templatesRef.current.map(t => t.id === templateId ? update(t) : t).sort(byName)))) return;
      toast({ title: "Success", description: "Goal template updated." });
  }, [currentUser, toast, commitTemplates]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    if (!currentUser) return;
    const target = templatesRef.current.find(t => t.id === templateId);
    // A built-in template is marked deleted rather than removed, so it isn't added back when the app loads.
    const next = target?.isDefault
      ? templatesRef.current.map(t => t.id === templateId ? { ...t, deleted: true, isArchived: true } : t)
      : templatesRef.current.filter(t => t.id !== templateId);
    if (!(await commitTemplates(next))) return;
    toast({ title: "Success", description: target?.isDefault ? "Built-in goal deleted. Restore it in Settings → Built-in goals." : "Goal template deleted." });
  }, [currentUser, toast, commitTemplates]);

  const restoreBuiltInTemplates = useCallback(async (templateIds: string[]) => {
    if (!currentUser || templateIds.length === 0) return;
    if (!(await commitTemplates(restoreBuiltInList(templatesRef.current, templateIds)))) return;
    toast({ title: "Built-in goals restored", description: `${templateIds.length} goal${templateIds.length === 1 ? '' : 's'} back in the Goals library.` });
  }, [currentUser, toast, commitTemplates]);

  const archiveGoalTemplates = useCallback(async (templateIds: string[]) => {
    if (!currentUser || templateIds.length === 0) return;
    const ids = new Set(templateIds);
    if (!(await commitTemplates(templatesRef.current.map(t => ids.has(t.id) ? { ...t, isArchived: true } : t)))) return;
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
      if (!(await commitStudents(updatedStudents))) return { assigned: 0, skipped };
      recordRecentTemplates(currentUser.uid, [template.id]);
    }
    return { assigned, skipped };
  }, [currentUser, commitStudents]);

  const addSession = useCallback(async (sessionData: any) => {
    if (!currentUser) return null;
    const sessionWithId = { ...sessionData, userId: currentUser.uid, sessionId: generateUUID() };
    if (!(await commitSessions([sessionWithId, ...sessionsRef.current].sort(byDateDesc)))) return null;
    // Don't toast here; handled by consumer
    return sessionWithId;
  }, [currentUser, commitSessions]);

  const updateSession = useCallback(async (sessionId: string, data: any) => {
    if (!currentUser) return false;
    if (!(await commitSessions(sessionsRef.current.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort(byDateDesc)))) return false;
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
    if (!(await commitSessions(next))) return false;
    toast({ title: 'Sessions merged', description: `${parts.length} sessions for ${merged.studentName} are now one session (${merged.time}–${merged.endTime}).` });
    return true;
  }, [currentUser, toast, commitSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser) return;
    if (!(await commitSessions(sessionsRef.current.filter(s => s.sessionId !== sessionId)))) return;
    toast({ title: "Success", description: "Session deleted." });
  }, [currentUser, toast, commitSessions]);
  
  /** Adds sessions imported from a CSV file (see planSessionImport for how they are matched). */
  const importSessions = useCallback(async (sessionsToImport: ImportedSession[]) => {
    if (!currentUser) throw new Error("Not authenticated.");
    const plan = planSessionImport(studentsRef.current, sessionsRef.current, sessionsToImport, currentUser.uid);
    const { newCount, duplicateCount, unmatchedCount, addedGoalCount } = plan;
    if (newCount === 0 && addedGoalCount === 0) return { newCount, duplicateCount, unmatchedCount, addedGoalCount };
    const next = { students: plan.students, goalTemplates: templatesRef.current, sessions: plan.sessions };
    // One transaction: new goals on the students and the sessions that use them are
    // stored together, so a quota failure cannot leave one without the other.
    if (!(await applyTransaction(next))) {
      throw new Error("The device's storage is full, so the sessions couldn't be saved.");
    }
    applyLists(next);
    return { newCount, duplicateCount, unmatchedCount, addedGoalCount };
  }, [currentUser, applyTransaction, applyLists]);

  // The refs, not React state: a backup taken right after a rapid change exports what
  // is stored, not the state from the last render.
  const exportBackup = useCallback(
    () => createBackup({ students: studentsRef.current, goalTemplates: templatesRef.current, sessions: sessionsRef.current }, { abcLists: loadCustomAbcLists() ?? undefined, studentGroups: getStudentGroups(currentUser?.uid) }),
    [currentUser],
  );

  /**
   * Restores a backup. 'replace' swaps all data on this device for the backup's; 'merge' adds the
   * backup's records that aren't already here. Returns how many records were added (merge) or loaded (replace).
   * If storage fills up part way, what was already written is put back so the three lists stay consistent.
   * The restore only reports success after every list has been written, flushed, and read back from
   * durable storage; state is not updated before that point.
   */
  const restoreBackup = useCallback(async (backup: AppBackup, mode: RestoreMode): Promise<RestoreSummary> => {
    if (!currentUser) throw new Error("Not authenticated.");
    const current = { students: studentsRef.current, goalTemplates: templatesRef.current, sessions: sessionsRef.current };

    const keys = [studentsKey, templatesKey, sessionsKey];
    const damaged = keys.filter((key): key is string => isUnreadable(key));
    if (mode === 'merge' && damaged.length > 0) {
      // Merging would keep this device's lists, but part of them couldn't be read.
      throw new Error("Some of this device's data couldn't be read, so the backup can't be added to it. Use Replace to restore the backup instead.");
    }

    const { next, summary } = planRestore(current, backup, mode);
    // Replacing is how damaged data is recovered, so those lists may be overwritten now. If storage fills
    // part way, the transaction puts each list back exactly as it was stored (damaged ones too).
    unmark(damaged);
    if (!(await applyTransaction(next))) {
      mark(damaged);
      throw new Error("The backup couldn't be saved on this device (storage is full). Nothing was changed.");
    }
    // Verify every list reads back from durable storage before declaring success. If a list does not,
    // put the previous lists back and report failure — state still holds the old data.
    try {
      await secureStore.flushWrites();
      const checks: [string | null, unknown][] = [
        [studentsKey, next.students],
        [templatesKey, next.goalTemplates],
        [sessionsKey, next.sessions],
      ];
      for (const [storageKey, expected] of checks) {
        if (storageKey && !(await secureStore.verifyStoredList(storageKey, expected))) {
          throw new Error('Restore verification failed: the restored data did not read back.');
        }
      }
    } catch (error) {
      const rolledBack = await applyTransaction(current);
      mark(damaged);
      if (!rolledBack) {
        throw new Error("The backup couldn't be verified on this device, and putting the previous data back also failed. Restore the backup again, or check the error log.");
      }
      throw new Error("The backup couldn't be verified on this device. Nothing was changed.");
    }
    if (damaged.length > 0) setError(null);
    applyLists(next);
    setSelectedStudent(null);
    // Custom ABC lists and saved groups. The student data is restored even if the ABC lists don't fit.
    restoreBackupSettings(backup, mode, currentUser?.uid, error =>
      addErrorLog({ message: `Restoring ABC lists or student groups failed: ${error instanceof Error ? error.message : String(error)}`, source: 'storage', type: 'error' }));
    // Tell the user what parseBackup had to leave out, instead of restoring silently short.
    const dropped = (backup as Partial<ParsedBackup>).droppedSettings ?? [];
    const droppedRecords = (backup as Partial<ParsedBackup>).droppedRecords ?? [];
    if (dropped.length > 0 || droppedRecords.length > 0) {
      const parts = [
        ...dropped.map(name => `the ${name === 'abcLists' ? 'ABC lists' : name === 'studentGroups' ? 'student groups' : name} settings`),
        ...droppedRecords.map(r => `a ${r.kind === 'goalTemplate' ? 'goal template' : r.kind} (${r.id})`),
      ];
      toast({
        title: 'Backup restored, but some data was left out',
        description: `These were damaged and could not be restored: ${parts.join('; ')}.`,
        variant: 'destructive',
      });
    }
    return summary;
  }, [currentUser, studentsKey, templatesKey, sessionsKey, addErrorLog, isUnreadable, unmark, mark, applyTransaction, applyLists, toast]);

  // --- End Data Actions ---

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      setSessionsLoading(true);
      return;
    }
    if (!currentUser) {
      setStudents([]);
      setTemplateList([]);
      setSessions([]);
      setSelectedStudent(null);
      setLoading(false);
      setSessionsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      // What could be read without migration, so a failure in the load below can still show the
      // data instead of leaving the app empty.
      let rawStudents: Student[] = [];
      let rawTemplates: GoalTemplate[] = [];
      let rawSessions: SessionData[] = [];
      try {
      // A list that can't be read is kept as it is in storage (never written over) and reported.
      // Hydration runs first: localStorage blobs migrate into IndexedDB (verified) and the cache
      // is filled from durable storage, so every read below sees what is actually stored.
      resetUnreadable();
      await hydrate();
      if (cancelled) return;
      rawStudents = readStored<Student>(studentsKey);
      rawTemplates = readStored<GoalTemplate>(templatesKey);
      rawSessions = readStored<SessionData>(sessionsKey);
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
        || (!isUnreadable(templatesKey) && (await saveToLocal(templatesKey, prepared.templates)));
      const nextStudents = templatesStored && prepared.linkedStudents ? prepared.linkedStudents : prepared.students;
      if ((prepared.studentsChanged || nextStudents !== prepared.students) && !isUnreadable(studentsKey)) {
        await saveToLocal(studentsKey, nextStudents);
      }
      if (cancelled) return;
      templatesRef.current = prepared.templates;
      setTemplateList(prepared.templates);
      studentsRef.current = nextStudents;
      setStudents(nextStudents);

      const localSessions = [...rawSessions].sort(byDateDesc);
      sessionsRef.current = localSessions;
      setSessions(localSessions);
      setLoading(false);
      setSessionsLoading(false);
      } catch (error) {
        // prepareLoadedData (or hydration) throwing used to surface only through the route error
        // boundary, with the app unusable. It is logged and toasted here instead, and what could
        // be read is shown unmigrated, so the data stays visible and a backup can still be taken.
        if (cancelled) return;
        addErrorLog({ message: `Loading saved data failed: ${error instanceof Error ? error.message : String(error)}`, source: 'StudentDataProvider.load', type: 'error' });
        toast({
          title: "Couldn't load your saved data",
          description: 'What could be read is shown below, without the usual updates. Check the error log, or restore a backup in Settings.',
          variant: 'destructive',
        });
        setError(error instanceof Error ? error : new Error('Loading saved data failed.'));
        templatesRef.current = rawTemplates;
        setTemplateList(rawTemplates);
        studentsRef.current = rawStudents;
        setStudents(rawStudents);
        const localSessions = [...rawSessions].sort(byDateDesc);
        sessionsRef.current = localSessions;
        setSessions(localSessions);
        setLoading(false);
        setSessionsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authLoading, currentUser, studentsKey, templatesKey, sessionsKey, saveToLocal, toast, readStored, resetUnreadable, isUnreadable, hydrate, addErrorLog]);

  // Another tab changed the data: reload the three lists from storage as they are and
  // say so. No merge is attempted — the other tab's save is the newer copy, and this
  // tab's unsaved edits are already stored (every change writes to storage first).
  // IndexedDB writes do not fire a storage event, so the other tab's verified saves also
  // post on a BroadcastChannel; the storage event still covers the localStorage-backed
  // lists and storage being cleared. Storage events only fire in other tabs, but a
  // BroadcastChannel message reaches every other channel object with the same name,
  // including one in this tab, so the listener ignores messages carrying this tab's own
  // sender id (see isOwnDataChangedMessage) instead of reloading on its own saves.
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) return;
    let lastReload = 0;
    const reload = async () => {
      const now = Date.now();
      if (now - lastReload < 1000) return; // one reload per burst of saves
      lastReload = now;
      await hydrateLists({ students: studentsKey, templates: templatesKey, sessions: sessionsKey });
      const nextStudents = readList<Student>(studentsKey);
      const nextTemplates = readList<GoalTemplate>(templatesKey);
      const nextSessions = readList<SessionData>(sessionsKey);
      if (nextStudents === undefined || nextTemplates === undefined || nextSessions === undefined) {
        toast({
          title: "Data changed in another tab, but it couldn't be reloaded",
          description: "Some of this device's data couldn't be read, so what you see here is unchanged. Restore a backup in Settings if data looks wrong.",
          variant: 'destructive',
        });
        return;
      }
      applyListsQuiet({
        students: [...nextStudents].sort(byName),
        goalTemplates: [...nextTemplates].sort(byName),
        sessions: [...nextSessions].sort(byDateDesc),
      });
      toast({ title: 'Data changed in another tab', description: 'Students, goal templates and sessions were reloaded from this device.' });
    };
    const onStorage = (event: StorageEvent) => {
      if (isMainListStorageKey(event.key, { students: studentsKey, templates: templatesKey, sessions: sessionsKey })) void reload();
    };
    window.addEventListener('storage', onStorage);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(DATA_CHANGED_CHANNEL);
        channel.onmessage = (event) => {
          if (isOwnDataChangedMessage(event.data)) return; // this tab's own save, not another tab
          void reload();
        };
      }
    } catch {
      // No channel: the storage event still covers the localStorage-backed lists.
    }
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [currentUser, studentsKey, templatesKey, sessionsKey, toast, applyListsQuiet]);
  

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
    deletedBuiltInTemplates,
    restoreBuiltInTemplates,
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
    addStudent, updateStudent, deleteStudent, deleteStudents, importStudents,
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

    