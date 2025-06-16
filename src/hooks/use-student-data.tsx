
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config'; // Renamed import
import type { Student, Goal, GoalTemplate, SessionData, User } from '@/lib/types';
import { useAuth } from './use-auth';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/constants';
import { generateUUID } from '@/lib/helpers';
import { useToast } from "@/hooks/use-toast";

// Firestore collection paths are now dynamic based on APP_ID, handled by getAppIdFromGlobals.
// For local mode, these won't be used, but defined for consistency.
const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;


interface StudentDataContextType {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  loading: boolean;
  error: Error | null; // Can indicate Firebase init error or regular data errors
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

  addSession: (sessionData: Omit<SessionData, 'sessionId'>) => void;
  updateSession: (sessionId: string, data: Partial<SessionData>) => void;
  deleteSession: (sessionId: string) => void;
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
  const { currentUser, isFirebaseAvailable: isFirebaseAuthAvailable } = useAuth();
  const { toast } = useToast();

  const [studentsState, setStudentsState] = useState<Student[]>([]);
  const [goalTemplatesState, setGoalTemplatesState] = useState<GoalTemplate[]>([]);
  const [sessionsState, setSessionsState] = useState<SessionData[]>([]);
  
  const [selectedStudent, setSelectedStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isFirebaseDBAvailable = isFirebaseAuthAvailable && !!firestoreDbModule;
  const APP_ID = 'default-app-id'; // Fallback if not from globals, though not used in local mode

  // Modal states
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isAddGoalTemplateModalOpen, setIsAddGoalTemplateModalOpen] = useState(false);
  const [editingGoalTemplate, setEditingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [deletingGoalTemplate, setDeletingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionData | null>(null);

  const seedLocalDefaultTemplates = useCallback(() => {
    if (goalTemplatesState.length === 0) {
      const localDefaultTemplates = DEFAULT_GOAL_TEMPLATES.map(t => ({
        ...t,
        id: generateUUID(),
        createdAt: Timestamp.now(), // Use Firestore Timestamp for consistency if it's available, else Date
        userId: currentUser?.uid || 'local-user',
      }));
      setGoalTemplatesState(localDefaultTemplates);
      toast({ title: "Info", description: "Loaded default local goal templates."});
    }
  }, [currentUser?.uid, goalTemplatesState.length, toast]);


  useEffect(() => {
    if (!currentUser) {
      setStudentsState([]);
      setGoalTemplatesState([]);
      setSessionsState([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!isFirebaseDBAvailable) {
      setError(new Error("Firestore not available. Operating in local data mode. Data will not be saved to the cloud."));
      seedLocalDefaultTemplates();
      setLoading(false);
      return; // Skip Firestore listeners
    }
    
    setError(null);
    setLoading(true);
    
    const studentQuery = query(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
    const templateQuery = query(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));

    const unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudentsState(studentData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching students:", err);
      setError(err);
      toast({ title: "Error", description: "Could not load students from Firebase.", variant: "destructive" });
      setLoading(false);
    });

    const unsubscribeTemplates = onSnapshot(templateQuery, async (snapshot) => {
      let templateData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoalTemplate));
      if (templateData.length === 0 && currentUser && firestoreDbModule) {
        const seededTemplates = await seedFirebaseDefaultTemplates(currentUser, firestoreDbModule);
        if (seededTemplates) templateData = seededTemplates;
      }
      setGoalTemplatesState(templateData);
    }, (err) => {
      console.error("Error fetching goal templates:", err);
      setError(err);
      toast({ title: "Error", description: "Could not load goal templates from Firebase.", variant: "destructive" });
    });

    return () => {
      unsubscribeStudents();
      unsubscribeTemplates();
    };
  }, [currentUser, isFirebaseDBAvailable, toast, seedLocalDefaultTemplates]);

  const seedFirebaseDefaultTemplates = async (user: User, dbInstance: typeof firestoreDbModule) => {
    if (!user || !dbInstance) return null;
    try {
      const batch = writeBatch(dbInstance);
      const seededTemplates: GoalTemplate[] = [];
      for (const template of DEFAULT_GOAL_TEMPLATES) {
        const newTemplateRef = doc(collection(dbInstance, getGoalTemplatesCollectionPath(APP_ID)));
        const newTemplateData = { 
          ...template, 
          userId: user.uid, 
          createdAt: serverTimestamp() as Timestamp,
          id: newTemplateRef.id,
        };
        batch.set(newTemplateRef, newTemplateData);
        seededTemplates.push(newTemplateData as unknown as GoalTemplate); // Cast carefully
      }
      await batch.commit();
      toast({ title: "Success", description: "Default Firebase goal templates seeded." });
      return seededTemplates;
    } catch (e) {
      console.error("Error seeding Firebase default templates:", e);
      toast({ title: "Error", description: "Could not seed Firebase default templates.", variant: "destructive" });
      return null;
    }
  };

  // --- CRUD Operations ---

  const addStudent = useCallback(async (name: string): Promise<Student | null> => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return null;
    }
    setLoading(true);
    const studentData: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), userId: currentUser.uid };
    
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), studentData);
        const newStudent = { id: docRef.id, ...studentData };
        toast({ title: "Success", description: `Student "${name}" added to Firebase.` });
        setSelectedStudentState(newStudent); // Also sets for local mode if Firebase was source
        setLoading(false);
        return newStudent;
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not add student to Firebase.", variant: "destructive" });
        setLoading(false);
        return null;
      }
    } else {
      // Local mode
      const newStudent: Student = { id: generateUUID(), ...studentData };
      setStudentsState(prev => [newStudent, ...prev]);
      setSelectedStudentState(newStudent);
      toast({ title: "Success", description: `Student "${name}" added locally.` });
      setLoading(false);
      return newStudent;
    }
  }, [currentUser, isFirebaseDBAvailable, toast]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Omit<Student, 'id'>>) => {
    setLoading(true);
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId), data);
        toast({ title: "Success", description: "Student updated in Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not update student in Firebase.", variant: "destructive" });
      }
    } else {
      // Local mode
      setStudentsState(prev => prev.map(s => s.id === studentId ? { ...s, ...data, id:s.id } as Student : s));
      toast({ title: "Success", description: "Student updated locally." });
    }
    setLoading(false);
  }, [isFirebaseDBAvailable, toast]);

  const deleteStudent = useCallback(async (studentId: string) => {
    setLoading(true);
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId));
        // Sessions might also be in Firebase, consider deleting them or handle via security rules
        setSessionsState(prev => prev.filter(s => s.studentId !== studentId)); // Assume sessions are local for now or filtered by UI
        toast({ title: "Success", description: "Student deleted from Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not delete student from Firebase.", variant: "destructive" });
      }
    } else {
      // Local mode
      setStudentsState(prev => prev.filter(s => s.id !== studentId));
      setSessionsState(prev => prev.filter(s => s.studentId !== studentId));
      toast({ title: "Success", description: "Student deleted locally." });
    }
    if (selectedStudent?.id === studentId) setSelectedStudentState(null);
    setLoading(false);
  }, [isFirebaseDBAvailable, selectedStudent, toast]);
  
  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    
    const newGoal = { ...goal, id: goal.id || generateUUID() };
    const updatedGoals = [...student.goals, newGoal];
    
    if (isFirebaseDBAvailable && firestoreDbModule) {
        await updateStudent(studentId, { goals: updatedGoals }); // updateStudent handles Firebase/local
    } else {
        setStudentsState(prev => prev.map(s => s.id === studentId ? {...s, goals: updatedGoals} : s));
        toast({ title: "Success", description: `Goal "${goal.name}" assigned locally.` });
    }
  }, [studentsState, isFirebaseDBAvailable, updateStudent, toast]);

  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    
    const updatedGoals = student.goals.filter(g => g.id !== goalId);

    if (isFirebaseDBAvailable && firestoreDbModule) {
        await updateStudent(studentId, { goals: updatedGoals });
    } else {
        setStudentsState(prev => prev.map(s => s.id === studentId ? {...s, goals: updatedGoals} : s));
        toast({ title: "Success", description: "Goal removed locally." });
    }
  }, [studentsState, isFirebaseDBAvailable, updateStudent, toast]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }

    const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...updatedGoalData } : g);
    
    if (isFirebaseDBAvailable && firestoreDbModule) {
        await updateStudent(studentId, { goals: updatedGoals });
    } else {
         setStudentsState(prev => prev.map(s => s.id === studentId ? {...s, goals: updatedGoals} : s));
         toast({ title: "Success", description: "Goal updated locally." });
    }
  }, [studentsState, isFirebaseDBAvailable, updateStudent, toast]);

  const addGoalTemplate = useCallback(async (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Promise<GoalTemplate | null> => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return null;
    }
    setLoading(true);
    const fullTemplateData = { 
        ...templateData, 
        userId: currentUser.uid, 
        createdAt: Timestamp.now(), // Or new Date().toISOString() for local
        isDefault: false,
    };

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), fullTemplateData);
        const newTemplate = { id: docRef.id, ...fullTemplateData } as GoalTemplate;
        toast({ title: "Success", description: `Template "${templateData.name}" added to Firebase.` });
        setLoading(false);
        return newTemplate;
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not add goal template to Firebase.", variant: "destructive" });
        setLoading(false);
        return null;
      }
    } else {
      // Local mode
      const newTemplate: GoalTemplate = { id: generateUUID(), ...fullTemplateData, createdAt: Timestamp.now() }; // Ensure createdAt is consistent
      setGoalTemplatesState(prev => [newTemplate, ...prev]);
      toast({ title: "Success", description: `Template "${templateData.name}" added locally.` });
      setLoading(false);
      return newTemplate;
    }
  }, [currentUser, isFirebaseDBAvailable, toast]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: Partial<GoalTemplate>) => {
    setLoading(true);
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId), data);
        toast({ title: "Success", description: "Goal template updated in Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not update goal template in Firebase.", variant: "destructive" });
      }
    } else {
      // Local mode
      setGoalTemplatesState(prev => prev.map(t => t.id === templateId ? { ...t, ...data } as GoalTemplate : t));
      toast({ title: "Success", description: "Goal template updated locally." });
    }
    setLoading(false);
  }, [isFirebaseDBAvailable, toast]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    setLoading(true);
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId));
        toast({ title: "Success", description: "Goal template deleted from Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not delete goal template from Firebase.", variant: "destructive" });
      }
    } else {
      // Local mode
      setGoalTemplatesState(prev => prev.filter(t => t.id !== templateId));
      toast({ title: "Success", description: "Goal template deleted locally." });
    }
    setLoading(false);
  }, [isFirebaseDBAvailable, toast]);

  // Session data is always local for now as per design, can be extended for Firebase
  const addSession = useCallback((sessionData: Omit<SessionData, 'sessionId'>) => {
    const newSession: SessionData = { ...sessionData, sessionId: generateUUID() };
    setSessionsState(prev => [newSession, ...prev]); // Prepend new session
    toast({ title: "Success", description: "Session saved locally." });
  }, [toast]);

  const updateSession = useCallback((sessionId: string, data: Partial<SessionData>) => {
    setSessionsState(prev => prev.map(s => s.sessionId === sessionId ? { ...s, ...data } : s));
    toast({ title: "Success", description: "Session updated locally." });
  }, [toast]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessionsState(prev => prev.filter(s => s.sessionId !== sessionId));
    toast({ title: "Success", description: "Session deleted locally." });
  }, [toast]);

  const getSessionsForStudent = useCallback((studentId: string) => {
    return sessionsState.filter(s => s.studentId === studentId);
  }, [sessionsState]);
  
  // Modal control functions
  const setSelectedStudent = useCallback((student: Student | null) => setSelectedStudentState(student), []);
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
    selectedStudent, setSelectedStudent, loading, error, isFirebaseDBAvailable,
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
    studentsState, goalTemplatesState, sessionsState, selectedStudent, setSelectedStudent, loading, error, isFirebaseDBAvailable,
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
