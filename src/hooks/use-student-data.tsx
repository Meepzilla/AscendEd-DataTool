
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { useToast as useShadcnToast } from "@/hooks/use-toast";
import { useErrorLog } from './use-error-log';
import type { Student, Goal, GoalTemplate, SessionData, SessionGoalData, User } from '@/lib/types';
import { useModalState } from './use-modal-state';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/goal-constants';
import { generateUUID } from '@/lib/helpers';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import { getActivitySuggestions as getAiActivitySuggestions } from '@/ai/flows/activity-suggestions';

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
  isFirebaseDBAvailable: boolean;
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

  addSession: (sessionData: Omit<SessionData, 'sessionId'>) => Promise<SessionData | null>;
  updateSession: (sessionId: string, data: Partial<SessionData>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  getSessionsForStudent: (studentId: string) => SessionData[];
  importSessions: (sessionsToImport: Omit<SessionData, 'sessionId'>[]) => Promise<{ newCount: number; duplicateCount: number; }>;

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

const APP_ID = 'default-app-id';
const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;
const getSessionsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/sessions`;


export const StudentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isFirebaseAvailable: isFirebaseAuthAvailable, loading: authLoading } = useAuth();
  const { toast } = useShadcnToast();
  const { addErrorLog } = useErrorLog();
  
  const isFirebaseDBAvailable = isFirebaseAuthAvailable && !!firestoreDbModule;

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
    if (isFirebaseDBAvailable) {
        try {
            const docRef = await addDoc(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), newStudent);
            toast({ title: "Success", description: `Student "${name}" added.` });
            return { id: docRef.id, ...newStudent };
        } catch (e: any) { addErrorLog({ message: 'Firebase addStudent failed.', details: e.message, type: 'error' }); return null; }
    } else {
        const studentWithId = { ...newStudent, id: generateUUID()};
        const newStudents = [...students, studentWithId].sort((a,b) => a.name.localeCompare(b.name));
        setStudents(newStudents);
        saveToLocal(studentsKey, newStudents);
        toast({ title: "Success", description: "Student added locally." });
        return studentWithId;
    }
  }, [currentUser, isFirebaseDBAvailable, students, studentsKey, toast, addErrorLog, saveToLocal]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Student>) => {
      if (!currentUser) return;
      const updatedData = { ...data, updatedAt: new Date().toISOString() };
      if (isFirebaseDBAvailable) {
          try {
              await updateDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId), { ...updatedData, userId: currentUser.uid });
              toast({ title: "Success", description: "Student updated." });
          } catch (e: any) { addErrorLog({ message: 'Firebase updateStudent failed.', details: e.message, type: 'error' }); }
      } else {
          const updatedStudents = students.map(s => s.id === studentId ? { ...s, ...updatedData } : s).sort((a,b) => a.name.localeCompare(b.name));
          setStudents(updatedStudents);
          saveToLocal(studentsKey, updatedStudents);
          toast({ title: "Success", description: "Student updated locally." });
      }
  }, [currentUser, isFirebaseDBAvailable, students, studentsKey, toast, addErrorLog, saveToLocal]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (!currentUser) return;
    if (isFirebaseDBAvailable) {
      try {
          const batch = writeBatch(firestoreDbModule);
          batch.delete(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId));
          const sessionsQuery = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("studentId", "==", studentId), where("userId", "==", currentUser.uid));
          const sessionsSnap = await getDocs(sessionsQuery);
          sessionsSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          toast({ title: "Success", description: "Student and sessions deleted." });
      } catch (e: any) { addErrorLog({ message: 'Firebase deleteStudent failed.', details: e.message, type: 'error' }); }
    } else {
        const newStudents = students.filter(s => s.id !== studentId);
        setStudents(newStudents);
        saveToLocal(studentsKey, newStudents);
        const newSessions = sessions.filter(s => s.studentId !== studentId);
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Student deleted locally." });
    }
  }, [currentUser, isFirebaseDBAvailable, students, sessions, studentsKey, sessionsKey, toast, addErrorLog, saveToLocal]);

  const addGoalTemplate = useCallback(async (templateData: any) => {
    if (!currentUser) return null;
    const newTemplate = { ...templateData, userId: currentUser.uid, isDefault: false };
     if (isFirebaseDBAvailable) {
        try {
            const docRef = await addDoc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), { ...newTemplate, createdAt: serverTimestamp() });
            toast({ title: "Success", description: `Template "${templateData.name}" added.` });
            return { id: docRef.id, ...newTemplate, createdAt: new Date() };
        } catch (e: any) { addErrorLog({ message: 'Firebase addGoalTemplate failed.', details: e.message, type: 'error' }); return null; }
    } else {
        const templateWithId = { ...newTemplate, id: generateUUID(), createdAt: new Date() };
        const newTemplates = [...goalTemplates, templateWithId].sort((a,b) => a.name.localeCompare(b.name));
        setGoalTemplates(newTemplates);
        saveToLocal(templatesKey, newTemplates);
        toast({ title: "Success", description: "Template added locally." });
        return templateWithId;
    }
  }, [currentUser, isFirebaseDBAvailable, goalTemplates, templatesKey, toast, addErrorLog, saveToLocal]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
      if (!currentUser) return;
      if(isFirebaseDBAvailable) {
          try {
              await updateDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId), { ...data, userId: currentUser.uid });
              toast({ title: "Success", description: "Goal template updated." });
          } catch (e: any) { addErrorLog({ message: 'Firebase updateGoalTemplate failed.', details: e.message, type: 'error' }); }
      } else {
          const updatedTemplates = goalTemplates.map(t => t.id === templateId ? { ...t, ...data } : t).sort((a,b) => a.name.localeCompare(b.name));
          setGoalTemplates(updatedTemplates);
          saveToLocal(templatesKey, updatedTemplates);
          toast({ title: "Success", description: "Template updated locally." });
      }
  }, [currentUser, isFirebaseDBAvailable, goalTemplates, templatesKey, toast, addErrorLog, saveToLocal]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    if (!currentUser) return;
    if (isFirebaseDBAvailable) {
      try {
          await deleteDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId));
          toast({ title: "Success", description: "Goal template deleted." });
      } catch (e: any) { addErrorLog({ message: 'Firebase deleteGoalTemplate failed.', details: e.message, type: 'error' }); }
    } else {
        const newTemplates = goalTemplates.filter(t => t.id !== templateId);
        setGoalTemplates(newTemplates);
        saveToLocal(templatesKey, newTemplates);
        toast({ title: "Success", description: "Template deleted locally." });
    }
  }, [currentUser, isFirebaseDBAvailable, goalTemplates, templatesKey, toast, addErrorLog, saveToLocal]);

  const addSession = useCallback(async (sessionData: any) => {
    if (!currentUser) return null;
    const newSession = { ...sessionData, userId: currentUser.uid };
    if (isFirebaseDBAvailable) {
        try {
            const docRef = await addDoc(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), newSession);
            // Don't toast here; handled by consumer
            return { sessionId: docRef.id, ...newSession };
        } catch (e: any) { addErrorLog({ message: 'Firebase addSession failed.', details: e.message, type: 'error' }); return null; }
    } else {
        const sessionWithId = { ...newSession, sessionId: generateUUID() };
        const newSessions = [sessionWithId, ...sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        // Don't toast here; handled by consumer
        return sessionWithId;
    }
  }, [currentUser, isFirebaseDBAvailable, sessions, sessionsKey, addErrorLog, saveToLocal]);

  const updateSession = useCallback(async (sessionId: string, data: any) => {
    if (!currentUser) return;
    if (isFirebaseDBAvailable) {
      try {
          await updateDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId), { ...data, userId: currentUser.uid });
          toast({ title: "Success", description: "Session updated." });
      } catch (e: any) { addErrorLog({ message: 'Firebase updateSession failed.', details: e.message, type: 'error' }); }
    } else {
        const newSessions = sessions.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Session updated locally." });
    }
  }, [currentUser, isFirebaseDBAvailable, sessions, sessionsKey, toast, addErrorLog, saveToLocal]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser) return;
     if (isFirebaseDBAvailable) {
        try {
            await deleteDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId));
            toast({ title: "Success", description: "Session deleted." });
        } catch (e: any) { addErrorLog({ message: 'Firebase deleteSession failed.', details: e.message, type: 'error' }); }
    } else {
        const newSessions = sessions.filter(s => s.sessionId !== sessionId);
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Session deleted locally." });
    }
  }, [currentUser, isFirebaseDBAvailable, sessions, sessionsKey, toast, addErrorLog, saveToLocal]);
  
  const importSessions = useCallback(async (sessionsToImport: any) => {
    if (!currentUser) throw new Error("Not authenticated.");
    if (isFirebaseDBAvailable) {
        const sessionsQuery = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
        const existingSessionsSnap = await getDocs(sessionsQuery);
        const existingSessions = existingSessionsSnap.docs.map(d => d.data());
        const uniqueSessions = sessionsToImport.filter((s:any) => !existingSessions.some((es:any) => es.studentId === s.studentId && new Date(es.date).toDateString() === new Date(s.date).toDateString() && es.time === s.time));
        const batch = writeBatch(firestoreDbModule);
        uniqueSessions.forEach((s:any) => {
            const newDoc = doc(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)));
            batch.set(newDoc, { ...s, userId: currentUser.uid });
        });
        await batch.commit();
        return { newCount: uniqueSessions.length, duplicateCount: sessionsToImport.length - uniqueSessions.length };
    } else {
        const newSessions = sessionsToImport.map((s:any) => ({ ...s, sessionId: generateUUID(), userId: currentUser!.uid }));
        const updatedSessions = [...sessions, ...newSessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(updatedSessions);
        saveToLocal(sessionsKey, updatedSessions);
        return { newCount: newSessions.length, duplicateCount: 0 };
    }
  }, [currentUser, isFirebaseDBAvailable, sessions, sessionsKey, saveToLocal]);

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

    setLoading(true);
    setSessionsLoading(true);

    if (isFirebaseDBAvailable) {
      const unsubStudents = onSnapshot(query(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid)), (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student)).sort((a,b) => a.name.localeCompare(b.name));
          setStudents(data);
          setLoading(false);
      }, (err) => { setError(err); addErrorLog({ message: 'Failed to load students from Firebase.', details: err.message, type: 'error' }); });

      const unsubTemplates = onSnapshot(query(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", currentUser.uid)), async (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp).toDate() } as GoalTemplate)).sort((a,b) => a.name.localeCompare(b.name));
          setGoalTemplates(data);
      }, (err) => { setError(err); addErrorLog({ message: 'Failed to load templates from Firebase.', details: err.message, type: 'error' }); });

      const unsubSessions = onSnapshot(query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid)), (snapshot) => {
          const data = snapshot.docs.map(d => ({ sessionId: d.id, ...d.data() } as SessionData)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setSessions(data);
          setSessionsLoading(false);
      }, (err) => { setError(err); addErrorLog({ message: 'Failed to load sessions from Firebase.', details: err.message, type: 'error' }); setSessionsLoading(false); });
      
      return () => { unsubStudents(); unsubTemplates(); unsubSessions(); };
    } else {
      const localStudents = getFromLocalStorage(studentsKey, []);
      setStudents(localStudents.sort((a: Student, b: Student) => a.name.localeCompare(b.name)));
      const rawTemplates = getFromLocalStorage(templatesKey, []);
      const localTemplates = rawTemplates.map((t: any) => ({...t, createdAt: new Date(t.createdAt)}));
      const existingDefaultNames = new Set(localTemplates.filter((t: GoalTemplate) => t.isDefault).map((t: GoalTemplate) => t.name));
      const missingDefaultTemplates = DEFAULT_GOAL_TEMPLATES.filter(
          defaultTemplate => !existingDefaultNames.has(defaultTemplate.name)
      ).map(t => ({ ...t, id: generateUUID(), createdAt: new Date(), userId: currentUser?.uid || 'local-user' }));

      if (missingDefaultTemplates.length > 0) {
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
    }
  }, [authLoading, currentUser, isFirebaseDBAvailable, studentsKey, templatesKey, sessionsKey, saveToLocal, addErrorLog]);
  

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
    isFirebaseDBAvailable,
    addErrorLog,

    // Data Actions
    addStudent, updateStudent, deleteStudent,
    assignGoalToStudent, removeGoalFromStudent, updateStudentGoal,
    addGoalTemplate, updateGoalTemplate, deleteGoalTemplate,
    addSession, updateSession, deleteSession,
    getSessionsForStudent, importSessions,

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

    