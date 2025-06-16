
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/config'; // This now exports potentially null `db`
import type { Student, Goal, GoalTemplate, SessionData, User } from '@/lib/types';
import { useAuth } from './use-auth';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/constants';
import { generateUUID, getAppIdFromGlobals } from '@/lib/helpers';
import { useToast } from "@/hooks/use-toast";

// Firestore collection paths
const APP_ID = getAppIdFromGlobals() || 'default-app-id';
const STUDENTS_COLLECTION = `artifacts/${APP_ID}/public/data/students`;
const GOAL_TEMPLATES_COLLECTION = `artifacts/${APP_ID}/public/data/goal_templates`;

interface StudentDataContextType {
  students: Student[];
  goalTemplates: GoalTemplate[];
  sessions: SessionData[];
  selectedStudent: Student | null;
  setSelectedStudent: (student: Student | null) => void;
  loading: boolean;
  error: Error | null;
  
  addStudent: (name: string) => Promise<Student | null>;
  updateStudent: (studentId: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  assignGoalToStudent: (studentId: string, goal: Goal) => Promise<void>;
  removeGoalFromStudent: (studentId: string, goalId: string) => Promise<void>;
  updateStudentGoal: (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => Promise<void>;

  addGoalTemplate: (templateData: Omit<GoalTemplate, 'id' | 'createdAt'>) => Promise<GoalTemplate | null>;
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
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedStudent, setSelectedStudentState] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isAddGoalTemplateModalOpen, setIsAddGoalTemplateModalOpen] = useState(false);
  const [editingGoalTemplate, setEditingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [deletingGoalTemplate, setDeletingGoalTemplate] = useState<GoalTemplate | null>(null);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionData | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setStudents([]);
      setGoalTemplates([]);
      setSessions([]);
      setLoading(false);
      setError(null); // Clear error if no user
      return;
    }

    if (!db) { // Check if Firestore service was initialized
      setStudents([]);
      setGoalTemplates([]);
      setSessions([]);
      setLoading(false);
      const dbError = new Error("Firestore is not initialized. Please check Firebase configuration.");
      setError(dbError);
      toast({ title: "Database Error", description: dbError.message, variant: "destructive" });
      return;
    }
    
    setError(null); // Clear previous errors if db and user are available
    setLoading(true);
    
    const studentQuery = query(collection(db, STUDENTS_COLLECTION), where("userId", "==", currentUser.uid));
    const templateQuery = query(collection(db, GOAL_TEMPLATES_COLLECTION), where("userId", "==", currentUser.uid));

