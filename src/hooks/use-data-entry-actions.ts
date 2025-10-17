
'use client';

import { useCallback } from 'react';
import type { Student, StudentSessionState, SessionGoalData, Toast } from '@/lib/types';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import { getActivitySuggestions } from '@/ai/flows/activity-suggestions';

interface UseDataEntryActionsProps {
    students: Student[];
    activeStudentsInSlots: Student[];
    dataEntrySessionDate: Date | undefined;
    dataEntrySessionTime: string;
    dataEntrySessionEndTime: string;
    dataEntrySelectedStudentIds: string[];
    setDataEntrySelectedStudentIds: React.Dispatch<React.SetStateAction<string[]>>;
    dataEntryStudentSessionStates: Record<string, StudentSessionState>;
    setDataEntryStudentSessionStates: React.Dispatch<React.SetStateAction<Record<string, StudentSessionState>>>;
    dataEntryFocusedStudentSlotIndex: number;
    setDataEntryFocusedStudentSlotIndex: (index: number) => void;
    dataEntryShowArchivedByStudentId: Record<string, boolean>;
    setDataEntryFocusedGoalIndexByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setDataEntryAiActivitySuggestions: (suggestions: Record<string, string[]>) => void;
    isStudentAccessLocked: boolean;
    addSession: (session: any) => Promise<any>;
    getSessionsForStudent: (studentId: string) => any[];
    toast: (options: Omit<Toast, "id">) => void;
    addErrorLog: (log: any) => void;
}

