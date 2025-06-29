
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config';
import type { Student, Goal, GoalTemplate, SessionData, User, Toast, StudentSessionState, SessionGoalData, GoalType } from '@/lib/types';
import { useAuth } from './use-auth';
import { DEFAULT_GOAL_TEMPLATES, GOAL_TYPE_FIELDS, PROMPT_HOTKEY_MAP } from '@/lib/constants';
import { generateUUID } from '@/lib/helpers';
import { useToast as useShadcnToast } from "@/hooks/use-toast"; 
import { useErrorLog } from './use-error-log';
import { getActivitySuggestions } from '@/ai/flows/activity-suggestions';


const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;
const getSessionsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/sessions`;

const LOCAL_STORAGE_STUDENTS_BASE_KEY = 'ascended_students_v2';
const LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY = 'ascended_goal_templates_v2';
const LOCAL_STORAGE_SESSIONS_BASE_KEY = 'ascended_sessions_v2';

const getLocalStorageKey = (base: string, uid: string | undefined): string | null => {
  if (!uid) return null;
  return `${base}_${uid}`;
};

const getFromLocalStorage = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
};

const getDataEntryStorageKeys = (uid: string | undefined): Record<string, string | null> => {
    /**
     * Generates unique keys for storing Data Entry page state in localStorage based on the user ID.
     * This ensures that different users have their own saved state and prevents conflicts.
     *
     * @param uid - The unique ID of the current user, or undefined if not logged in.
     * @returns A record mapping state names (like DATE, TIME, etc.) to their corresponding localStorage keys (strings)
     *          or null if the user ID is undefined (indicating no keys can be generated).
     */
    if (!uid) {
        return {
            DATE: null, TIME: null, SELECTED_IDS: null, SESSION_STATES: null,
            FOCUSED_SLOT: null, FOCUSED_GOALS: null, VISIBLE_COUNTS: null, SHOW_ARCHIVED: null,
        };
    }
    const prefix = `ascended_de_v2_${uid}_`;
    return {
        DATE: `${prefix}date`,
        TIME: `${prefix}time`,
        SELECTED_IDS: `${prefix}selected_ids`,
        SESSION_STATES: `${prefix}session_states`,
        FOCUSED_SLOT: `${prefix}focused_slot`,
        FOCUSED_GOALS: `${prefix}focused_goals`,
        VISIBLE_COUNTS: `${prefix}visible_counts`,
        SHOW_ARCHIVED: `${prefix}show_archived`,
    };
};


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

  // Modal states
  isAddStudentModalOpen: boolean;
  openAddStudentModal: () => void;
  closeAddStudentModal: () => void;
  editingStudent: Student | null;
  openEditStudentModal: (student: Student) => void;
  closeEditStudentModal: () => void;
  deletingStudent: Student | null;
  openDeleteStudentModal: (student: Student | null) => void; 
  closeDeleteStudentModal: () => void;
  isAddGoalTemplateModalOpen: boolean;
  openAddGoalTemplateModal: () => void;
  closeAddGoalTemplateModal: () => void;
  editingGoalTemplate: GoalTemplate | null;
  openEditGoalTemplateModal: (template: GoalTemplate) => void;
  closeEditGoalTemplateModal: () => void;
  deletingGoalTemplate: GoalTemplate | null;
  openDeleteGoalTemplateModal: (template: GoalTemplate | null) => void; 
  closeDeleteGoalTemplateModal: () => void;
  editingSession: SessionData | null;
  openEditSessionModal: (session: SessionData) => void;
  closeEditSessionModal: () => void;
  deletingSession: SessionData | null;
  openDeleteSessionModal: (session: SessionData | null) => void; 
  closeDeleteSessionModal: () => void;
  editingAssignedGoal: { studentId: string; goal: Goal } | null;
  openEditAssignedGoalModal: (studentId: string, goal: Goal) => void;
  closeEditAssignedGoalModal: () => void;

  // Data Entry Page Persisted State and Actions
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySelectedStudentIds: string[];
  setDataEntrySelectedStudentIds: (ids: string[]) => void;
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
  resetDataEntrySession: () => void;
  handleGoalDataChange: (studentId: string, goalId: string, updatedFieldName: string, newData: SessionGoalData['data']) => void;
  handleMoveGoal: (studentId: string, goalId: string, direction: 'up' | 'down') => void;
  
  // Keyboard Shortcut Handlers
  focusStudentSlot: (slotIndex: number) => void;
  cycleFocusedStudent: (direction: 'next' | 'prev') => void;
  cycleFocusedGoal: (direction: 'next' | 'prev') => void;
  handleDataEntryHotkey: (key: string, alt: boolean) => void;
  triggerEditFocusedStudent: () => void;
  getCurrentFocusedGoalInfo: () => { studentId: string; studentState: StudentSessionState; goal: Goal; goalData: any; goalIndex: number; } | null;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export const StudentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isFirebaseAvailable: isFirebaseAuthAvailable, loading: authLoading } = useAuth();
  const { toast: shadcnToast } = useShadcnToast(); 
  const { addErrorLog } = useErrorLog();

  const [studentsState, setStudentsState] = useState<Student[]>([]);
  const [goalTemplatesState, setGoalTemplatesState] = useState<GoalTemplate[]>([]);
  const [sessionsState, setSessionsState] = useState<SessionData[]>([]);

  const [selectedStudent, setSelectedStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isFirebaseDBAvailable = isFirebaseAuthAvailable && !!firestoreDbModule;
  const APP_ID = 'default-app-id';

  // Modal states
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isAddGoalTemplateModalOpen, setIsAddGoalTemplateModalOpen] = useState(false);
  const [editingGoalTemplate, setEditingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [deletingGoalTemplate, setDeletingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionData | null>(null);
  const [editingAssignedGoal, setEditingAssignedGoal] = useState<{ studentId: string; goal: Goal } | null>(null);

  // Data Entry Page Persisted State (initialized with defaults)
  const [dataEntrySessionDate, setDataEntrySessionDateState] = useState<Date | undefined>(undefined);
  const [dataEntrySessionTime, setDataEntrySessionTimeState] = useState<string>('');
  const [dataEntrySelectedStudentIds, setDataEntrySelectedStudentIdsState] = useState<string[]>([]);
  const [dataEntryStudentSessionStates, setDataEntryStudentSessionStatesState] = useState<Record<string, StudentSessionState>>({});
  const [dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndexState] = useState<number>(0);
  const [dataEntryFocusedGoalIndexByStudentId, setDataEntryFocusedGoalIndexByStudentIdState] = useState<Record<string, number>>({});
  const [dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestionsState] = useState<Record<string, string[]>>({}); // Not persisted
  const [dataEntryVisibleGoalCountByStudentId, setDataEntryVisibleGoalCountByStudentIdState] = useState<Record<string, number>>({});
  const [dataEntryShowArchivedByStudentId, setDataEntryShowArchivedByStudentIdState] = useState<Record<string, boolean>>({});


  // Derived state for students in active slots
  const dataEntryActiveStudentsInSlots = useMemo(() => {
    return dataEntrySelectedStudentIds
      .map(id => studentsState.find(s => s.id === id))
      .filter((s): s is Student => !!s);
  }, [dataEntrySelectedStudentIds, studentsState]);

  const safeToast = useCallback((options: Omit<Toast, 'id'>) => {
    if (typeof window !== 'undefined') { 
      shadcnToast(options);
    }
  }, [shadcnToast]);

  const saveToLocal = useCallback((key: string | null, data: any) => {
    if (typeof window === 'undefined' || !key) return;
    try {
      const storableData = JSON.stringify(data);
      window.localStorage.setItem(key, storableData);
    } catch (e) {
      console.error(`Error saving to localStorage key "${key}":`, e);
      addErrorLog({
        message: `Error saving to localStorage.`,
        source: 'useStudentData.saveToLocal',
        details: (e as Error).message,
        type: 'error',
      });
    }
  }, [addErrorLog]);

  const saveStudentsToLocal = useCallback((students: Student[], uid: string | undefined) => {
    saveToLocal(getLocalStorageKey(LOCAL_STORAGE_STUDENTS_BASE_KEY, uid), students);
  }, [saveToLocal]);

  const saveTemplatesToLocal = useCallback((templates: GoalTemplate[], uid: string | undefined) => {
    const storableTemplates = templates.map(t => ({
      ...t,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    }));
    saveToLocal(getLocalStorageKey(LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY, uid), storableTemplates);
  }, [saveToLocal]);
  
  const saveSessionsToLocal = useCallback((sessions: SessionData[], uid: string | undefined) => {
    saveToLocal(getLocalStorageKey(LOCAL_STORAGE_SESSIONS_BASE_KEY, uid), sessions);
  }, [saveToLocal]);

  const seedLocalDefaultTemplates = useCallback(() => {
      const localDefaultTemplates = DEFAULT_GOAL_TEMPLATES.map(t => ({
        ...t,
        id: generateUUID(),
        createdAt: new Date(), 
        userId: currentUser?.uid || 'local-user',
      }));
      setGoalTemplatesState(localDefaultTemplates);
      if (currentUser?.uid) {
        saveTemplatesToLocal(localDefaultTemplates, currentUser.uid);
      }
      safeToast({ title: "Info", description: "Loaded default local goal templates."});
  }, [currentUser?.uid, safeToast, saveTemplatesToLocal]);
  
  // Persist Data Entry state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser?.uid) {
        const keys = getDataEntryStorageKeys(currentUser.uid);

        if (keys.DATE) localStorage.setItem(keys.DATE, JSON.stringify(dataEntrySessionDate ? dataEntrySessionDate.toISOString() : null));
        if (keys.TIME) localStorage.setItem(keys.TIME, JSON.stringify(dataEntrySessionTime));
        if (keys.SELECTED_IDS) localStorage.setItem(keys.SELECTED_IDS, JSON.stringify(dataEntrySelectedStudentIds));
        if (keys.SESSION_STATES) localStorage.setItem(keys.SESSION_STATES, JSON.stringify(dataEntryStudentSessionStates));
        if (keys.FOCUSED_SLOT) localStorage.setItem(keys.FOCUSED_SLOT, JSON.stringify(dataEntryFocusedStudentSlotIndex));
        if (keys.FOCUSED_GOALS) localStorage.setItem(keys.FOCUSED_GOALS, JSON.stringify(dataEntryFocusedGoalIndexByStudentId));
        if (keys.VISIBLE_COUNTS) localStorage.setItem(keys.VISIBLE_COUNTS, JSON.stringify(dataEntryVisibleGoalCountByStudentId));
        if (keys.SHOW_ARCHIVED) localStorage.setItem(keys.SHOW_ARCHIVED, JSON.stringify(dataEntryShowArchivedByStudentId));
    }
  }, [
    currentUser?.uid,
    dataEntrySessionDate, dataEntrySessionTime, dataEntrySelectedStudentIds,
    dataEntryStudentSessionStates, dataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId, dataEntryVisibleGoalCountByStudentId,
    dataEntryShowArchivedByStudentId
  ]);

  // Load persisted data entry state from localStorage when user is available
  useEffect(() => {
    if (currentUser?.uid) {
      const keys = getDataEntryStorageKeys(currentUser.uid);

      const storedDate = keys.DATE ? getFromLocalStorage(keys.DATE, null) : null;
      setDataEntrySessionDateState(storedDate ? new Date(storedDate) : undefined);

      const storedTime = keys.TIME ? getFromLocalStorage(keys.TIME, '') : '';
      setDataEntrySessionTimeState(storedTime);

      if (keys.SELECTED_IDS) setDataEntrySelectedStudentIdsState(getFromLocalStorage(keys.SELECTED_IDS, []));
      if (keys.SESSION_STATES) setDataEntryStudentSessionStatesState(getFromLocalStorage(keys.SESSION_STATES, {}));
      if (keys.FOCUSED_SLOT) setDataEntryFocusedStudentSlotIndexState(getFromLocalStorage(keys.FOCUSED_SLOT, 0));
      if (keys.FOCUSED_GOALS) setDataEntryFocusedGoalIndexByStudentIdState(getFromLocalStorage(keys.FOCUSED_GOALS, {}));
      if (keys.VISIBLE_COUNTS) setDataEntryVisibleGoalCountByStudentIdState(getFromLocalStorage(keys.VISIBLE_COUNTS, {}));
      if (keys.SHOW_ARCHIVED) setDataEntryShowArchivedByStudentIdState(getFromLocalStorage(keys.SHOW_ARCHIVED, {}));
    }
  }, [currentUser?.uid]);


  const seedFirebaseDefaultTemplates = useCallback(async (user: User, dbInstance: typeof firestoreDbModule) => {
    if (!user || !dbInstance) return null;
    const q = query(collection(dbInstance, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", user.uid), where("isDefault", "==", true));
    
    try {
      const existingDefaultsSnapshot = await getDocs(q);
      const templatesToSeed = DEFAULT_GOAL_TEMPLATES.filter(defaultTemplate =>
          !existingDefaultsSnapshot.docs.some(doc => doc.data().name === defaultTemplate.name)
      );

      if (templatesToSeed.length === 0) return;

      console.log("StudentData: Seeding Firebase default templates for missing ones.");
      const batch = writeBatch(dbInstance);
      for (const template of templatesToSeed) {
          const newTemplateRef = doc(collection(dbInstance, getGoalTemplatesCollectionPath(APP_ID)));
          const newTemplateData = {
            ...template,
            userId: user.uid,
            createdAt: serverTimestamp(),
            id: newTemplateRef.id, 
          };
          batch.set(newTemplateRef, newTemplateData);
      }
      await batch.commit();
      safeToast({ title: "Success", description: `${templatesToSeed.length} default Firebase goal templates seeded.` });
    } catch (e: any) {
      console.error("Error seeding Firebase default templates:", e);
      addErrorLog({ message: 'Error seeding Firebase default templates.', source: 'useStudentData.seedFirebaseDefaultTemplates', details: e.message, type: 'error' });
      safeToast({ title: "Error", description: "Could not seed Firebase default templates.", variant: "destructive" });
    }
  }, [safeToast, APP_ID, addErrorLog]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!currentUser) {
      setStudentsState([]);
      setGoalTemplatesState([]);
      setSessionsState([]);
      setSelectedStudentState(null);
      setDataEntrySessionDateState(undefined);
      setDataEntrySessionTimeState('');
      setDataEntrySelectedStudentIdsState([]);
      setDataEntryStudentSessionStatesState({});
      setDataEntryFocusedStudentSlotIndexState(0);
      setDataEntryFocusedGoalIndexByStudentIdState({});
      setDataEntryAiActivitySuggestionsState({});
      setDataEntryVisibleGoalCountByStudentIdState({});
      setDataEntryShowArchivedByStudentIdState({});
      setLoading(false);
      setSessionsLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setSessionsLoading(true);
    let unsubscribeStudents = () => {};
    let unsubscribeTemplates = () => {};
    let unsubscribeSessions = () => {};

    if (isFirebaseDBAvailable && firestoreDbModule) {
      console.log("StudentData: Operating in Firebase mode for user:", currentUser.uid);

      const studentQuery = query(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
      const templateQuery = query(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
      const sessionQuery = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));

      let studentsLoaded = false;
      let templatesLoaded = false;
      const checkEssentialFirebaseLoaded = () => {
        if (studentsLoaded && templatesLoaded) {
          setLoading(false);
          console.log("StudentData: Essential Firebase data loaded.");
        }
      };

      unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
        const studentData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Student));
        setStudentsState(studentData.sort((a,b) => a.name.localeCompare(b.name)));
        studentsLoaded = true;
        checkEssentialFirebaseLoaded();
      }, (err: Error) => {
        console.error("Error fetching students from Firebase:", err);
        setError(err); 
        addErrorLog({ message: 'Failed to load students from Firebase.', source: 'useStudentData.studentsSnapshot', details: err.message, type: 'error' });
        safeToast({ title: "Firebase Error", description: `Could not load students: ${err.message}`, variant: "destructive" });
        studentsLoaded = true; checkEssentialFirebaseLoaded();
      });

      unsubscribeTemplates = onSnapshot(templateQuery, async (snapshot) => {
        const templateData = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { id: docSnap.id, ...data, createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt) } as GoalTemplate;
        });
        setGoalTemplatesState(templateData.sort((a,b) => a.name.localeCompare(b.name)));

        const defaultTemplatesInDb = templateData.filter(t => t.isDefault && t.userId === currentUser.uid);
        if (defaultTemplatesInDb.length < DEFAULT_GOAL_TEMPLATES.length && currentUser && firestoreDbModule) {
         await seedFirebaseDefaultTemplates(currentUser, firestoreDbModule);
        }
        templatesLoaded = true;
        checkEssentialFirebaseLoaded();
      }, (err: Error) => {
        console.error("Error fetching goal templates from Firebase:", err);
        setError(err); 
        addErrorLog({ message: 'Failed to load goal templates from Firebase.', source: 'useStudentData.templatesSnapshot', details: err.message, type: 'error' });
        safeToast({ title: "Firebase Error", description: `Could not load goal templates: ${err.message}`, variant: "destructive" });
        templatesLoaded = true; checkEssentialFirebaseLoaded();
      });

      unsubscribeSessions = onSnapshot(sessionQuery, (snapshot) => {
        const sessionData = snapshot.docs.map(docSnap => ({ sessionId: docSnap.id, ...docSnap.data() } as SessionData));
        setSessionsState(sessionData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setSessionsLoading(false);
      }, (err: Error) => {
        console.error("Error fetching sessions from Firebase:", err);
        setError(err); 
        addErrorLog({ message: 'Failed to load sessions from Firebase.', source: 'useStudentData.sessionsSnapshot', details: err.message, type: 'error' });
        safeToast({ title: "Firebase Error", description: `Could not load sessions: ${err.message}`, variant: "destructive" });
        setSessionsLoading(false);
      });


    } else {
      console.log("StudentData: Operating in local data mode.");
      addErrorLog({ message: 'Operating in local data mode. Firestore DB not available.', source: 'useStudentData.init', type: 'warning' });
      try {
        const studentsKey = getLocalStorageKey(LOCAL_STORAGE_STUDENTS_BASE_KEY, currentUser.uid);
        const localStudents = studentsKey ? JSON.parse(localStorage.getItem(studentsKey) || 'null') : null;
        setStudentsState(localStudents ? localStudents.sort((a:Student,b:Student) => a.name.localeCompare(b.name)) : []);
        
        const sessionsKey = getLocalStorageKey(LOCAL_STORAGE_SESSIONS_BASE_KEY, currentUser.uid);
        const localSessions = sessionsKey ? JSON.parse(localStorage.getItem(sessionsKey) || 'null') : null;
        setSessionsState(localSessions ? localSessions.sort((a:SessionData,b:SessionData) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []);

        const templatesKey = getLocalStorageKey(LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY, currentUser.uid);
        const rawTemplates = templatesKey ? JSON.parse(localStorage.getItem(templatesKey) || 'null') : null;
        if (rawTemplates && rawTemplates.length > 0) {
          setGoalTemplatesState(rawTemplates.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })).sort((a:GoalTemplate,b:GoalTemplate) => a.name.localeCompare(b.name)));
        } else {
          seedLocalDefaultTemplates();
        }

      } catch (e) {
          console.error("Error loading data from localStorage:", e);
          addErrorLog({ message: 'Error loading data from localStorage.', source: 'useStudentData.initLocal', details: (e as Error).message, type: 'error' });
          setStudentsState([]);
          setSessionsState([]);
          seedLocalDefaultTemplates(); 
      }
      setLoading(false);
      setSessionsLoading(false);
    }

    return () => {
      unsubscribeStudents();
      unsubscribeTemplates();
      unsubscribeSessions();
    };
  }, [authLoading, currentUser, isFirebaseDBAvailable, firestoreDbModule, seedLocalDefaultTemplates, seedFirebaseDefaultTemplates, safeToast, APP_ID, addErrorLog]);

  useEffect(() => {
    setDataEntryVisibleGoalCountByStudentIdState(prevCounts => {
      const newCounts = { ...prevCounts };
      let changed = false;
      dataEntrySelectedStudentIds.forEach(id => {
        if (!(id in newCounts)) {
          newCounts[id] = 10;
          changed = true;
        }
      });
      Object.keys(newCounts).forEach(id => {
        if (!dataEntrySelectedStudentIds.includes(id)) {
          delete newCounts[id];
          changed = true;
        }
      });
      return changed ? newCounts : prevCounts;
    });

    setDataEntryShowArchivedByStudentIdState(prevShowArchived => {
        const newShowArchived = { ...prevShowArchived };
        let changed = false;
        dataEntrySelectedStudentIds.forEach(id => {
            if (!(id in newShowArchived)) {
                newShowArchived[id] = false;
                changed = true;
            }
        });
        Object.keys(newShowArchived).forEach(id => {
            if (!dataEntrySelectedStudentIds.includes(id)) {
                delete newShowArchived[id];
                changed = true;
            }
        });
        return changed ? newShowArchived : prevShowArchived;
    });

  }, [dataEntrySelectedStudentIds]);

  useEffect(() => {
    setDataEntryFocusedGoalIndexByStudentIdState(prevIndexes => {
        let focusIndexesChanged = false;
        const newFocusedGoalIndexes: Record<string, number> = { ...prevIndexes };

        dataEntrySelectedStudentIds.forEach(id => {
            const studentState = dataEntryStudentSessionStates[id];
            if (studentState) {
                const visibleGoals = studentState.originalGoalHeaders.filter(g => !g.isArchived || dataEntryShowArchivedByStudentId[id]);
                const currentFocus = newFocusedGoalIndexes[id];

                if (currentFocus === undefined && visibleGoals.length > 0) {
                    newFocusedGoalIndexes[id] = 0;
                    focusIndexesChanged = true;
                } else if (currentFocus !== undefined && currentFocus >= visibleGoals.length) {
                    newFocusedGoalIndexes[id] = Math.max(0, visibleGoals.length - 1);
                    focusIndexesChanged = true;
                } else if (visibleGoals.length === 0 && currentFocus !== undefined) {
                    delete newFocusedGoalIndexes[id];
                    focusIndexesChanged = true;
                }
            }
        });

        Object.keys(newFocusedGoalIndexes).forEach(studentId => {
            if (!dataEntrySelectedStudentIds.includes(studentId)) {
                delete newFocusedGoalIndexes[studentId];
                focusIndexesChanged = true;
            }
        });

        return focusIndexesChanged ? newFocusedGoalIndexes : prevIndexes;
    });
  }, [dataEntryStudentSessionStates, dataEntrySelectedStudentIds, dataEntryShowArchivedByStudentId]);


  const addStudent = useCallback(async (name: string): Promise<Student | null> => {
    if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      addErrorLog({ message: 'Attempted to add student without authenticated user.', source: 'useStudentData.addStudent', type: 'error' });
      return null;
    }
    const studentDataOmitId: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), userId: currentUser.uid };

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), studentDataOmitId);
        const newStudent = { id: docRef.id, ...studentDataOmitId };
        safeToast({ title: "Success", description: `Student "${name}" added.` });
        return newStudent;
      } catch (e: any) {
        console.error("Firebase addStudent error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase addStudent operation failed.', source: 'useStudentData.addStudent', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not add student.", variant: "destructive" });
        return null;
      }
    } else {
      const newStudent: Student = { id: generateUUID(), ...studentDataOmitId };
      const newStudents = [...studentsState, newStudent].sort((a,b) => a.name.localeCompare(b.name));
      setStudentsState(newStudents);
      saveStudentsToLocal(newStudents, currentUser.uid);
      setSelectedStudentState(newStudent);
      safeToast({ title: "Success", description: `Student "${name}" added locally.` });
      return newStudent;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID, addErrorLog, studentsState, saveStudentsToLocal]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Omit<Student, 'id'>>) => {
     if (!currentUser) {
      addErrorLog({ message: 'Attempted to update student without authenticated user.', source: 'useStudentData.updateStudent', type: 'error' });
      return;
    }
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId), {...data, userId: currentUser.uid});
        safeToast({ title: "Success", description: "Student updated." });
      } catch (e: any) {
        console.error("Firebase updateStudent error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase updateStudent operation failed.', source: 'useStudentData.updateStudent', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not update student.", variant: "destructive" });
      }
    } else {
      const newStudents = studentsState.map(s => s.id === studentId ? { ...s, ...data, id:s.id } as Student : s).sort((a,b) => a.name.localeCompare(b.name));
      setStudentsState(newStudents);
      saveStudentsToLocal(newStudents, currentUser.uid);

      if (selectedStudent?.id === studentId) {
        setSelectedStudentState(prev => prev ? ({ ...prev, ...data } as Student) : null);
      }
      safeToast({ title: "Success", description: "Student updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, selectedStudent, currentUser, addErrorLog, studentsState, saveStudentsToLocal]);

 const deleteStudent = useCallback(async (studentId: string) => {
    if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      addErrorLog({ message: 'Attempted to delete student without authenticated user.', source: 'useStudentData.deleteStudent', type: 'error' });
      return;
    }
    
    // Clean up data entry state before deleting the student record
    setDataEntrySelectedStudentIdsState(prevIds => prevIds.filter(id => id !== studentId));
    setDataEntryStudentSessionStatesState(prevStates => {
      const newStates = { ...prevStates };
      if (newStates[studentId]) {
        delete newStates[studentId];
      }
      return newStates;
    });

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const batchOp = writeBatch(firestoreDbModule); 

        const studentDocRef = doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId);
        batchOp.delete(studentDocRef);

        const sessionsQuery = query(
          collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)),
          where("studentId", "==", studentId),
          where("userId", "==", currentUser.uid)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        sessionsSnapshot.docs.forEach(sessionDoc => batchOp.delete(sessionDoc.ref));

        await batchOp.commit();
        safeToast({ title: "Success", description: "Student and their associated sessions deleted." });
      } catch (e: any) {
        console.error("Firebase deleteStudent and sessions error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase deleteStudent and sessions operation failed.', source: 'useStudentData.deleteStudent', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not delete student and/or their sessions.", variant: "destructive" });
      }
    } else {
      const newStudents = studentsState.filter(s => s.id !== studentId);
      setStudentsState(newStudents);
      saveStudentsToLocal(newStudents, currentUser.uid);

      const newSessions = sessionsState.filter(s => s.studentId !== studentId);
      setSessionsState(newSessions);
      saveSessionsToLocal(newSessions, currentUser.uid);

      safeToast({ title: "Success", description: "Student and their sessions deleted locally." });
    }
    if (selectedStudent?.id === studentId) setSelectedStudentState(null);
    setDeletingStudent(null); 
  }, [isFirebaseDBAvailable, firestoreDbModule, currentUser, selectedStudent, safeToast, APP_ID, addErrorLog, studentsState, sessionsState, saveStudentsToLocal, saveSessionsToLocal]);

  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { 
      safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); 
      addErrorLog({ message: 'Student not found for goal assignment.', source: 'useStudentData.assignGoalToStudent', details: `Student ID: ${studentId}`, type: 'error' });
      return; 
    }

    const newGoal = { ...goal, id: goal.id || generateUUID(), isArchived: goal.isArchived || false }; 
    const updatedGoals = [...student.goals, newGoal];

    await updateStudent(studentId, { goals: updatedGoals });
    safeToast({ title: "Success", description: `Goal "${goal.name}" assigned to ${student.name}.` });
  }, [studentsState, updateStudent, safeToast, addErrorLog]);

  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { 
      safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); 
      addErrorLog({ message: 'Student not found for goal removal.', source: 'useStudentData.removeGoalFromStudent', details: `Student ID: ${studentId}`, type: 'error' });
      return; 
    }

    const updatedGoals = student.goals.filter(g => g.id !== goalId);
    await updateStudent(studentId, { goals: updatedGoals });
    safeToast({ title: "Success", description: "Goal removed from student." });
  }, [studentsState, updateStudent, safeToast, addErrorLog]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { 
      safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); 
      addErrorLog({ message: 'Student not found for goal update.', source: 'useStudentData.updateStudentGoal', details: `Student ID: ${studentId}`, type: 'error' });
      return; 
    }

    const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...updatedGoalData } : g);
    await updateStudent(studentId, { goals: updatedGoals });
    safeToast({ title: "Success", description: `Goal "${updatedGoalData.name || 'Goal'}" updated.` });
  }, [studentsState, updateStudent, safeToast, addErrorLog]);

  const addGoalTemplate = useCallback(async (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Promise<GoalTemplate | null> => {
    if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      addErrorLog({ message: 'Attempted to add goal template without authenticated user.', source: 'useStudentData.addGoalTemplate', type: 'error' });
      return null;
    }
    const fullTemplateDataFirebase = { 
        ...templateData,
        userId: currentUser.uid,
        createdAt: serverTimestamp(), 
        isDefault: false,
    };
    const fullTemplateDataLocal = { 
        ...templateData,
        userId: currentUser.uid,
        createdAt: new Date(), 
        isDefault: false,
    };


    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), fullTemplateDataFirebase);
        safeToast({ title: "Success", description: `Template "${templateData.name}" added.` });
        return { id: docRef.id, ...templateData, userId:currentUser.uid, createdAt: new Date(), isDefault: false, sessionTargetValue: templateData.sessionTargetValue }; 
      } catch (e: any) {
        console.error("Firebase addGoalTemplate error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase addGoalTemplate operation failed.', source: 'useStudentData.addGoalTemplate', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not add goal template.", variant: "destructive" });
        return null;
      }
    } else {
      const newTemplate: GoalTemplate = { id: generateUUID(), ...fullTemplateDataLocal };
      const newTemplates = [...goalTemplatesState, newTemplate].sort((a,b) => a.name.localeCompare(b.name));
      setGoalTemplatesState(newTemplates);
      saveTemplatesToLocal(newTemplates, currentUser.uid);
      safeToast({ title: "Success", description: `Template "${templateData.name}" added locally.` });
      return newTemplate;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID, addErrorLog, goalTemplatesState, saveTemplatesToLocal]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: Partial<GoalTemplate>) => {
    if (!currentUser) {
      addErrorLog({ message: 'Attempted to update goal template without authenticated user.', source: 'useStudentData.updateGoalTemplate', type: 'error' });
      return;
    }
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const updateData: Partial<GoalTemplate> = {...data, userId: currentUser.uid};
        if (data.createdAt && !(data.createdAt instanceof Timestamp)) {
            delete updateData.createdAt; 
        }
        if (data.sessionTargetValue === undefined || data.sessionTargetValue === null || String(data.sessionTargetValue).trim() === '') {
          updateData.sessionTargetValue = undefined; 
        } else if (typeof data.sessionTargetValue === 'string') {
            updateData.sessionTargetValue = Number(data.sessionTargetValue);
        }


        await updateDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId), updateData);
        safeToast({ title: "Success", description: "Goal template updated." });
      } catch (e: any) {
        console.error("Firebase updateGoalTemplate error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase updateGoalTemplate operation failed.', source: 'useStudentData.updateGoalTemplate', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not update goal template.", variant: "destructive" });
      }
    } else {
      const newTemplates = goalTemplatesState.map(t => t.id === templateId ? { ...t, ...data, createdAt: t.createdAt } as GoalTemplate : t).sort((a,b) => a.name.localeCompare(b.name));
      setGoalTemplatesState(newTemplates);
      saveTemplatesToLocal(newTemplates, currentUser.uid);
      safeToast({ title: "Success", description: "Goal template updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, currentUser, addErrorLog, goalTemplatesState, saveTemplatesToLocal]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    const templateToDelete = goalTemplatesState.find(t => t.id === templateId);
    if (templateToDelete?.isDefault) {
        safeToast({ title: "Info", description: "Default templates cannot be deleted.", variant: "default"});
        return;
    }
    if (!currentUser) {
      addErrorLog({ message: 'Attempted to delete goal template without authenticated user.', source: 'useStudentData.deleteGoalTemplate', type: 'error' });
      return;
    }
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId));
        safeToast({ title: "Success", description: "Goal template deleted." });
      } catch (e: any) {
        console.error("Firebase deleteGoalTemplate error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase deleteGoalTemplate operation failed.', source: 'useStudentData.deleteGoalTemplate', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not delete goal template.", variant: "destructive" });
      }
    } else {
      const newTemplates = goalTemplatesState.filter(t => t.id !== templateId);
      setGoalTemplatesState(newTemplates);
      saveTemplatesToLocal(newTemplates, currentUser.uid);
      safeToast({ title: "Success", description: "Goal template deleted locally." });
    }
     setDeletingGoalTemplate(null); 
  }, [isFirebaseDBAvailable, goalTemplatesState, safeToast, APP_ID, currentUser, addErrorLog, saveTemplatesToLocal]);

  const addSession = useCallback(async (sessionDataOmitId: Omit<SessionData, 'sessionId'>): Promise<SessionData | null> => {
     if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated for saving session.", variant: "destructive" });
      addErrorLog({ message: 'Attempted to add session without authenticated user.', source: 'useStudentData.addSession', type: 'error' });
      return null;
    }
    const sessionDataWithUser = { ...sessionDataOmitId, userId: currentUser.uid };

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), sessionDataWithUser);
        safeToast({ title: "Success", description: "Session saved." });
        return { sessionId: docRef.id, ...sessionDataWithUser };
      } catch (e: any) {
        console.error("Firebase addSession error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase addSession operation failed.', source: 'useStudentData.addSession', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not save session to Firebase.", variant: "destructive" });
        return null;
      }
    } else {
      const newSession: SessionData = { ...sessionDataWithUser, sessionId: generateUUID() };
      const newSessions = [newSession, ...sessionsState].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessionsState(newSessions);
      saveSessionsToLocal(newSessions, currentUser.uid);
      safeToast({ title: "Success", description: "Session saved locally." });
      return newSession;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID, addErrorLog, sessionsState, saveSessionsToLocal]);

  const updateSession = useCallback(async (sessionId: string, data: Partial<SessionData>) => {
    if (!currentUser) {
      addErrorLog({ message: 'Attempted to update session without authenticated user.', source: 'useStudentData.updateSession', type: 'error' });
      return;
    }
    if (isFirebaseDBAvailable && firestoreDbModule) {
       try {
        await updateDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId), {...data, userId: currentUser.uid});
        safeToast({ title: "Success", description: "Session updated." });
      } catch (e: any) {
        console.error("Firebase updateSession error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase updateSession operation failed.', source: 'useStudentData.updateSession', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not update session in Firebase.", variant: "destructive" });
      }
    } else {
      const newSessions = sessionsState.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessionsState(newSessions);
      saveSessionsToLocal(newSessions, currentUser.uid);
      safeToast({ title: "Success", description: "Session updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, currentUser, addErrorLog, sessionsState, saveSessionsToLocal]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser) {
      addErrorLog({ message: 'Attempted to delete session without authenticated user.', source: 'useStudentData.deleteSession', type: 'error' });
      return;
    }
     if (isFirebaseDBAvailable && firestoreDbModule) {
        try {
        await deleteDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId));
        safeToast({ title: "Success", description: "Session deleted." });
      } catch (e: any) {
        console.error("Firebase deleteSession error:", e);
        setError(e as Error);
        addErrorLog({ message: 'Firebase deleteSession operation failed.', source: 'useStudentData.deleteSession', details: e.message, type: 'error' });
        safeToast({ title: "Error", description: "Could not delete session from Firebase.", variant: "destructive" });
      }
    } else {
      const newSessions = sessionsState.filter(s => s.sessionId !== sessionId);
      setSessionsState(newSessions);
      saveSessionsToLocal(newSessions, currentUser.uid);
      safeToast({ title: "Success", description: "Session deleted locally." });
    }
    setDeletingSession(null); 
  }, [isFirebaseDBAvailable, safeToast, APP_ID, currentUser, addErrorLog, sessionsState, saveSessionsToLocal]);

  const getSessionsForStudent = useCallback((studentId: string) => {
    return sessionsState.filter(s => s.studentId === studentId);
  }, [sessionsState]);

  const openAddStudentModal = useCallback(() => setIsAddStudentModalOpen(true), []);
  const closeAddStudentModal = useCallback(() => setIsAddStudentModalOpen(false), []);
  const openEditStudentModal = useCallback((student: Student) => setEditingStudent(student), []);
  const closeEditStudentModal = useCallback(() => setEditingStudent(null), []);
  const openDeleteStudentModal = useCallback((student: Student | null) => setDeletingStudent(student), []);
  const closeDeleteStudentModal = useCallback(() => setDeletingStudent(null), []);
  const openAddGoalTemplateModal = useCallback(() => setIsAddGoalTemplateModalOpen(true), []);
  const closeAddGoalTemplateModal = useCallback(() => setIsAddGoalTemplateModalOpen(false), []);
  const openEditGoalTemplateModal = useCallback((template: GoalTemplate) => setEditingGoalTemplate(template), []);
  const closeEditGoalTemplateModal = useCallback(() => setEditingGoalTemplate(null), []);
  const openDeleteGoalTemplateModal = useCallback((template: GoalTemplate | null) => setDeletingGoalTemplate(template), []);
  const closeDeleteGoalTemplateModal = useCallback(() => setDeletingGoalTemplate(null), []);
  const openEditSessionModal = useCallback((session: SessionData) => setEditingSession(session), []);
  const closeEditSessionModal = useCallback(() => setEditingSession(null), []);
  const openDeleteSessionModal = useCallback((session: SessionData | null) => setDeletingSession(session), []);
  const closeDeleteSessionModal = useCallback(() => setDeletingSession(null), []);
  const openEditAssignedGoalModal = useCallback((studentId: string, goal: Goal) => setEditingAssignedGoal({ studentId, goal }), []);
  const closeEditAssignedGoalModal = useCallback(() => setEditingAssignedGoal(null), []);

  // #region Data Entry Actions and Handlers
  const fetchAiActivitySuggestions = useCallback(async (studentId: string) => {
    const studentState = dataEntryStudentSessionStates[studentId];
    const activeGoals = studentState?.originalGoalHeaders.filter(g => !g.isArchived);

    if (!studentState || !activeGoals || activeGoals.length === 0) {
      safeToast({ title: "Info", description: "Student has no active goals assigned or data is missing.", variant: "default" });
      return;
    }
    try {
      const goalDescriptions = activeGoals.map(g => `${g.name} (${g.type})`).join(', ');
      const studentProgressSummary = `Currently working on: ${goalDescriptions}. Recent activity: ${studentState.activity}. Notes: ${studentState.notes}`;
      const studentSessions = getSessionsForStudent(studentId);
      const sessionHistorySummary = studentSessions.slice(0,3).map(s => `Date: ${s.date}, Activity: ${s.activity}`).join('\n');

      const result = await getActivitySuggestions({
        goal: goalDescriptions,
        studentProgress: studentProgressSummary,
        sessionHistory: sessionHistorySummary,
      });
      setDataEntryAiActivitySuggestionsState(prev => ({ ...prev, [studentId]: result.suggestions }));
      safeToast({ title: "AI Suggestions", description: `Found ${result.suggestions.length} activities. Reasoning: ${result.reasoning}` });
    } catch (error: any) {
      console.error("Error fetching AI activity suggestions:", error);
      addErrorLog({ message: 'Failed to fetch AI activity suggestions.', source: 'DataEntryPage.fetchAiActivitySuggestions', details: error.message, type: 'error' });
      safeToast({ title: "AI Error", description: "Could not fetch activity suggestions.", variant: "destructive" });
    }
  }, [dataEntryStudentSessionStates, getSessionsForStudent, addErrorLog, safeToast]);

  const saveDataEntrySession = useCallback(async () => {
    if (!dataEntrySessionDate) {
        safeToast({ title: "Error", description: "Please select a date.", variant: "destructive"});
        return;
    }

    if (dataEntrySelectedStudentIds.length === 0 || dataEntryFocusedStudentSlotIndex >= dataEntrySelectedStudentIds.length) {
        safeToast({ title: "Error", description: "Please select a student to save a session for.", variant: "destructive"});
        return;
    }

    const focusedStudentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    if (!focusedStudentId) {
        safeToast({ title: "Error", description: "No student is currently focused.", variant: "destructive"});
        return;
    }

    const state = dataEntryStudentSessionStates[focusedStudentId];
    if (!state) {
        safeToast({ title: "Error", description: "Session data for the focused student is missing.", variant: "destructive"});
        addErrorLog({ message: 'Session state missing for focused student on save.', source: 'useStudentData.saveDataEntrySession', details: `Student ID: ${focusedStudentId}`, type: 'error' });
        return;
    }
    
    const sessionGoals: SessionGoalData[] = state.originalGoalHeaders
    .filter(goal => !goal.isArchived) 
    .map(goal => ({
        goalId: goal.id,
        goalName: goal.name,
        goalType: goal.type,
        data: state.goalData[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type])),
    }));

    if (sessionGoals.length === 0) { 
        safeToast({ title: "Info", description: `Cannot save for ${state.studentName}, no active goals with data.`, variant: "default" });
        return;
    }

    const session: Omit<SessionData, 'sessionId'> = {
        studentId: state.studentId,
        studentName: state.studentName,
        date: dataEntrySessionDate.toISOString(),
        time: dataEntrySessionTime,
        activity: state.activity,
        notes: state.notes,
        goals: sessionGoals,
        originalGoalHeaders: state.originalGoalHeaders, 
    };

    const savedSession = await addSession(session);
    
    if (savedSession) {
        safeToast({ title: "Success", description: `Session for ${state.studentName} saved.`});
        // Reset state for the saved student
        setDataEntryStudentSessionStatesState(prevStates => {
            const newStates = { ...prevStates };
            if (newStates[focusedStudentId]) {
                const studentState = newStates[focusedStudentId];
                studentState.activity = '';
                studentState.notes = '';
                const initialGoalData: Record<string, SessionGoalData['data']> = {};
                studentState.originalGoalHeaders.forEach(goal => {
                    initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                });
                studentState.goalData = initialGoalData;
            }
            return newStates;
        });
    }
  }, [
      dataEntrySessionDate, 
      dataEntrySessionTime, 
      dataEntrySelectedStudentIds, 
      dataEntryFocusedStudentSlotIndex, 
      dataEntryStudentSessionStates, 
      addSession, 
      safeToast, 
      addErrorLog
  ]);

  const resetDataEntrySession = useCallback(() => {
    if (dataEntrySelectedStudentIds.length === 0 || dataEntryFocusedStudentSlotIndex >= dataEntrySelectedStudentIds.length) {
        safeToast({ title: "Info", description: "No student is focused to reset data for.", variant: "default" });
        return;
    }
    const focusedStudentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    
    setDataEntryStudentSessionStatesState(prevStates => {
        const newStates = { ...prevStates };
        if (newStates[focusedStudentId]) {
            const studentState = newStates[focusedStudentId];
            studentState.activity = '';
            studentState.notes = '';
            if (studentState.originalGoalHeaders) {
                const initialGoalData: Record<string, SessionGoalData['data']> = {};
                studentState.originalGoalHeaders.forEach(goal => {
                    initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                });
                studentState.goalData = initialGoalData;
            }
        }
        return newStates;
    });
    
    safeToast({ title: "Data Reset", description: `Current unsaved data for the focused student has been reset.` });
  }, [
      dataEntrySelectedStudentIds, 
      dataEntryFocusedStudentSlotIndex, 
      safeToast
  ]);

  const handleGoalDataChange = useCallback((studentId: string, goalId: string, updatedFieldName: string, newData: SessionGoalData['data']) => {
    setDataEntryStudentSessionStatesState(prevStates => {
      const studentState = prevStates[studentId];
      if (!studentState) return prevStates;
      const goal = studentState.originalGoalHeaders.find(g => g.id === goalId);
      if (!goal || (goal.isArchived && !(dataEntryShowArchivedByStudentId[studentId]))) return prevStates; 

      let processedData = { ...newData };

      if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') {
        let newTotalSyllables = Math.max(0, Number(processedData.totalSyllables || 0));
        let newStutteredSyllables = Math.max(0, Number(processedData.stutteredSyllables || 0));
        if (updatedFieldName === 'stutteredSyllables') {
          newTotalSyllables = Math.max(newTotalSyllables, newStutteredSyllables);
        } else if (updatedFieldName === 'totalSyllables') {
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

    const studentSlotIndex = dataEntrySelectedStudentIds.indexOf(studentId);
    if (studentSlotIndex !== -1) {
      setDataEntryFocusedStudentSlotIndexState(studentSlotIndex);
    }
  }, [dataEntrySelectedStudentIds, dataEntryShowArchivedByStudentId]);
  
  const handleMoveGoal = useCallback((studentId: string, goalId: string, direction: 'up' | 'down') => {
    setDataEntryStudentSessionStatesState(prevStates => {
      const studentState = prevStates[studentId];
      if (!studentState) return prevStates;

      const goals = [...studentState.originalGoalHeaders];
      const goalIndex = goals.findIndex(g => g.id === goalId);

      if (goalIndex === -1) return prevStates;

      const newIndex = direction === 'up' ? goalIndex - 1 : goalIndex + 1;

      if (newIndex < 0 || newIndex >= goals.length) return prevStates;

      const [movedGoal] = goals.splice(goalIndex, 1);
      goals.splice(newIndex, 0, movedGoal);

      setDataEntryFocusedGoalIndexByStudentIdState(prevFocused => {
        const visibleGoals = goals.filter(g => !g.isArchived || dataEntryShowArchivedByStudentId[studentId]);
        const newFocusedIndexInVisible = visibleGoals.findIndex(g => g.id === goalId); 

        return { ...prevFocused, [studentId]: newFocusedIndexInVisible !== -1 ? newFocusedIndexInVisible : 0 };
      });

      return {
        ...prevStates,
        [studentId]: {
          ...studentState,
          originalGoalHeaders: goals,
        },
      };
    });
  }, [dataEntryShowArchivedByStudentId]);

  // #endregion

  // #region Keyboard Shortcut Handlers
  const getCurrentFocusedGoalInfo = useCallback(() => {
    if (dataEntrySelectedStudentIds.length === 0 || dataEntryFocusedStudentSlotIndex >= dataEntrySelectedStudentIds.length) {
      return null;
    }
    const studentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
    const studentState = dataEntryStudentSessionStates[studentId];
     if (!studentState || !studentState.originalGoalHeaders) {
      return { studentId, studentState: studentState || null, goal: null, goalData: null, goalIndex: -1 };
    }

    const visibleGoals = studentState.originalGoalHeaders.filter(g => !g.isArchived || dataEntryShowArchivedByStudentId[studentId]);
    if (visibleGoals.length === 0) {
        return { studentId, studentState, goal: null, goalData: null, goalIndex: -1 };
    }

    const goalIndexInVisibleList = dataEntryFocusedGoalIndexByStudentId[studentId] ?? 0;
    const validGoalIndexInVisibleList = Math.min(Math.max(goalIndexInVisibleList, 0), visibleGoals.length > 0 ? visibleGoals.length - 1 : 0);


    if (visibleGoals.length === 0 || validGoalIndexInVisibleList < 0) {
        return { studentId, studentState, goal: null, goalData: null, goalIndex: -1 };
    }
    
    const goal = visibleGoals[validGoalIndexInVisibleList];
    if (!goal) {
        return { studentId, studentState, goal: null, goalData: null, goalIndex: -1 };
    }
    const goalData = studentState.goalData[goal.id];
    return { studentId, studentState, goal, goalData, goalIndex: validGoalIndexInVisibleList };
  }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, dataEntryStudentSessionStates, dataEntryFocusedGoalIndexByStudentId, dataEntryShowArchivedByStudentId]);
  
  const focusStudentSlot = useCallback((slotIndex: number) => {
    if (slotIndex < dataEntrySelectedStudentIds.length) {
      setDataEntryFocusedStudentSlotIndexState(slotIndex);
    }
  }, [dataEntrySelectedStudentIds.length]);

  const cycleFocusedStudent = useCallback((direction: 'next' | 'prev') => {
    const numSlots = dataEntryActiveStudentsInSlots.length;
    if (numSlots > 0) {
      if (direction === 'prev') {
        setDataEntryFocusedStudentSlotIndexState(prev => (prev - 1 + numSlots) % numSlots);
      } else {
        setDataEntryFocusedStudentSlotIndexState(prev => (prev + 1) % numSlots);
      }
    }
  }, [dataEntryActiveStudentsInSlots]);

  const cycleFocusedGoal = useCallback((direction: 'next' | 'prev') => {
    const focusedInfo = getCurrentFocusedGoalInfo();
    if (!focusedInfo || !focusedInfo.studentId) return;

    const { studentId, studentState, goalIndex } = focusedInfo;
    const visibleGoals = studentState.originalGoalHeaders.filter(g => !g.isArchived || dataEntryShowArchivedByStudentId[studentId]);

    const numVisibleGoals = visibleGoals.length;
    if (numVisibleGoals > 0) {
      const nextIndex = direction === 'prev' ? (goalIndex - 1 + numVisibleGoals) % numVisibleGoals : (goalIndex + 1) % numVisibleGoals;
      setDataEntryFocusedGoalIndexByStudentIdState(prev => ({ ...prev, [studentId]: nextIndex }));
    }
  }, [getCurrentFocusedGoalInfo, dataEntryShowArchivedByStudentId]);
  
  const triggerEditFocusedStudent = useCallback(() => {
    if (dataEntrySelectedStudentIds.length > 0 && dataEntryFocusedStudentSlotIndex < dataEntrySelectedStudentIds.length) {
      const focusedStudentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
      const studentToEdit = studentsState.find(s => s.id === focusedStudentId);
      if (studentToEdit) {
        openEditStudentModal(studentToEdit);
      }
    }
  }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, studentsState, openEditStudentModal]);

  const handleDataEntryHotkey = useCallback((key: string, alt: boolean) => {
    const focusedInfo = getCurrentFocusedGoalInfo();
    if (!focusedInfo || !focusedInfo.goal || !focusedInfo.goalData || focusedInfo.goal.isArchived) return; 

    const { studentId, goal, goalData } = focusedInfo;

    const promptToUpdate = PROMPT_HOTKEY_MAP[key];

    if (promptToUpdate) {
      const currentPromptCount = Number(goalData[promptToUpdate] || 0);
      const newPromptValue = alt ? Math.max(0, currentPromptCount - 1) : currentPromptCount + 1;

      let updatedDataForField = { ...goalData, [promptToUpdate]: newPromptValue };

      if (promptToUpdate === 'Independent') {
          const isIncrementingPrompt = !alt;
          const canDecrementCorrectField = alt && currentPromptCount > 0; 
          
          if (isIncrementingPrompt || canDecrementCorrectField) {
              const incrementAmount = isIncrementingPrompt ? 1 : -1;
              switch(goal.type) {
                  case 'ARTICULATION': updatedDataForField.correct = Math.max(0, (Number(goalData.correct) || 0) + incrementAmount); break;
                  case 'LANGUAGE_COMPREHENSION': updatedDataForField.questionsCorrect = Math.max(0, (Number(goalData.questionsCorrect) || 0) + incrementAmount); break;
                  case 'LANGUAGE_EXPRESSION': updatedDataForField.successfulResponses = Math.max(0, (Number(goalData.successfulResponses) || 0) + incrementAmount); break;
                  case 'PHONOLOGICAL_PROCESSES': updatedDataForField.correctProductions = Math.max(0, (Number(goalData.correctProductions) || 0) + incrementAmount); break;
              }
          }
      }
      handleGoalDataChange(studentId, goal.id, promptToUpdate, updatedDataForField);
      return;
    }

    if (goal.type === 'QUALITATIVE_OBSERVATION' && !alt) {
      if (key === 'C') {
        const currentRating = Number(goalData.rating ?? 3);
        const newRating = Math.min(5, currentRating + 1);
        handleGoalDataChange(studentId, goal.id, 'rating', { ...goalData, rating: newRating });
        return;
      } else if (key === 'N') {
        const currentRating = Number(goalData.rating ?? 3);
        const newRating = Math.max(1, currentRating - 1);
        handleGoalDataChange(studentId, goal.id, 'rating', { ...goalData, rating: newRating });
        return;
      }
    }

    let fieldToUpdate: string | null = null;
    let increment = alt ? -1 : 1;

    if (key === 'C') {
      if (goal.type === 'ARTICULATION') fieldToUpdate = 'correct';
      else if (goal.type === 'LANGUAGE_COMPREHENSION') fieldToUpdate = 'questionsCorrect';
      else if (goal.type === 'LANGUAGE_EXPRESSION') fieldToUpdate = 'successfulResponses';
      else if (goal.type === 'PHONOLOGICAL_PROCESSES') fieldToUpdate = 'correctProductions';
      else if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') fieldToUpdate = 'totalSyllables';
      else if (goal.type === 'FEEDING_SWALLOWING') fieldToUpdate = 'trialsAccepted';
      else if (goal.type === 'SEQUENCED_TRIALS') fieldToUpdate = 'successfulAttempts';
    } else if (key === 'N') {
      if (goal.type === 'ARTICULATION') fieldToUpdate = 'incorrect';
      else if (goal.type === 'LANGUAGE_COMPREHENSION') fieldToUpdate = 'questionsIncorrect';
      else if (goal.type === 'LANGUAGE_EXPRESSION') fieldToUpdate = 'unsuccessfulResponses';
      else if (goal.type === 'PHONOLOGICAL_PROCESSES') fieldToUpdate = 'incorrectProductions';
      else if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') fieldToUpdate = 'stutteredSyllables';
      else if (goal.type === 'FEEDING_SWALLOWING') fieldToUpdate = 'trialsRefused';
      else if (goal.type === 'SEQUENCED_TRIALS') fieldToUpdate = 'failedAttempts';
    }

    if (fieldToUpdate) {
      const currentValue = Number(goalData[fieldToUpdate] || 0);
      const newValue = Math.max(0, currentValue + increment);
      handleGoalDataChange(studentId, goal.id, fieldToUpdate, { ...goalData, [fieldToUpdate]: newValue });
    }
  }, [getCurrentFocusedGoalInfo, handleGoalDataChange]);
  // #endregion

  const setDataEntrySessionDate = useCallback((date: Date | undefined) => setDataEntrySessionDateState(date), []);
  const setDataEntrySessionTime = useCallback((time: string) => setDataEntrySessionTimeState(time), []);
  const setDataEntrySelectedStudentIds = useCallback((ids: string[]) => setDataEntrySelectedStudentIdsState(ids), []);
  const setDataEntryFocusedStudentSlotIndex = useCallback((index: number) => setDataEntryFocusedStudentSlotIndexState(index), []);
  const setDataEntryAiActivitySuggestions = useCallback((suggestions: Record<string, string[]>) => setDataEntryAiActivitySuggestionsState(suggestions), []);
  const setDataEntryVisibleGoalCountByStudentId = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => setDataEntryVisibleGoalCountByStudentIdState(updater), []);
  const setDataEntryShowArchivedByStudentId = useCallback((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => setDataEntryShowArchivedByStudentIdState(updater), []);


  const contextValue = useMemo(() => ({
    students: studentsState,
    goalTemplates: goalTemplatesState,
    sessions: sessionsState,
    selectedStudent,
    setSelectedStudent: setSelectedStudentState,
    loading,
    sessionsLoading,
    error,
    isFirebaseDBAvailable,
    addStudent, updateStudent, deleteStudent, assignGoalToStudent, removeGoalFromStudent, updateStudentGoal,
    addGoalTemplate, updateGoalTemplate, deleteGoalTemplate,
    addSession, updateSession, deleteSession, getSessionsForStudent,
    isAddStudentModalOpen, openAddStudentModal, closeAddStudentModal,
    editingStudent, openEditStudentModal, closeEditStudentModal,
    deletingStudent, openDeleteStudentModal, closeDeleteStudentModal,
    isAddGoalTemplateModalOpen, openAddGoalTemplateModal, closeAddGoalTemplateModal,
    editingGoalTemplate, openEditGoalTemplateModal, closeEditGoalTemplateModal,
    deletingGoalTemplate, openDeleteGoalTemplateModal, closeDeleteGoalTemplateModal,
    editingSession, openEditSessionModal, closeEditSessionModal,
    deletingSession, openDeleteSessionModal, closeDeleteSessionModal,
    editingAssignedGoal, openEditAssignedGoalModal, closeEditAssignedGoalModal,
    dataEntrySessionDate, setDataEntrySessionDate,
    dataEntrySessionTime, setDataEntrySessionTime,
    dataEntrySelectedStudentIds, setDataEntrySelectedStudentIds,
    dataEntryActiveStudentsInSlots,
    dataEntryStudentSessionStates, setDataEntryStudentSessionStates: setDataEntryStudentSessionStatesState,
    dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId, setDataEntryFocusedGoalIndexByStudentId: setDataEntryFocusedGoalIndexByStudentIdState,
    dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestions,
    dataEntryVisibleGoalCountByStudentId, setDataEntryVisibleGoalCountByStudentId,
    dataEntryShowArchivedByStudentId, setDataEntryShowArchivedByStudentId,
    fetchAiActivitySuggestions, saveDataEntrySession, resetDataEntrySession, handleGoalDataChange, handleMoveGoal,
    focusStudentSlot, cycleFocusedStudent, cycleFocusedGoal, handleDataEntryHotkey, triggerEditFocusedStudent, getCurrentFocusedGoalInfo
  }), [
    studentsState, goalTemplatesState, sessionsState, selectedStudent, loading, sessionsLoading, error, isFirebaseDBAvailable,
    addStudent, updateStudent, deleteStudent, assignGoalToStudent, removeGoalFromStudent, updateStudentGoal,
    addGoalTemplate, updateGoalTemplate, deleteGoalTemplate,
    addSession, updateSession, deleteSession, getSessionsForStudent,
    isAddStudentModalOpen, openAddStudentModal, closeAddStudentModal,
    editingStudent, openEditStudentModal, closeEditStudentModal,
    deletingStudent, openDeleteStudentModal, closeDeleteStudentModal,
    isAddGoalTemplateModalOpen, openAddGoalTemplateModal, closeAddGoalTemplateModal,
    editingGoalTemplate, openEditGoalTemplateModal, closeEditGoalTemplateModal,
    deletingGoalTemplate, openDeleteGoalTemplateModal, closeDeleteGoalTemplateModal,
    editingSession, openEditSessionModal, closeEditSessionModal,
    deletingSession, openDeleteSessionModal, closeDeleteSessionModal,
    editingAssignedGoal, openEditAssignedGoalModal, closeEditAssignedGoalModal,
    dataEntrySessionDate, setDataEntrySessionDate,
    dataEntrySessionTime, setDataEntrySessionTime,
    dataEntrySelectedStudentIds, setDataEntrySelectedStudentIds,
    dataEntryActiveStudentsInSlots,
    dataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId,
    dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestions,
    dataEntryVisibleGoalCountByStudentId, setDataEntryVisibleGoalCountByStudentId,
    dataEntryShowArchivedByStudentId, setDataEntryShowArchivedByStudentId,
    fetchAiActivitySuggestions, saveDataEntrySession, resetDataEntrySession, handleGoalDataChange, handleMoveGoal,
    focusStudentSlot, cycleFocusedStudent, cycleFocusedGoal, handleDataEntryHotkey, triggerEditFocusedStudent, getCurrentFocusedGoalInfo
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
