
'use client';

import { useCallback } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db as firestoreDbModule } from '@/lib/firebase/config';
import type { Student, GoalTemplate, SessionData, User, Toast } from '@/lib/types';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/goal-constants';
import { generateUUID } from '@/lib/helpers';

const APP_ID = 'default-app-id';
const getStudentsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/students`;
const getGoalTemplatesCollectionPath = (appId: string) => `artifacts/${appId}/public/data/goal_templates`;
const getSessionsCollectionPath = (appId: string) => `artifacts/${appId}/public/data/sessions`;

interface FirebaseActionsProps {
    currentUser: User | null;
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    setGoalTemplates: React.Dispatch<React.SetStateAction<GoalTemplate[]>>;
    setSessions: React.Dispatch<React.SetStateAction<SessionData[]>>;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setSessionsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setError: React.Dispatch<React.SetStateAction<Error | null>>;
    toast: (options: Omit<Toast, "id">) => void;
    addErrorLog: (log: any) => void;
}

export function useStudentDataFirebase({
    currentUser, setStudents, setGoalTemplates, setSessions, setLoading, setSessionsLoading, setError, toast, addErrorLog
}: FirebaseActionsProps) {

    const seedFirebaseDefaultTemplates = useCallback(async () => {
        if (!currentUser || !firestoreDbModule) return;
        const q = query(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", currentUser.uid), where("isDefault", "==", true));
        try {
            const existingDefaults = await getDocs(q);
            const existingNames = new Set(existingDefaults.docs.map(d => d.data().name));
            const templatesToSeed = DEFAULT_GOAL_TEMPLATES.filter(t => !existingNames.has(t.name));
            if (templatesToSeed.length === 0) return;
            const batch = writeBatch(firestoreDbModule);
            templatesToSeed.forEach(template => {
                const newDocRef = doc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)));
                batch.set(newDocRef, { ...template, userId: currentUser.uid, createdAt: serverTimestamp(), id: newDocRef.id });
            });
            await batch.commit();
        } catch (e: any) { addErrorLog({ message: 'Error seeding Firebase default templates.', details: e.message, type: 'error' }); }
    }, [currentUser, addErrorLog]);

    const listenToStudents = useCallback((onLoad?: () => void) => {
        if (!currentUser || !firestoreDbModule) return () => {};
        const q = query(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student)).sort((a,b) => a.name.localeCompare(b.name));
            setStudents(data);
            if (onLoad) onLoad();
        }, (err) => { setError(err); addErrorLog({ message: 'Failed to load students from Firebase.', details: err.message, type: 'error' }); });
    }, [currentUser, setStudents, setError, addErrorLog]);

    const listenToGoalTemplates = useCallback((onLoad?: () => void) => {
        if (!currentUser || !firestoreDbModule) return () => {};
        const q = query(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
        return onSnapshot(q, async (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp).toDate() } as GoalTemplate)).sort((a,b) => a.name.localeCompare(b.name));
            setGoalTemplates(data);
            await seedFirebaseDefaultTemplates();
            if (onLoad) onLoad();
        }, (err) => { setError(err); addErrorLog({ message: 'Failed to load templates from Firebase.', details: err.message, type: 'error' }); });
    }, [currentUser, setGoalTemplates, setError, addErrorLog, seedFirebaseDefaultTemplates]);

    const listenToSessions = useCallback(() => {
        if (!currentUser || !firestoreDbModule) return () => {};
        const q = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ sessionId: d.id, ...d.data() } as SessionData)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSessions(data);
            setSessionsLoading(false);
        }, (err) => { setError(err); addErrorLog({ message: 'Failed to load sessions from Firebase.', details: err.message, type: 'error' }); setSessionsLoading(false); });
    }, [currentUser, setSessions, setSessionsLoading, setError, addErrorLog]);

    const addStudent = useCallback(async (name: string) => {
        if (!currentUser || !firestoreDbModule) return null;
        try {
            const docRef = await addDoc(collection(firestoreDbModule, getStudentsCollectionPath(APP_ID)), { name, goals: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: currentUser.uid, isArchived: false });
            toast({ title: "Success", description: `Student "${name}" added.` });
            return { id: docRef.id, name, goals: [], createdAt: new Date().toISOString(), userId: currentUser.uid } as Student;
        } catch (e: any) { addErrorLog({ message: 'Firebase addStudent failed.', details: e.message, type: 'error' }); return null; }
    }, [currentUser, toast, addErrorLog]);

    const updateStudent = useCallback(async (studentId: string, data: Partial<Student>) => {
        if (!currentUser || !firestoreDbModule) return;
        try {
            await updateDoc(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId), { ...data, updatedAt: new Date().toISOString(), userId: currentUser.uid });
            toast({ title: "Success", description: "Student updated." });
        } catch (e: any) { addErrorLog({ message: 'Firebase updateStudent failed.', details: e.message, type: 'error' }); }
    }, [currentUser, toast, addErrorLog]);

    const deleteStudent = useCallback(async (studentId: string) => {
        if (!currentUser || !firestoreDbModule) return;
        try {
            const batch = writeBatch(firestoreDbModule);
            batch.delete(doc(firestoreDbModule, getStudentsCollectionPath(APP_ID), studentId));
            const sessionsQuery = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("studentId", "==", studentId), where("userId", "==", currentUser.uid));
            const sessionsSnap = await getDocs(sessionsQuery);
            sessionsSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            toast({ title: "Success", description: "Student and sessions deleted." });
        } catch (e: any) { addErrorLog({ message: 'Firebase deleteStudent failed.', details: e.message, type: 'error' }); }
    }, [currentUser, toast, addErrorLog]);
    
    const addGoalTemplate = useCallback(async (templateData: any) => {
        if (!currentUser || !firestoreDbModule) return null;
        try {
            const docRef = await addDoc(collection(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID)), { ...templateData, userId: currentUser.uid, createdAt: serverTimestamp(), isDefault: false });
            toast({ title: "Success", description: `Template "${templateData.name}" added.` });
            return { id: docRef.id, ...templateData, userId: currentUser.uid, createdAt: new Date(), isDefault: false };
        } catch (e: any) { addErrorLog({ message: 'Firebase addGoalTemplate failed.', details: e.message, type: 'error' }); return null; }
    }, [currentUser, toast, addErrorLog]);

    const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
        if (!currentUser || !firestoreDbModule) return;
        try {
            await updateDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId), { ...data, userId: currentUser.uid });
            toast({ title: "Success", description: "Goal template updated." });
        } catch (e: any) { addErrorLog({ message: 'Firebase updateGoalTemplate failed.', details: e.message, type: 'error' }); }
    }, [currentUser, toast, addErrorLog]);
    
    const deleteGoalTemplate = useCallback(async (templateId: string) => {
        if (!currentUser || !firestoreDbModule) return;
        try {
            await deleteDoc(doc(firestoreDbModule, getGoalTemplatesCollectionPath(APP_ID), templateId));
            toast({ title: "Success", description: "Goal template deleted." });
        } catch (e: any) { addErrorLog({ message: 'Firebase deleteGoalTemplate failed.', details: e.message, type: 'error' }); }
    }, [currentUser, toast, addErrorLog]);

    const addSession = useCallback(async (sessionData: any) => {
        if (!currentUser || !firestoreDbModule) return null;
        try {
            const docRef = await addDoc(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), { ...sessionData, userId: currentUser.uid });
            toast({ title: "Success", description: "Session saved." });
            return { sessionId: docRef.id, ...sessionData, userId: currentUser.uid };
        } catch (e: any) { addErrorLog({ message: 'Firebase addSession failed.', details: e.message, type: 'error' }); return null; }
    }, [currentUser, toast, addErrorLog]);

    const updateSession = useCallback(async (sessionId: string, data: any) => {
        if (!currentUser || !firestoreDbModule) return;
        try {
            await updateDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId), { ...data, userId: currentUser.uid });
            toast({ title: "Success", description: "Session updated." });
        } catch (e: any) { addErrorLog({ message: 'Firebase updateSession failed.', details: e.message, type: 'error' }); }
    }, [currentUser, toast, addErrorLog]);

    const deleteSession = useCallback(async (sessionId: string) => {
        if (!currentUser || !firestoreDbModule) return;
        try {
            await deleteDoc(doc(firestoreDbModule, getSessionsCollectionPath(APP_ID), sessionId));
            toast({ title: "Success", description: "Session deleted." });
        } catch (e: any) { addErrorLog({ message: 'Firebase deleteSession failed.', details: e.message, type: 'error' }); }
    }, [currentUser, toast, addErrorLog]);
    
    const importSessions = useCallback(async (sessionsToImport: any) => {
        if (!currentUser || !firestoreDbModule) throw new Error("Not authenticated or Firebase not available.");
        const sessionsQuery = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid));
        const existingSessionsSnap = await getDocs(sessionsQuery);
        const existingSessions = existingSessionsSnap.docs.map(d => d.data());
        const uniqueSessions = sessionsToImport.filter((s:any) => !existingSessions.some(es => es.studentId === s.studentId && new Date(es.date).toDateString() === new Date(s.date).toDateString() && es.time === s.time));
        const batch = writeBatch(firestoreDbModule);
        uniqueSessions.forEach((s:any) => {
            const newDoc = doc(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)));
            batch.set(newDoc, { ...s, userId: currentUser.uid });
        });
        await batch.commit();
        return { newCount: uniqueSessions.length, duplicateCount: sessionsToImport.length - uniqueSessions.length };
    }, [currentUser]);

    const getSessionsForStudent = useCallback(async (studentId: string) => {
        if(!currentUser || !firestoreDbModule) return [];
        const q = query(collection(firestoreDbModule, getSessionsCollectionPath(APP_ID)), where("userId", "==", currentUser.uid), where("studentId", "==", studentId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({sessionId: d.id, ...d.data()}));
    }, [currentUser]);

    return {
        listenToStudents, listenToGoalTemplates, listenToSessions,
        addStudent, updateStudent, deleteStudent,
        addGoalTemplate, updateGoalTemplate, deleteGoalTemplate,
        addSession, updateSession, deleteSession, importSessions, getSessionsForStudent
    };
}
