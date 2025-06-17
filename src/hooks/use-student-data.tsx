
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config';
import type { Student, Goal, GoalTemplate, SessionData, User, Toast, StudentSessionState } from '@/lib/types'; // Added StudentSessionState
import { useAuth } from './use-auth';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/constants';
import { generateUUID } from '@/lib/helpers';
import { useToast as useShadcnToast } from "@/hooks/use-toast"; 
import { useErrorLog } from './use-error-log';

const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;
const getSessionsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/sessions`;

const LOCAL_STORAGE_STUDENTS_KEY = 'ascended_students_v2';
const LOCAL_STORAGE_GOAL_TEMPLATES_KEY = 'ascended_goal_templates_v2';
const LOCAL_STORAGE_SESSIONS_KEY = 'ascended_sessions_v2';


interface StudentDataContextType {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  loading: boolean;
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

  // Data Entry Page Persisted State
  dataEntrySessionDate: Date | undefined;
  setDataEntrySessionDate: (date: Date | undefined) => void;
  dataEntrySessionTime: string;
  setDataEntrySessionTime: (time: string) => void;
  dataEntrySelectedStudentIds: string[];
  setDataEntrySelectedStudentIds: (ids: string[]) => void;
  dataEntryStudentSessionStates: Record<string, StudentSessionState>;
  setDataEntryStudentSessionStates: (states: Record<string, StudentSessionState>) => void;
  dataEntryFocusedStudentSlotIndex: number;
  setDataEntryFocusedStudentSlotIndex: (index: number) => void;
  dataEntryFocusedGoalIndexByStudentId: Record<string, number>;
  setDataEntryFocusedGoalIndexByStudentId: (indexes: Record<string, number>) => void;
  dataEntryAiActivitySuggestions: Record<string, string[]>;
  setDataEntryAiActivitySuggestions: (suggestions: Record<string, string[]>) => void;
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

  // Data Entry Page Persisted State
  const [dataEntrySessionDate, setDataEntrySessionDateState] = useState<Date | undefined>(undefined);
  const [dataEntrySessionTime, setDataEntrySessionTimeState] = useState<string>('');
  const [dataEntrySelectedStudentIds, setDataEntrySelectedStudentIdsState] = useState<string[]>([]);
  const [dataEntryStudentSessionStates, setDataEntryStudentSessionStatesState] = useState<Record<string, StudentSessionState>>({});
  const [dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndexState] = useState<number>(0);
  const [dataEntryFocusedGoalIndexByStudentId, setDataEntryFocusedGoalIndexByStudentIdState] = useState<Record<string, number>>({});
  const [dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestionsState] = useState<Record<string, string[]>>({});


  const safeToast = useCallback((options: Omit<Toast, 'id'>) => {
    if (typeof window !== 'undefined') { 
      shadcnToast(options);
    }
  }, [shadcnToast]);


  const seedLocalDefaultTemplates = useCallback(() => {
      const localDefaultTemplates = DEFAULT_GOAL_TEMPLATES.map(t => ({
        ...t,
        id: generateUUID(),
        createdAt: new Date(), 
        userId: currentUser?.uid || 'local-user',
      }));
      setGoalTemplatesState(localDefaultTemplates);
      safeToast({ title: "Info", description: "Loaded default local goal templates."});
  }, [currentUser?.uid, safeToast]);


  useEffect(() => {
    if (!isFirebaseDBAvailable && !authLoading && currentUser) {
      try {
        localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY, JSON.stringify(studentsState));
      } catch (e) {
        console.error("Error saving students to localStorage:", e);
        addErrorLog({ message: 'Error saving students to localStorage.', source: 'useStudentData.saveStudents', details: (e as Error).message, type: 'error' });
      }
    }
  }, [studentsState, isFirebaseDBAvailable, authLoading, currentUser, addErrorLog]);

  useEffect(() => {
    if (!isFirebaseDBAvailable && !authLoading && currentUser) {
      try {
        const storableTemplates = goalTemplatesState.map(t => ({
          ...t,
          createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt, 
        }));
        localStorage.setItem(LOCAL_STORAGE_GOAL_TEMPLATES_KEY, JSON.stringify(storableTemplates));
      } catch (e) {
        console.error("Error saving goal templates to localStorage:", e);
        addErrorLog({ message: 'Error saving goal templates to localStorage.', source: 'useStudentData.saveGoalTemplates', details: (e as Error).message, type: 'error' });
      }
    }
  }, [goalTemplatesState, isFirebaseDBAvailable, authLoading, currentUser, addErrorLog]);

  useEffect(() => {
    if (!isFirebaseDBAvailable && !authLoading && currentUser) {
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessionsState));
      } catch (e) {
        console.error("Error saving sessions to localStorage:", e);
        addErrorLog({ message: 'Error saving sessions to localStorage.', source: 'useStudentData.saveSessions', details: (e as Error).message, type: 'error' });
      }
    }
  }, [sessionsState, isFirebaseDBAvailable, authLoading, currentUser, addErrorLog]);


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
    setEditingStudent(null);
    setDeletingStudent(null);
    setEditingGoalTemplate(null);
    setDeletingGoalTemplate(null);
    setEditingSession(null);
    setDeletingSession(null);
    setEditingAssignedGoal(null);
    setIsAddStudentModalOpen(false);
    setIsAddGoalTemplateModalOpen(false);
    // Do NOT reset Data Entry page states here on currentUser change,
    // as that would clear data if user logs out and back in during same browser session.
    // Page itself can decide if it needs to clear based on new user if necessary.
  }, [currentUser]);


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
      // Reset Data Entry states if user logs out completely
      setDataEntrySessionDateState(undefined);
      setDataEntrySessionTimeState('');
      setDataEntrySelectedStudentIdsState([]);
      setDataEntryStudentSessionStatesState({});
      setDataEntryFocusedStudentSlotIndexState(0);
      setDataEntryFocusedGoalIndexByStudentIdState({});
      setDataEntryAiActivitySuggestionsState({});
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
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
      let sessionsLoaded = false;
      const checkAllFirebaseLoaded = () => {
        if (studentsLoaded && templatesLoaded && sessionsLoaded) {
          setLoading(false);
          console.log("StudentData: All Firebase data loaded.");
        }
      };

      unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
        const studentData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Student));
        setStudentsState(studentData.sort((a,b) => a.name.localeCompare(b.name)));
        studentsLoaded = true;
        checkAllFirebaseLoaded();
      }, (err: Error) => {
        console.error("Error fetching students from Firebase:", err);
        setError(err); 
        addErrorLog({ message: 'Failed to load students from Firebase.', source: 'useStudentData.studentsSnapshot', details: err.message, type: 'error' });
        safeToast({ title: "Firebase Error", description: `Could not load students: ${err.message}`, variant: "destructive" });
        studentsLoaded = true; checkAllFirebaseLoaded();
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
        checkAllFirebaseLoaded();
      }, (err: Error) => {
        console.error("Error fetching goal templates from Firebase:", err);
        setError(err); 
        addErrorLog({ message: 'Failed to load goal templates from Firebase.', source: 'useStudentData.templatesSnapshot', details: err.message, type: 'error' });
        safeToast({ title: "Firebase Error", description: `Could not load goal templates: ${err.message}`, variant: "destructive" });
        templatesLoaded = true; checkAllFirebaseLoaded();
      });

      unsubscribeSessions = onSnapshot(sessionQuery, (snapshot) => {
        const sessionData = snapshot.docs.map(docSnap => ({ sessionId: docSnap.id, ...docSnap.data() } as SessionData));
        setSessionsState(sessionData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        sessionsLoaded = true;
        checkAllFirebaseLoaded();
      }, (err: Error) => {
        console.error("Error fetching sessions from Firebase:", err);
        setError(err); 
        addErrorLog({ message: 'Failed to load sessions from Firebase.', source: 'useStudentData.sessionsSnapshot', details: err.message, type: 'error' });
        safeToast({ title: "Firebase Error", description: `Could not load sessions: ${err.message}`, variant: "destructive" });
        sessionsLoaded = true; checkAllFirebaseLoaded();
      });


    } else {
      console.log("StudentData: Operating in local data mode.");
      addErrorLog({ message: 'Operating in local data mode. Firestore DB not available.', source: 'useStudentData.init', type: 'warning' });
      try {
        const localStudents = JSON.parse(localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY) || 'null');
        if (localStudents) setStudentsState(localStudents.sort((a:Student,b:Student) => a.name.localeCompare(b.name)));
        else setStudentsState([]);

        const localSessions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY) || 'null');
        if (localSessions) setSessionsState(localSessions.sort((a:SessionData,b:SessionData) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        else setSessionsState([]);
        
        const rawTemplates = JSON.parse(localStorage.getItem(LOCAL_STORAGE_GOAL_TEMPLATES_KEY) || 'null');
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
    }

    return () => {
      unsubscribeStudents();
      unsubscribeTemplates();
      unsubscribeSessions();
    };
  }, [authLoading, currentUser, isFirebaseDBAvailable, firestoreDbModule, seedLocalDefaultTemplates, seedFirebaseDefaultTemplates, safeToast, APP_ID, addErrorLog]);


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
      setStudentsState(prev => [...prev, newStudent].sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedStudentState(newStudent);
      safeToast({ title: "Success", description: `Student "${name}" added locally.` });
      return newStudent;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID, addErrorLog]);

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
      setStudentsState(prev => prev.map(s => s.id === studentId ? { ...s, ...data, id:s.id } as Student : s).sort((a,b) => a.name.localeCompare(b.name)));
      if (selectedStudent?.id === studentId) {
        setSelectedStudentState(prev => prev ? ({ ...prev, ...data } as Student) : null);
      }
      safeToast({ title: "Success", description: "Student updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, selectedStudent, currentUser, addErrorLog]);

 const deleteStudent = useCallback(async (studentId: string) => {
    if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      addErrorLog({ message: 'Attempted to delete student without authenticated user.', source: 'useStudentData.deleteStudent', type: 'error' });
      return;
    }
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
      setStudentsState(prev => prev.filter(s => s.id !== studentId));
      setSessionsState(prev => prev.filter(s => s.studentId !== studentId));
      safeToast({ title: "Success", description: "Student and their sessions deleted locally." });
    }
    if (selectedStudent?.id === studentId) setSelectedStudentState(null);
    setDeletingStudent(null); 
  }, [isFirebaseDBAvailable, firestoreDbModule, currentUser, selectedStudent, safeToast, APP_ID, addErrorLog]);

  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { 
      safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); 
      addErrorLog({ message: 'Student not found for goal assignment.', source: 'useStudentData.assignGoalToStudent', details: `Student ID: ${studentId}`, type: 'error' });
      return; 
    }

    const newGoal = { ...goal, id: goal.id || generateUUID() }; 
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
      setGoalTemplatesState(prev => [...prev, newTemplate].sort((a,b) => a.name.localeCompare(b.name)));
      safeToast({ title: "Success", description: `Template "${templateData.name}" added locally.` });
      return newTemplate;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID, addErrorLog]);

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
      setGoalTemplatesState(prev => prev.map(t => t.id === templateId ? { ...t, ...data, createdAt: t.createdAt } as GoalTemplate : t).sort((a,b) => a.name.localeCompare(b.name)));
      safeToast({ title: "Success", description: "Goal template updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, currentUser, addErrorLog]);

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
      setGoalTemplatesState(prev => prev.filter(t => t.id !== templateId));
      safeToast({ title: "Success", description: "Goal template deleted locally." });
    }
     setDeletingGoalTemplate(null); 
  }, [isFirebaseDBAvailable, goalTemplatesState, safeToast, APP_ID, currentUser, addErrorLog]);

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
      setSessionsState(prev => [newSession, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      safeToast({ title: "Success", description: "Session saved locally." });
      return newSession;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID, addErrorLog]);

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
      setSessionsState(prev => prev.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      safeToast({ title: "Success", description: "Session updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, currentUser, addErrorLog]);

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
      setSessionsState(prev => prev.filter(s => s.sessionId !== sessionId));
      safeToast({ title: "Success", description: "Session deleted locally." });
    }
    setDeletingSession(null); 
  }, [isFirebaseDBAvailable, safeToast, APP_ID, currentUser, addErrorLog]);

  const getSessionsForStudent = useCallback((studentId: string) => {
    return sessionsState.filter(s => s.studentId === studentId);
  }, [sessionsState]);

  // Modal action callbacks
  const setSelectedStudentCb = useCallback((student: Student | null) => setSelectedStudentState(student), []);
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
  
  // Data Entry context setters
  const setDataEntrySessionDate = useCallback((date: Date | undefined) => setDataEntrySessionDateState(date), []);
  const setDataEntrySessionTime = useCallback((time: string) => setDataEntrySessionTimeState(time), []);
  const setDataEntrySelectedStudentIds = useCallback((ids: string[]) => setDataEntrySelectedStudentIdsState(ids), []);
  const setDataEntryStudentSessionStates = useCallback((states: Record<string, StudentSessionState>) => setDataEntryStudentSessionStatesState(states), []);
  const setDataEntryFocusedStudentSlotIndex = useCallback((index: number) => setDataEntryFocusedStudentSlotIndexState(index), []);
  const setDataEntryFocusedGoalIndexByStudentId = useCallback((indexes: Record<string, number>) => setDataEntryFocusedGoalIndexByStudentIdState(indexes), []);
  const setDataEntryAiActivitySuggestions = useCallback((suggestions: Record<string, string[]>) => setDataEntryAiActivitySuggestionsState(suggestions), []);


  const contextValue = useMemo(() => ({
    students: studentsState,
    goalTemplates: goalTemplatesState,
    sessions: sessionsState,
    selectedStudent,
    setSelectedStudent: setSelectedStudentCb,
    loading, error, isFirebaseDBAvailable,
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
    // Data Entry page state
    dataEntrySessionDate, setDataEntrySessionDate,
    dataEntrySessionTime, setDataEntrySessionTime,
    dataEntrySelectedStudentIds, setDataEntrySelectedStudentIds,
    dataEntryStudentSessionStates, setDataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId, setDataEntryFocusedGoalIndexByStudentId,
    dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestions,
  }), [
    studentsState, goalTemplatesState, sessionsState, selectedStudent, setSelectedStudentCb, loading, error, isFirebaseDBAvailable,
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
    dataEntryStudentSessionStates, setDataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex, setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId, setDataEntryFocusedGoalIndexByStudentId,
    dataEntryAiActivitySuggestions, setDataEntryAiActivitySuggestions,
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

