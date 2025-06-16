
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config';
import type { Student, Goal, GoalTemplate, SessionData, User } from '@/lib/types';
import { useAuth } from './use-auth';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/constants';
import { generateUUID } from '@/lib/helpers';
import { useToast } from "@/hooks/use-toast";

const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;


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

  const seedLocalDefaultTemplates = useCallback(() => {
    if (goalTemplatesState.length === 0) {
      const localDefaultTemplates = DEFAULT_GOAL_TEMPLATES.map(t => ({
        ...t,
        id: generateUUID(),
        createdAt: Timestamp.now(), 
        userId: currentUser?.uid || 'local-user',
      }));
      setGoalTemplatesState(localDefaultTemplates);
      toast({ title: "Info", description: "Loaded default local goal templates."});
    }
  }, [currentUser?.uid, goalTemplatesState.length, toast]);

  const seedFirebaseDefaultTemplates = useCallback(async (user: User, dbInstance: typeof firestoreDbModule) => {
    if (!user || !dbInstance) return null;
    // Check if default templates (by name) already exist for this user to prevent re-seeding
    const defaultTemplateNames = DEFAULT_GOAL_TEMPLATES.map(t => t.name);
    const existingDefaults = goalTemplatesState.filter(gt => gt.userId === user.uid && defaultTemplateNames.includes(gt.name) && gt.isDefault);
    if (existingDefaults.length >= DEFAULT_GOAL_TEMPLATES.length) {
        // console.log("StudentData: Firebase default templates already exist for user.");
        return goalTemplatesState; // Return current templates
    }

    console.log("StudentData: Seeding Firebase default templates.");
    try {
      const batch = writeBatch(dbInstance);
      const seededTemplates: GoalTemplate[] = [];
      for (const template of DEFAULT_GOAL_TEMPLATES) {
        // Only seed if a template with this name doesn't exist or isn't marked as default for this user
        if (!existingDefaults.find(et => et.name === template.name)) {
            const newTemplateRef = doc(collection(dbInstance, getGoalTemplatesCollectionPath(APP_ID)));
            const newTemplateData = { 
              ...template, 
              userId: user.uid, 
              createdAt: serverTimestamp() as Timestamp,
              id: newTemplateRef.id, // Use generated ref ID
            };
            batch.set(newTemplateRef, newTemplateData);
            seededTemplates.push(newTemplateData as unknown as GoalTemplate); 
        }
      }
      if (seededTemplates.length > 0) {
        await batch.commit();
        toast({ title: "Success", description: "Default Firebase goal templates seeded." });
        // The snapshot listener should pick these up. If direct update needed:
        // return [...goalTemplatesState.filter(gt => gt.userId !== user.uid), ...seededTemplates];
      }
      return null; // Let snapshot listener handle the update
    } catch (e) {
      console.error("Error seeding Firebase default templates:", e);
      toast({ title: "Error", description: "Could not seed Firebase default templates.", variant: "destructive" });
      return null;
    }
  }, [goalTemplatesState, toast, APP_ID]);


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

    if (isFirebaseDBAvailable && firestoreDbModule) {
      console.log("StudentData: Operating in Firebase mode for user:", currentUser.uid);
      setError(null); 

      const studentQuery = query(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
      const templateQuery = query(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));

      let studentsLoaded = false;
      let templatesLoaded = false;
      const checkAllFirebaseLoaded = () => {
        if (studentsLoaded && templatesLoaded) {
          setLoading(false);
          console.log("StudentData: All Firebase data loaded.");
        }
      };

      unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
        const studentData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Student));
        setStudentsState(studentData);
        studentsLoaded = true;
        checkAllFirebaseLoaded();
      }, (err) => {
        console.error("Error fetching students from Firebase:", err);
        setError(err);
        toast({ title: "Firebase Error", description: `Could not load students: ${err.message}`, variant: "destructive" });
        studentsLoaded = true; 
        checkAllFirebaseLoaded();
      });

      unsubscribeTemplates = onSnapshot(templateQuery, async (snapshot) => {
        const templateData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as GoalTemplate));
        setGoalTemplatesState(templateData); // Set state first
        if (templateData.length === 0 && currentUser && firestoreDbModule) {
          // This will trigger another snapshot update if seeding occurs
         await seedFirebaseDefaultTemplates(currentUser, firestoreDbModule);
        }
        templatesLoaded = true;
        checkAllFirebaseLoaded();
      }, (err) => {
        console.error("Error fetching goal templates from Firebase:", err);
        setError(err);
        toast({ title: "Firebase Error", description: `Could not load goal templates: ${err.message}`, variant: "destructive" });
        templatesLoaded = true;
        checkAllFirebaseLoaded();
      });

    } else {
      console.log("StudentData: Operating in local data mode.");
      // Do NOT set an error here for being in local mode.
      // setError(new Error("Firestore not available...")) // THIS WAS THE PROBLEMATIC LINE
      if (studentsState.length === 0) setStudentsState([]); // Initialize if empty, but don't clear existing local students
      seedLocalDefaultTemplates();
      setLoading(false); 
    }

    return () => {
      unsubscribeStudents();
      unsubscribeTemplates();
    };
  }, [authLoading, currentUser, isFirebaseDBAvailable, firestoreDbModule, seedLocalDefaultTemplates, seedFirebaseDefaultTemplates, toast, APP_ID]);
  

  const addStudent = useCallback(async (name: string): Promise<Student | null> => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return null;
    }
    const studentDataOmitId: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), userId: currentUser.uid };
    
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), studentDataOmitId);
        const newStudent = { id: docRef.id, ...studentDataOmitId };
        // Snapshot listener should update studentsState. setSelectedStudentState might be redundant if list updates.
        // setSelectedStudentState(newStudent); 
        toast({ title: "Success", description: `Student "${name}" added to Firebase.` });
        return newStudent;
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not add student to Firebase.", variant: "destructive" });
        return null;
      }
    } else {
      const newStudent: Student = { id: generateUUID(), ...studentDataOmitId };
      setStudentsState(prev => [newStudent, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedStudentState(newStudent);
      toast({ title: "Success", description: `Student "${name}" added locally.` });
      return newStudent;
    }
  }, [currentUser, isFirebaseDBAvailable, toast, APP_ID]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Omit<Student, 'id'>>) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId), data);
        toast({ title: "Success", description: "Student updated in Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not update student in Firebase.", variant: "destructive" });
      }
    } else {
      setStudentsState(prev => prev.map(s => s.id === studentId ? { ...s, ...data, id:s.id } as Student : s).sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Success", description: "Student updated locally." });
    }
  }, [isFirebaseDBAvailable, toast, APP_ID]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId));
        setSessionsState(prev => prev.filter(s => s.studentId !== studentId)); 
        toast({ title: "Success", description: "Student deleted from Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not delete student from Firebase.", variant: "destructive" });
      }
    } else {
      setStudentsState(prev => prev.filter(s => s.id !== studentId));
      setSessionsState(prev => prev.filter(s => s.studentId !== studentId));
      toast({ title: "Success", description: "Student deleted locally." });
    }
    if (selectedStudent?.id === studentId) setSelectedStudentState(null);
  }, [isFirebaseDBAvailable, selectedStudent, toast, APP_ID]);
  
  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    
    const newGoal = { ...goal, id: goal.id || generateUUID() };
    const updatedGoals = [...student.goals, newGoal];
    
    await updateStudent(studentId, { goals: updatedGoals });
    if(!isFirebaseDBAvailable) toast({ title: "Success", description: `Goal "${goal.name}" assigned locally.` });

  }, [studentsState, updateStudent, isFirebaseDBAvailable, toast]);

  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    
    const updatedGoals = student.goals.filter(g => g.id !== goalId);
    await updateStudent(studentId, { goals: updatedGoals });
     if(!isFirebaseDBAvailable) toast({ title: "Success", description: "Goal removed locally." });
  }, [studentsState, updateStudent, isFirebaseDBAvailable, toast]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => {
    const student = studentsState.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }

    const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...updatedGoalData } : g);
    await updateStudent(studentId, { goals: updatedGoals });
    if(!isFirebaseDBAvailable) toast({ title: "Success", description: "Goal updated locally." });
  }, [studentsState, updateStudent, isFirebaseDBAvailable, toast]);

  const addGoalTemplate = useCallback(async (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Promise<GoalTemplate | null> => {
    if (!currentUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return null;
    }
    const fullTemplateData = { 
        ...templateData, 
        userId: currentUser.uid, 
        createdAt: serverTimestamp() as Timestamp, 
        isDefault: false,
    };

    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        const docRef = await addDoc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), fullTemplateData);
        // Snapshot listener updates state.
        toast({ title: "Success", description: `Template "${templateData.name}" added to Firebase.` });
        return { id: docRef.id, ...fullTemplateData } as GoalTemplate; // Return with ID
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not add goal template to Firebase.", variant: "destructive" });
        return null;
      }
    } else {
      const newTemplate: GoalTemplate = { id: generateUUID(), ...fullTemplateData, createdAt: Timestamp.now() };
      setGoalTemplatesState(prev => [...prev, newTemplate].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Success", description: `Template "${templateData.name}" added locally.` });
      return newTemplate;
    }
  }, [currentUser, isFirebaseDBAvailable, toast, APP_ID]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: Partial<GoalTemplate>) => {
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await updateDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId), data);
        toast({ title: "Success", description: "Goal template updated in Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not update goal template in Firebase.", variant: "destructive" });
      }
    } else {
      setGoalTemplatesState(prev => prev.map(t => t.id === templateId ? { ...t, ...data } as GoalTemplate : t).sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "Success", description: "Goal template updated locally." });
    }
  }, [isFirebaseDBAvailable, toast, APP_ID]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    const templateToDelete = goalTemplatesState.find(t => t.id === templateId);
    if (templateToDelete?.isDefault) {
        toast({ title: "Info", description: "Default templates cannot be deleted.", variant: "default"});
        return;
    }
    if (isFirebaseDBAvailable && firestoreDbModule) {
      try {
        await deleteDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId));
        toast({ title: "Success", description: "Goal template deleted from Firebase." });
      } catch (e) {
        setError(e as Error);
        toast({ title: "Error", description: "Could not delete goal template from Firebase.", variant: "destructive" });
      }
    } else {
      setGoalTemplatesState(prev => prev.filter(t => t.id !== templateId));
      toast({ title: "Success", description: "Goal template deleted locally." });
    }
  }, [isFirebaseDBAvailable, goalTemplatesState, toast, APP_ID]);

  const addSession = useCallback((sessionData: Omit<SessionData, 'sessionId'>) => {
    const newSession: SessionData = { ...sessionData, sessionId: generateUUID() };
    setSessionsState(prev => [newSession, ...prev]); 
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

