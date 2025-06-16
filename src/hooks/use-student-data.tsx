
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config';
import type { Student, Goal, GoalTemplate, SessionData, User, Toast } from '@/lib/types'; // Added Toast type for safeToast options
import { useAuth } from './use-auth';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/constants';
import { generateUUID } from '@/lib/helpers';
import { useToast } from "@/hooks/use-toast";

const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;
const getSessionsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/sessions`;


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

  isAddStudentModalOpen: boolean;
  openAddStudentModal: () => void;
  closeAddStudentModal: () => void;
  
  editingStudent: Student | null;
  openEditStudentModal: (student: Student) => void;
  closeEditStudentModal: () => void;

  deletingStudent: Student | null;
  openDeleteStudentModal: (student: Student) => void;
  closeDeleteStudentModal: () => void;

  isAddGoalTemplateModalOpen: boolean;
  openAddGoalTemplateModal: () => void;
  closeAddGoalTemplateModal: () => void;

  editingGoalTemplate: GoalTemplate | null;
  openEditGoalTemplateModal: (template: GoalTemplate) => void;
  closeEditGoalTemplateModal: () => void;
  
  deletingGoalTemplate: GoalTemplate | null;
  openDeleteGoalTemplateModal: (template: GoalTemplate) => void;
  closeDeleteGoalTemplateModal: () => void;

  editingSession: SessionData | null;
  openEditSessionModal: (session: SessionData) => void;
  closeEditSessionModal: () => void;

  deletingSession: SessionData | null;
  openDeleteSessionModal: (session: SessionData) => void;
  closeDeleteSessionModal: () => void;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export const StudentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isFirebaseAvailable: isFirebaseAuthAvailable, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [studentsState, setStudentsState] = useState<Student[]>([]);
  const [goalTemplatesState, setGoalTemplatesState] = useState<GoalTemplate[]>([]);
  const [sessionsState, setSessionsState] = useState<SessionData[]>([]);
  
  const [selectedStudent, setSelectedStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isFirebaseDBAvailable = isFirebaseAuthAvailable && !!firestoreDbModule;
  const APP_ID = 'default-app-id'; 

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isAddGoalTemplateModalOpen, setIsAddGoalTemplateModalOpen] = useState(false);
  const [editingGoalTemplate, setEditingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [deletingGoalTemplate, setDeletingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionData | null>(null);

  const safeToast = useCallback((options: Omit<Toast, 'id'>) => {
    if (typeof window !== 'undefined') {
      toast(options);
    } else {
      // Optional: Log to server console if needed for debugging SSR toasts
      // console.log(`SSR Toast (suppressed): ${options.title} - ${options.description}`);
    }
  }, [toast]);

  const seedLocalDefaultTemplates = useCallback(() => {
    if (goalTemplatesState.length === 0 && !isFirebaseDBAvailable) { 
      const localDefaultTemplates = DEFAULT_GOAL_TEMPLATES.map(t => ({
        ...t,
        id: generateUUID(),
        createdAt: new Date(), 
        userId: currentUser?.uid || 'local-user',
      }));
      setGoalTemplatesState(localDefaultTemplates);
      safeToast({ title: "Info", description: "Loaded default local goal templates."});
    }
  }, [currentUser?.uid, goalTemplatesState.length, safeToast, isFirebaseDBAvailable]);

  const seedFirebaseDefaultTemplates = useCallback(async (user: User, dbInstance: typeof firestoreDbModule) => {
    if (!user || !dbInstance) return null;
    const defaultTemplateNames = DEFAULT_GOAL_TEMPLATES.map(t => t.name);
    const q = query(collection(dbInstance, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", user.uid), where("isDefault", "==", true));
    const existingDefaultsSnapshot = await getDocs(q);
    const existingDefaultCount = existingDefaultsSnapshot.size;

    if (existingDefaultCount >= DEFAULT_GOAL_TEMPLATES.length) {
        return;
    }

    console.log("StudentData: Seeding Firebase default templates.");
    try {
      const batch = writeBatch(dbInstance);
      for (const template of DEFAULT_GOAL_TEMPLATES) {
          const templateExists = existingDefaultsSnapshot.docs.some(doc => doc.data().name === template.name);
          if (!templateExists) {
            const newTemplateRef = doc(collection(dbInstance, getGoalTemplatesCollectionPath(APP_ID)));
            const newTemplateData = { 
              ...template, 
              userId: user.uid, 
              createdAt: serverTimestamp(), 
              id: newTemplateRef.id,
            };
            batch.set(newTemplateRef, newTemplateData);
        }
      }
      await batch.commit();
      safeToast({ title: "Success", description: "Default Firebase goal templates seeded." });
    } catch (e) {
      console.error("Error seeding Firebase default templates:", e);
      safeToast({ title: "Error", description: "Could not seed Firebase default templates.", variant: "destructive" });
    }
  }, [safeToast, APP_ID]);

  useEffect(() => {
    setEditingStudent(null);
    setDeletingStudent(null);
    setEditingGoalTemplate(null);
    setDeletingGoalTemplate(null);
    setEditingSession(null);
    setDeletingSession(null);
    setIsAddStudentModalOpen(false);
    setIsAddGoalTemplateModalOpen(false);
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
      setLoading(false);
      setError(null); 
      return;
    }

    setLoading(true);
    setError(null); 

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
      }, (err) => {
        console.error("Error fetching students from Firebase:", err);
        setError(err); safeToast({ title: "Firebase Error", description: `Could not load students: ${err.message}`, variant: "destructive" });
        studentsLoaded = true; checkAllFirebaseLoaded();
      });

      unsubscribeTemplates = onSnapshot(templateQuery, async (snapshot) => {
        const templateData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as GoalTemplate));
        setGoalTemplatesState(templateData.sort((a,b) => a.name.localeCompare(b.name)));
        if (templateData.filter(t => t.isDefault).length < DEFAULT_GOAL_TEMPLATES.length && currentUser && firestoreDbModule) {
         await seedFirebaseDefaultTemplates(currentUser, firestoreDbModule);
        }
        templatesLoaded = true;
        checkAllFirebaseLoaded();
      }, (err) => {
        console.error("Error fetching goal templates from Firebase:", err);
        setError(err); safeToast({ title: "Firebase Error", description: `Could not load goal templates: ${err.message}`, variant: "destructive" });
        templatesLoaded = true; checkAllFirebaseLoaded();
      });
      
      unsubscribeSessions = onSnapshot(sessionQuery, (snapshot) => {
        const sessionData = snapshot.docs.map(docSnap => ({ sessionId: docSnap.id, ...docSnap.data() } as SessionData));
        setSessionsState(sessionData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        sessionsLoaded = true;
        checkAllFirebaseLoaded();
      }, (err) => {
        console.error("Error fetching sessions from Firebase:", err);
        setError(err); safeToast({ title: "Firebase Error", description: `Could not load sessions: ${err.message}`, variant: "destructive" });
        sessionsLoaded = true; checkAllFirebaseLoaded();
      });


    } else {
      console.log("StudentData: Operating in local data mode.");
      setStudentsState(prev => prev.length === 0 ? [] : prev);
      setSessionsState(prev => prev.length === 0 ? [] : prev);
      seedLocalDefaultTemplates(); 
      setLoading(false); 
    }

    return () => {
      unsubscribeStudents();
      unsubscribeTemplates();
      unsubscribeSessions();
    };
  }, [authLoading, currentUser, isFirebaseDBAvailable, firestoreDbModule, seedLocalDefaultTemplates, seedFirebaseDefaultTemplates, safeToast, APP_ID]);
  

  const addStudent = useCallback(async (name: string): Promise<Student | null> => {
    if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return null;
    }
    const studentDataOmitId: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), userId: currentUser.uid };
    
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), studentDataOmitId);
        const newStudent = { id: docRef.id, ...studentDataOmitId };
        safeToast({ title: "Success", description: `Student "${name}" added.` });
        return newStudent;
      } catch (e) {
        console.error("Firebase addStudent error:", e);
        setError(e as Error);
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
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Omit<Student, 'id'>>) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId), data);
        safeToast({ title: "Success", description: "Student updated." });
      } catch (e) {
        console.error("Firebase updateStudent error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not update student.", variant: "destructive" });
      }
    } else {
      setStudentsState(prev => prev.map(s => s.id === studentId ? { ...s, ...data, id:s.id } as Student : s).sort((a,b) => a.name.localeCompare(b.name)));
      if (selectedStudent?.id === studentId) {
        setSelectedStudentState(prev => prev ? ({ ...prev, ...data } as Student) : null);
      }
      safeToast({ title: "Success", description: "Student updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID, selectedStudent]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId));
        safeToast({ title: "Success", description: "Student deleted." });
      } catch (e) {
        console.error("Firebase deleteStudent error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not delete student.", variant: "destructive" });
      }
    } else {
      setStudentsState(prev => prev.filter(s => s.id !== studentId));
      setSessionsState(prev => prev.filter(s => s.studentId !== studentId)); 
      safeToast({ title: "Success", description: "Student deleted locally." });
    }
    if (selectedStudent?.id === studentId) setSelectedStudentState(null);
  }, [isFirebaseDBAvailable, selectedStudent, safeToast, APP_ID]);
  
  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    
    const newGoal = { ...goal, id: goal.id || generateUUID() };
    const updatedGoals = [...student.goals, newGoal];
    
    await updateStudent(studentId, { goals: updatedGoals });
  }, [studentsState, updateStudent, safeToast]);

  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    
    const updatedGoals = student.goals.filter(g => g.id !== goalId);
    await updateStudent(studentId, { goals: updatedGoals });
  }, [studentsState, updateStudent, safeToast]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { safeToast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }

    const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...updatedGoalData } : g);
    await updateStudent(studentId, { goals: updatedGoals });
  }, [studentsState, updateStudent, safeToast]);

  const addGoalTemplate = useCallback(async (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Promise<GoalTemplate | null> => {
    if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return null;
    }
    const fullTemplateData = { 
        ...templateData, 
        userId: currentUser.uid, 
        createdAt: serverTimestamp(), 
        isDefault: false,
    };

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), fullTemplateData);
        safeToast({ title: "Success", description: `Template "${templateData.name}" added.` });
        return { id: docRef.id, ...fullTemplateData } as unknown as GoalTemplate; 
      } catch (e) {
        console.error("Firebase addGoalTemplate error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not add goal template.", variant: "destructive" });
        return null;
      }
    } else {
      const newTemplate: GoalTemplate = { id: generateUUID(), ...fullTemplateData, createdAt: new Date() } as unknown as GoalTemplate;
      setGoalTemplatesState(prev => [...prev, newTemplate].sort((a,b) => a.name.localeCompare(b.name)));
      safeToast({ title: "Success", description: `Template "${templateData.name}" added locally.` });
      return newTemplate;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: Partial<GoalTemplate>) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId), data);
        safeToast({ title: "Success", description: "Goal template updated." });
      } catch (e) {
        console.error("Firebase updateGoalTemplate error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not update goal template.", variant: "destructive" });
      }
    } else {
      setGoalTemplatesState(prev => prev.map(t => t.id === templateId ? { ...t, ...data } as GoalTemplate : t).sort((a,b) => a.name.localeCompare(b.name)));
      safeToast({ title: "Success", description: "Goal template updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    const templateToDelete = goalTemplatesState.find(t => t.id === templateId);
    if (templateToDelete?.isDefault) {
        safeToast({ title: "Info", description: "Default templates cannot be deleted.", variant: "default"});
        return;
    }
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId));
        safeToast({ title: "Success", description: "Goal template deleted." });
      } catch (e) {
        console.error("Firebase deleteGoalTemplate error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not delete goal template.", variant: "destructive" });
      }
    } else {
      setGoalTemplatesState(prev => prev.filter(t => t.id !== templateId));
      safeToast({ title: "Success", description: "Goal template deleted locally." });
    }
  }, [isFirebaseDBAvailable, goalTemplatesState, safeToast, APP_ID]);

  const addSession = useCallback(async (sessionDataOmitId: Omit<SessionData, 'sessionId'>): Promise<SessionData | null> => {
     if (!currentUser) {
      safeToast({ title: "Error", description: "User not authenticated for saving session.", variant: "destructive" });
      return null;
    }
    const sessionDataWithUser = { ...sessionDataOmitId, userId: currentUser.uid };

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), sessionDataWithUser);
        safeToast({ title: "Success", description: "Session saved." });
        return { sessionId: docRef.id, ...sessionDataWithUser };
      } catch (e) {
        console.error("Firebase addSession error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not save session to Firebase.", variant: "destructive" });
        return null;
      }
    } else {
      const newSession: SessionData = { ...sessionDataWithUser, sessionId: generateUUID() };
      setSessionsState(prev => [newSession, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())); 
      safeToast({ title: "Success", description: "Session saved locally." });
      return newSession;
    }
  }, [currentUser, isFirebaseDBAvailable, safeToast, APP_ID]);

  const updateSession = useCallback(async (sessionId: string, data: Partial<SessionData>) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
       try {
        await updateDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId), data);
        safeToast({ title: "Success", description: "Session updated." });
      } catch (e) {
        console.error("Firebase updateSession error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not update session in Firebase.", variant: "destructive" });
      }
    } else {
      setSessionsState(prev => prev.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      safeToast({ title: "Success", description: "Session updated locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID]);

  const deleteSession = useCallback(async (sessionId: string) => {
     if (isFirebaseDBAvailable && firestoreDbModule) {
        try {
        await deleteDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId));
        safeToast({ title: "Success", description: "Session deleted." });
      } catch (e) {
        console.error("Firebase deleteSession error:", e);
        setError(e as Error);
        safeToast({ title: "Error", description: "Could not delete session from Firebase.", variant: "destructive" });
      }
    } else {
      setSessionsState(prev => prev.filter(s => s.sessionId !== sessionId));
      safeToast({ title: "Success", description: "Session deleted locally." });
    }
  }, [isFirebaseDBAvailable, safeToast, APP_ID]);

  const getSessionsForStudent = useCallback((studentId: string) => {
    return sessionsState.filter(s => s.studentId === studentId);
  }, [sessionsState]);
  
  const setSelectedStudentCb = useCallback((student: Student | null) => setSelectedStudentState(student), []);
  const openAddStudentModal = useCallback(() => setIsAddStudentModalOpen(true), []);
  const closeAddStudentModal = useCallback(() => setIsAddStudentModalOpen(false), []);
  const openEditStudentModal = useCallback((student: Student) => setEditingStudent(student), []);
  const closeEditStudentModal = useCallback(() => setEditingStudent(null), []);
  const openDeleteStudentModal = useCallback((student: Student) => setDeletingStudent(student), []);
  const closeDeleteStudentModal = useCallback(() => setDeletingStudent(null), []);
  const openAddGoalTemplateModal = useCallback(() => setIsAddGoalTemplateModalOpen(true), []);
  const closeAddGoalTemplateModal = useCallback(() => setIsAddGoalTemplateModalOpen(false), []);
  const openEditGoalTemplateModal = useCallback((template: GoalTemplate) => setEditingGoalTemplate(template), []);
  const closeEditGoalTemplateModal = useCallback(() => setEditingGoalTemplate(null), []);
  const openDeleteGoalTemplateModal = useCallback((template: GoalTemplate) => setDeletingGoalTemplate(template), []);
  const closeDeleteGoalTemplateModal = useCallback(() => setDeletingGoalTemplate(null), []);
  const openEditSessionModal = useCallback((session: SessionData) => setEditingSession(session), []);
  const closeEditSessionModal = useCallback(() => setEditingSession(null), []);
  const openDeleteSessionModal = useCallback((session: SessionData) => setDeletingSession(session), []);
  const closeDeleteSessionModal = useCallback(() => setDeletingSession(null), []);

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
