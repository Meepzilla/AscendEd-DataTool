
'use client';

import { useState, useCallback } from 'react';
import type { Student, GoalTemplate, SessionData, User, Toast } from '@/lib/types';
import { DEFAULT_GOAL_TEMPLATES } from '@/lib/goal-constants';
import { generateUUID } from '@/lib/helpers';

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

interface LocalActionsProps {
    currentUser: User | null;
    students: Student[];
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    goalTemplates: GoalTemplate[];
    setGoalTemplates: React.Dispatch<React.SetStateAction<GoalTemplate[]>>;
    sessions: SessionData[];
    setSessions: React.Dispatch<React.SetStateAction<SessionData[]>>;
    toast: (options: Omit<Toast, "id">) => void;
}

export function useStudentDataLocal({
    currentUser, students, setStudents, goalTemplates, setGoalTemplates, sessions, setSessions, toast
}: LocalActionsProps) {

    const saveToLocal = useCallback((key: string | null, data: any) => {
        if (typeof window !== 'undefined' && key) {
            window.localStorage.setItem(key, JSON.stringify(data));
        }
    }, []);

    const studentsKey = getLocalStorageKey(LOCAL_STORAGE_STUDENTS_BASE_KEY, currentUser?.uid);
    const templatesKey = getLocalStorageKey(LOCAL_STORAGE_GOAL_TEMPLATES_BASE_KEY, currentUser?.uid);
    const sessionsKey = getLocalStorageKey(LOCAL_STORAGE_SESSIONS_BASE_KEY, currentUser?.uid);

    const loadAllLocalData = useCallback(() => {
        const localStudents = getFromLocalStorage(studentsKey, []);
        setStudents(localStudents.sort((a: Student, b: Student) => a.name.localeCompare(b.name)));
        
        const rawTemplates = getFromLocalStorage(templatesKey, []);
        const localTemplates = rawTemplates.map((t: any) => ({...t, createdAt: new Date(t.createdAt)}));
        
        const existingDefaultNames = new Set(localTemplates.filter((t: GoalTemplate) => t.isDefault).map((t: GoalTemplate) => t.name));
        const missingDefaultTemplates = DEFAULT_GOAL_TEMPLATES.filter(
            defaultTemplate => !existingDefaultNames.has(defaultTemplate.name)
        ).map(t => ({
            ...t, id: generateUUID(), createdAt: new Date(), userId: currentUser?.uid || 'local-user',
        }));

        if (missingDefaultTemplates.length > 0) {
            const updatedTemplates = [...localTemplates, ...missingDefaultTemplates];
            setGoalTemplates(updatedTemplates.sort((a: GoalTemplate, b: GoalTemplate) => a.name.localeCompare(b.name)));
            saveToLocal(templatesKey, updatedTemplates);
        } else {
            setGoalTemplates(localTemplates.sort((a: GoalTemplate, b: GoalTemplate) => a.name.localeCompare(b.name)));
        }

        const localSessions = getFromLocalStorage(sessionsKey, []);
        setSessions(localSessions.sort((a: SessionData, b: SessionData) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, [studentsKey, templatesKey, sessionsKey, setStudents, setGoalTemplates, setSessions, saveToLocal, currentUser?.uid]);

    const addStudent = useCallback(async (name: string) => {
        const newStudent = { id: generateUUID(), name, goals: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: currentUser!.uid, isArchived: false };
        const newStudents = [...students, newStudent].sort((a,b) => a.name.localeCompare(b.name));
        setStudents(newStudents);
        saveToLocal(studentsKey, newStudents);
        toast({ title: "Success", description: "Student added locally." });
        return newStudent;
    }, [students, setStudents, studentsKey, currentUser, saveToLocal, toast]);

    const updateStudent = useCallback(async (studentId: string, data: Partial<Student>) => {
        const updatedStudents = students.map(s => s.id === studentId ? { ...s, ...data, updatedAt: new Date().toISOString() } : s).sort((a,b) => a.name.localeCompare(b.name));
        setStudents(updatedStudents);
        saveToLocal(studentsKey, updatedStudents);
        toast({ title: "Success", description: "Student updated locally." });
    }, [students, setStudents, studentsKey, saveToLocal, toast]);

    const deleteStudent = useCallback(async (studentId: string) => {
        const newStudents = students.filter(s => s.id !== studentId);
        setStudents(newStudents);
        saveToLocal(studentsKey, newStudents);
        const newSessions = sessions.filter(s => s.studentId !== studentId);
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Student deleted locally." });
    }, [students, setStudents, studentsKey, sessions, setSessions, sessionsKey, saveToLocal, toast]);
    
    const addGoalTemplate = useCallback(async (templateData: any) => {
        const newTemplate = { id: generateUUID(), ...templateData, userId: currentUser!.uid, createdAt: new Date(), isDefault: false };
        const newTemplates = [...goalTemplates, newTemplate].sort((a,b) => a.name.localeCompare(b.name));
        setGoalTemplates(newTemplates);
        saveToLocal(templatesKey, newTemplates);
        toast({ title: "Success", description: "Template added locally." });
        return newTemplate;
    }, [goalTemplates, setGoalTemplates, templatesKey, currentUser, saveToLocal, toast]);

    const updateGoalTemplate = useCallback(async (templateId: string, data: any) => {
        const updatedTemplates = goalTemplates.map(t => t.id === templateId ? { ...t, ...data } : t).sort((a,b) => a.name.localeCompare(b.name));
        setGoalTemplates(updatedTemplates);
        saveToLocal(templatesKey, updatedTemplates);
        toast({ title: "Success", description: "Template updated locally." });
    }, [goalTemplates, setGoalTemplates, templatesKey, saveToLocal, toast]);

    const deleteGoalTemplate = useCallback(async (templateId: string) => {
        const newTemplates = goalTemplates.filter(t => t.id !== templateId);
        setGoalTemplates(newTemplates);
        saveToLocal(templatesKey, newTemplates);
        toast({ title: "Success", description: "Template deleted locally." });
    }, [goalTemplates, setGoalTemplates, templatesKey, saveToLocal, toast]);

    const addSession = useCallback(async (sessionData: any) => {
        const newSession = { ...sessionData, sessionId: generateUUID(), userId: currentUser!.uid };
        const newSessions = [newSession, ...sessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Session saved locally." });
        return newSession;
    }, [sessions, setSessions, sessionsKey, currentUser, saveToLocal, toast]);

    const updateSession = useCallback(async (sessionId: string, data: any) => {
        const newSessions = sessions.map(s => s.sessionId === sessionId ? { ...s, ...data } : s).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Session updated locally." });
    }, [sessions, setSessions, sessionsKey, saveToLocal, toast]);
    
    const deleteSession = useCallback(async (sessionId: string) => {
        const newSessions = sessions.filter(s => s.sessionId !== sessionId);
        setSessions(newSessions);
        saveToLocal(sessionsKey, newSessions);
        toast({ title: "Success", description: "Session deleted locally." });
    }, [sessions, setSessions, sessionsKey, saveToLocal, toast]);
    
    const importSessions = useCallback(async (sessionsToImport: any[]) => {
        const newSessions = sessionsToImport.map(s => ({ ...s, sessionId: generateUUID(), userId: currentUser!.uid }));
        const updatedSessions = [...sessions, ...newSessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(updatedSessions);
        saveToLocal(sessionsKey, updatedSessions);
        return { newCount: newSessions.length, duplicateCount: 0 };
    }, [sessions, setSessions, sessionsKey, currentUser, saveToLocal]);

    const getSessionsForStudent = useCallback((studentId: string) => {
        return sessions.filter(s => s.studentId === studentId);
    }, [sessions]);

    return {
        loadAllLocalData,
        addStudent, updateStudent, deleteStudent,
        addGoalTemplate, updateGoalTemplate, deleteGoalTemplate,
        addSession, updateSession, deleteSession, importSessions, getSessionsForStudent
    };
}