    const unsubscribeStudents = onSnapshot(studentQuery, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(studentData);
      setLoading(false); // Set loading to false after initial student data load or update
    }, (err) => {
      console.error("Error fetching students:", err);
      setError(err);
      toast({ title: "Error", description: "Could not load students.", variant: "destructive" });
      setLoading(false);
    });

    const unsubscribeTemplates = onSnapshot(templateQuery, async (snapshot) => {
      let templateData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoalTemplate));
      if (templateData.length === 0 && currentUser) { // Seed only if logged in
        const seededTemplates = await seedDefaultTemplates(currentUser, db); // Pass db
        if (seededTemplates) templateData = seededTemplates;
      }
      setGoalTemplates(templateData);
      // setLoading(false); // Loading state primarily tied to students for main app functionality
    }, (err) => {
      console.error("Error fetching goal templates:", err);
      setError(err);
      toast({ title: "Error", description: "Could not load goal templates.", variant: "destructive" });
      // setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeTemplates();
    };
  }, [currentUser, toast]);

  const seedDefaultTemplates = async (user: User, firestoreDb: typeof db) => { // Added firestoreDb param
    if (!user || !firestoreDb) return null;
    try {
      const batch = writeBatch(firestoreDb);
      const seededTemplates: GoalTemplate[] = [];
      for (const template of DEFAULT_GOAL_TEMPLATES) {
        const newTemplateRef = doc(collection(firestoreDb, GOAL_TEMPLATES_COLLECTION));
        const newTemplateData = { 
          ...template, 
          userId: user.uid, 
          createdAt: serverTimestamp() as Timestamp,
          id: newTemplateRef.id
        };
        batch.set(newTemplateRef, newTemplateData);
        seededTemplates.push(newTemplateData as unknown as GoalTemplate);
      }
      await batch.commit();
      toast({ title: "Success", description: "Default goal templates have been added." });
      return seededTemplates;
    } catch (e) {
      console.error("Error seeding default templates:", e);
      toast({ title: "Error", description: "Could not seed default templates.", variant: "destructive" });
      return null;
    }
  };

  const addStudent = useCallback(async (name: string): Promise<Student | null> => {
    if (!currentUser || !db) {
      toast({ title: "Error", description: !currentUser ? "User not authenticated." : "Database not available.", variant: "destructive" });
      return null;
    }
    setLoading(true);
    try {
      const studentData: Omit<Student, 'id'> = { name, goals: [], createdAt: new Date().toISOString(), userId: currentUser.uid };
      const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), studentData);
      const newStudent = { id: docRef.id, ...studentData };
      toast({ title: "Success", description: `Student "${name}" added.` });
      setSelectedStudentState(newStudent);
      return newStudent;
    } catch (e) {
      console.error("Error adding student:", e);
      setError(e as Error);
      toast({ title: "Error", description: "Could not add student.", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  const updateStudent = useCallback(async (studentId: string, data: Partial<Omit<Student, 'id'>>) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, STUDENTS_COLLECTION, studentId), data);
      toast({ title: "Success", description: "Student updated." });
    } catch (e) {
      console.error("Error updating student:", e);
      setError(e as Error);
      toast({ title: "Error", description: "Could not update student.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteStudent = useCallback(async (studentId: string) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await deleteDoc(doc(db, STUDENTS_COLLECTION, studentId));
      setSessions(prev => prev.filter(s => s.studentId !== studentId));
      if (selectedStudent?.id === studentId) {
        setSelectedStudentState(null);
      }
      toast({ title: "Success", description: "Student deleted." });
    } catch (e) {
      console.error("Error deleting student:", e);
      setError(e as Error);
      toast({ title: "Error", description: "Could not delete student.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, toast]);
  
  const assignGoalToStudent = useCallback(async (studentId: string, goal: Goal) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    const student = students.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    const newGoal = { ...goal, id: goal.id || generateUUID() };
    const updatedGoals = [...student.goals, newGoal];
    await updateStudent(studentId, { goals: updatedGoals });
    toast({ title: "Success", description: `Goal "${goal.name}" assigned.` });
  }, [students, updateStudent, toast]);

  const removeGoalFromStudent = useCallback(async (studentId: string, goalId: string) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    const student = students.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    const updatedGoals = student.goals.filter(g => g.id !== goalId);
    await updateStudent(studentId, { goals: updatedGoals });
     toast({ title: "Success", description: "Goal removed." });
  }, [students, updateStudent, toast]);

  const updateStudentGoal = useCallback(async (studentId: string, goalId: string, updatedGoalData: Partial<Goal>) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    const student = students.find(s => s.id === studentId);
    if (!student) { toast({ title: "Error", description: "Student not found.", variant: "destructive" }); return; }
    const updatedGoals = student.goals.map(g => g.id === goalId ? { ...g, ...updatedGoalData } : g);
    await updateStudent(studentId, { goals: updatedGoals });
    toast({ title: "Success", description: "Goal updated." });
  }, [students, updateStudent, toast]);

  const addGoalTemplate = useCallback(async (templateData: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>): Promise<GoalTemplate | null> => {
    if (!currentUser || !db) {
      toast({ title: "Error", description: !currentUser ? "User not authenticated." : "Database not available.", variant: "destructive" });
      return null;
    }
    setLoading(true);
    try {
      const fullTemplateData = { ...templateData, userId: currentUser.uid, createdAt: serverTimestamp() as Timestamp };
      const docRef = await addDoc(collection(db, GOAL_TEMPLATES_COLLECTION), fullTemplateData);
      toast({ title: "Success", description: `Template "${templateData.name}" added.` });
      return { id: docRef.id, ...fullTemplateData } as GoalTemplate;
    } catch (e) {
      console.error("Error adding goal template:", e);
      setError(e as Error);
      toast({ title: "Error", description: "Could not add goal template.", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  const updateGoalTemplate = useCallback(async (templateId: string, data: Partial<GoalTemplate>) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, GOAL_TEMPLATES_COLLECTION, templateId), data);
      toast({ title: "Success", description: "Goal template updated." });
    } catch (e) {
      console.error("Error updating goal template:", e);
      setError(e as Error);
      toast({ title: "Error", description: "Could not update goal template.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteGoalTemplate = useCallback(async (templateId: string) => {
    if (!db) { toast({ title: "Error", description: "Database not available.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await deleteDoc(doc(db, GOAL_TEMPLATES_COLLECTION, templateId));
      toast({ title: "Success", description: "Goal template deleted." });
    } catch (e) {
      console.error("Error deleting goal template:", e);
      setError(e as Error);
      toast({ title: "Error", description: "Could not delete goal template.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const addSession = useCallback((sessionData: Omit<SessionData, 'sessionId'>) => {
    const newSession: SessionData = { ...sessionData, sessionId: generateUUID() };
    setSessions(prev => [newSession, ...prev]);
    toast({ title: "Success", description: "Session saved locally." });
  }, [toast]);

  const updateSession = useCallback((sessionId: string, data: Partial<SessionData>) => {
    setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, ...data } : s));
    toast({ title: "Success", description: "Session updated locally." });
  }, [toast]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    toast({ title: "Success", description: "Session deleted locally." });
  }, [toast]);

  const getSessionsForStudent = useCallback((studentId: string) => {
    return sessions.filter(s => s.studentId === studentId);
  }, [sessions]);

  const setSelectedStudent = useCallback((student: Student | null) => {
    setSelectedStudentState(student);
  }, []);
  
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
    students, goalTemplates, sessions, selectedStudent, setSelectedStudent, loading, error,
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
    students, goalTemplates, sessions, selectedStudent, setSelectedStudent, loading, error,
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