export function useDataEntryActions({
    students,
    activeStudentsInSlots,
    dataEntrySessionDate,
    dataEntrySessionTime,
    dataEntrySessionEndTime,
    dataEntrySelectedStudentIds,
    setDataEntrySelectedStudentIds,
    dataEntryStudentSessionStates,
    setDataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex,
    setDataEntryFocusedStudentSlotIndex,
    dataEntryShowArchivedByStudentId,
    setDataEntryFocusedGoalIndexByStudentId,
    setDataEntryAiActivitySuggestions,
    isStudentAccessLocked,
    addSession,
    getSessionsForStudent,
    toast,
    addErrorLog,
}: UseDataEntryActionsProps) {

    const addStudentSlot = useCallback(() => {
        setDataEntrySelectedStudentIds(prevIds => {
          const activeStudents = students.filter(s => !s.isArchived);
          const availableStudent = activeStudents.find(s => !prevIds.includes(s.id));
          if (availableStudent) {
            setDataEntryFocusedStudentSlotIndex(prevIds.length);
            return [...prevIds, availableStudent.id];
          } else {
            setTimeout(() => {
              toast({ title: "Info", description: "No more unique available students to add.", variant: "default" });
            }, 0);
            return prevIds;
          }
        });
      }, [students, toast, setDataEntrySelectedStudentIds, setDataEntryFocusedStudentSlotIndex]);

    const fetchAiActivitySuggestions = useCallback(async (studentId: string) => {
        const studentState = dataEntryStudentSessionStates[studentId];
        const activeGoals = studentState?.originalGoalHeaders.filter(g => !g.isArchived);

        if (!studentState || !activeGoals || activeGoals.length === 0) {
            toast({ title: "Info", description: "Student has no active goals assigned or data is missing.", variant: "default" });
            return;
        }
        try {
            const goalDescriptions = activeGoals.map(g => `${g.name} (${g.type})`).join(', ');
            const studentProgressSummary = `Currently working on: ${goalDescriptions}. Recent activity: ${studentState.activity}. Notes: ${studentState.notes}`;
            const studentSessions = getSessionsForStudent(studentId);
            const sessionHistorySummary = studentSessions.slice(0, 3).map(s => `Date: ${s.date}, Activity: ${s.activity}`).join('\n');

            const result = await getActivitySuggestions({
                goal: goalDescriptions,
                studentProgress: studentProgressSummary,
                sessionHistory: sessionHistorySummary,
            });
            setDataEntryAiActivitySuggestions(prev => ({ ...prev, [studentId]: result.suggestions }));
            toast({ title: "AI Suggestions", description: `Found ${result.suggestions.length} activities. Reasoning: ${result.reasoning}` });
        } catch (error: any) {
            console.error("Error fetching AI activity suggestions:", error);
            addErrorLog({ message: 'Failed to fetch AI activity suggestions.', source: 'DataEntryPage.fetchAiActivitySuggestions', details: error.message, type: 'error' });
            toast({ title: "AI Error", description: "Could not fetch activity suggestions.", variant: "destructive" });
        }
    }, [dataEntryStudentSessionStates, getSessionsForStudent, addErrorLog, toast, setDataEntryAiActivitySuggestions]);

    const saveDataEntrySession = useCallback(async () => {
        if (!dataEntrySessionDate) {
            toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
            return;
        }

        if (dataEntrySelectedStudentIds.length === 0 || dataEntryFocusedStudentSlotIndex >= dataEntrySelectedStudentIds.length) {
            toast({ title: "Error", description: "Please select a student to save a session for.", variant: "destructive" });
            return;
        }

        const focusedStudentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
        if (!focusedStudentId) {
            toast({ title: "Error", description: "No student is currently focused.", variant: "destructive" });
            return;
        }

        const state = dataEntryStudentSessionStates[focusedStudentId];
        if (!state) {
            toast({ title: "Error", description: "Session data for the focused student is missing.", variant: "destructive" });
            addErrorLog({ message: 'Session state missing for focused student on save.', source: 'useStudentData.saveDataEntrySession', details: `Student ID: ${focusedStudentId}`, type: 'error' });
            return;
        }

        if (isStudentAccessLocked) {
            toast({ title: "Simulated Save", description: `Access is locked. Session for ${state.studentName} not saved.` });
            return;
        }

        const sessionGoals: SessionGoalData[] = state.originalGoalHeaders
            .filter((goal: any) => !goal.isArchived)
            .map((goal: any) => ({
                goalId: goal.id,
                goalName: goal.name,
                goalType: goal.type,
                data: state.goalData[goal.id] || JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type])),
            }));

        if (sessionGoals.length === 0) {
            toast({ title: "Info", description: `Cannot save for ${state.studentName}, no active goals with data.`, variant: "default" });
            return;
        }

        const session: Omit<any, 'sessionId'> = {
            studentId: state.studentId,
            studentName: state.studentName,
            date: dataEntrySessionDate.toISOString(),
            time: dataEntrySessionTime,
            endTime: dataEntrySessionEndTime,
            activity: state.activity,
            notes: state.notes,
            goals: sessionGoals,
            originalGoalHeaders: state.originalGoalHeaders,
        };

        const savedSession = await addSession(session);

        if (savedSession) {
            toast({ title: "Success", description: `Session for ${state.studentName} saved.` });
            setDataEntryStudentSessionStates(prevStates => {
                const newStates = { ...prevStates };
                if (newStates[focusedStudentId]) {
                    const studentState = newStates[focusedStudentId];
                    studentState.activity = '';
                    studentState.notes = '';
                    const initialGoalData: Record<string, SessionGoalData['data']> = {};
                    studentState.originalGoalHeaders.forEach((goal: any) => {
                        initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                    });
                    studentState.goalData = initialGoalData;
                }
                return newStates;
            });
        }
    }, [dataEntrySessionDate, dataEntrySessionTime, dataEntrySessionEndTime, dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, dataEntryStudentSessionStates, addSession, toast, addErrorLog, isStudentAccessLocked, setDataEntryStudentSessionStates]);
    
    const saveAllDataEntrySessions = useCallback(async () => {
        if (!dataEntrySessionDate) {
            toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
            return;
        }
        if (dataEntrySelectedStudentIds.length === 0) {
            toast({ title: "Error", description: "No students selected to save sessions for.", variant: "destructive" });
            return;
        }
        let savedCount = 0, errorCount = 0, simulatedCount = 0;
        for (const studentId of dataEntrySelectedStudentIds) {
            const state = dataEntryStudentSessionStates[studentId];
            if (!state) continue;
            if (isStudentAccessLocked) {
                simulatedCount++;
                continue;
            }
            const sessionGoals = state.originalGoalHeaders.filter((g: any) => !g.isArchived).map((g: any) => ({ goalId: g.id, goalName: g.name, goalType: g.type, data: state.goalData[g.id] || {} }));
            if (sessionGoals.length === 0) continue;
            const session = { studentId: state.studentId, studentName: state.studentName, date: dataEntrySessionDate.toISOString(), time: dataEntrySessionTime, endTime: dataEntrySessionEndTime, activity: state.activity, notes: state.notes, goals: sessionGoals, originalGoalHeaders: state.originalGoalHeaders };
            const savedSession = await addSession(session);
            if (savedSession) {
                savedCount++;
                setDataEntryStudentSessionStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], activity: '', notes: '', goalData: {} } }));
            } else {
                errorCount++;
            }
        }
        if (savedCount > 0) toast({ title: "Success", description: `Saved ${savedCount} session(s).` });
        if (simulatedCount > 0) toast({ title: "Simulated Save", description: `${simulatedCount} session(s) not saved due to lock.` });
        if (errorCount > 0) toast({ title: "Error", description: `Failed to save ${errorCount} session(s).`, variant: "destructive" });
    }, [dataEntrySessionDate, dataEntrySelectedStudentIds, dataEntryStudentSessionStates, addSession, toast, isStudentAccessLocked, dataEntrySessionTime, dataEntrySessionEndTime, setDataEntryStudentSessionStates]);

    const resetDataEntrySession = useCallback(() => {
        if (dataEntrySelectedStudentIds.length === 0 || dataEntryFocusedStudentSlotIndex >= dataEntrySelectedStudentIds.length) {
            toast({ title: "Info", description: "No student is focused to reset data for.", variant: "default" });
            return;
        }
        const focusedStudentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
        setDataEntryStudentSessionStates(prevStates => {
            const newStates = { ...prevStates };
            const studentState = newStates[focusedStudentId];
            if (studentState) {
                studentState.activity = '';
                studentState.notes = '';
                const initialGoalData: Record<string, any> = {};
                studentState.originalGoalHeaders.forEach((goal: any) => {
                    initialGoalData[goal.id] = JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[goal.type]));
                });
                studentState.goalData = initialGoalData;
            }
            return newStates;
        });
        toast({ title: "Data Reset", description: `Current unsaved data for the focused student has been reset.` });
    }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, toast, setDataEntryStudentSessionStates]);

    const handleGoalDataChange = useCallback((studentId: string, goalId: string, updatedFieldName: string, newData: any) => {
        setDataEntryStudentSessionStates(prevStates => {
            const studentState = prevStates[studentId];
            if (!studentState) return prevStates;
            const goal = studentState.originalGoalHeaders.find((g: any) => g.id === goalId);
            if (!goal) return prevStates;

            let processedData = { ...newData };
            const originalData = studentState.goalData[goalId] || {};

            if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') {
                const newTotalSyllables = Math.max(0, Number(processedData.totalSyllables || 0));
                const newStutteredSyllables = Math.max(0, Number(processedData.stutteredSyllables || 0));

                if (updatedFieldName === 'stutteredSyllables') {
                    const oldStuttered = Number(originalData.stutteredSyllables || 0);
                    if (newStutteredSyllables > oldStuttered) {
                        processedData.totalSyllables = newTotalSyllables + (newStutteredSyllables - oldStuttered);
                    }
                    processedData.totalSyllables = Math.max(Number(processedData.totalSyllables), newStutteredSyllables);
                } else if (updatedFieldName === 'totalSyllables') {
                    processedData.stutteredSyllables = Math.min(newStutteredSyllables, newTotalSyllables);
                }
            }
            return { ...prevStates, [studentId]: { ...studentState, goalData: { ...studentState.goalData, [goalId]: processedData } } };
        });
        const studentSlotIndex = dataEntrySelectedStudentIds.indexOf(studentId);
        if (studentSlotIndex !== -1) setDataEntryFocusedStudentSlotIndex(studentSlotIndex);
        const allGoals = dataEntryStudentSessionStates[studentId]?.originalGoalHeaders || [];
        const visibleGoals = allGoals.filter((g: any) => !g.isArchived || dataEntryShowArchivedByStudentId[studentId]);
        const goalIndexInVisibleList = visibleGoals.findIndex((g: any) => g.id === goalId);
        if (goalIndexInVisibleList !== -1) setDataEntryFocusedGoalIndexByStudentId(prev => ({ ...prev, [studentId]: goalIndexInVisibleList }));
    }, [dataEntryStudentSessionStates, dataEntrySelectedStudentIds, dataEntryShowArchivedByStudentId, setDataEntryFocusedStudentSlotIndex, setDataEntryFocusedGoalIndexByStudentId, setDataEntryStudentSessionStates]);
    
    const handleMoveGoal = useCallback((studentId: string, goalId: string, direction: 'up' | 'down') => {
        setDataEntryStudentSessionStates(prevStates => {
            const studentState = prevStates[studentId];
            if (!studentState) return prevStates;
            const goals = [...studentState.originalGoalHeaders];
            const goalIndex = goals.findIndex((g: any) => g.id === goalId);
            if (goalIndex === -1) return prevStates;
            const newIndex = direction === 'up' ? goalIndex - 1 : goalIndex + 1;
            if (newIndex < 0 || newIndex >= goals.length) return prevStates;
            const [movedGoal] = goals.splice(goalIndex, 1);
            goals.splice(newIndex, 0, movedGoal);
            const visibleGoals = goals.filter((g: any) => !g.isArchived || dataEntryShowArchivedByStudentId[studentId]);
            const newFocusedIndexInVisible = visibleGoals.findIndex((g: any) => g.id === goalId);
            setDataEntryFocusedGoalIndexByStudentId(prev => ({ ...prev, [studentId]: newFocusedIndexInVisible !== -1 ? newFocusedIndexInVisible : 0 }));
            return { ...prevStates, [studentId]: { ...studentState, originalGoalHeaders: goals } };
        });
    }, [dataEntryShowArchivedByStudentId, setDataEntryFocusedGoalIndexByStudentId, setDataEntryStudentSessionStates]);

    return {
        fetchAiActivitySuggestions,
        saveDataEntrySession,
        saveAllDataEntrySessions,
        resetDataEntrySession,
        handleGoalDataChange,
        handleMoveGoal,
        addStudentSlot,
    };
}
