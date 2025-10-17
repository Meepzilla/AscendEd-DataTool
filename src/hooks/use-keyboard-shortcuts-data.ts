
'use client';

import { useCallback } from 'react';
import type { Student, Goal, StudentSessionState } from '@/lib/types';
import { PROMPT_HOTKEY_MAP } from '@/lib/promptConstants';

interface UseKeyboardShortcutHandlersProps {
    students: Student[];
    dataEntrySelectedStudentIds: string[];
    dataEntryStudentSessionStates: Record<string, StudentSessionState>;
    dataEntryFocusedStudentSlotIndex: number;
    setDataEntryFocusedStudentSlotIndex: (index: number) => void;
    dataEntryFocusedGoalIndexByStudentId: Record<string, number>;
    setDataEntryFocusedGoalIndexByStudentId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    dataEntryShowArchivedByStudentId: Record<string, boolean>;
    handleGoalDataChange: (studentId: string, goalId: string, updatedFieldName: string, newData: any) => void;
    openEditStudentModal: (student: Student) => void;
    toggleStudentSelectionModal: () => void;
    toggleGoalSelectionModal: () => void;
}

export function useKeyboardShortcutHandlers({
    students,
    dataEntrySelectedStudentIds,
    dataEntryStudentSessionStates,
    dataEntryFocusedStudentSlotIndex,
    setDataEntryFocusedStudentSlotIndex,
    dataEntryFocusedGoalIndexByStudentId,
    setDataEntryFocusedGoalIndexByStudentId,
    dataEntryShowArchivedByStudentId,
    handleGoalDataChange,
    openEditStudentModal,
    toggleStudentSelectionModal,
    toggleGoalSelectionModal,
}: UseKeyboardShortcutHandlersProps) {

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
        const validGoalIndex = Math.min(Math.max(goalIndexInVisibleList, 0), visibleGoals.length - 1);
        const goal = visibleGoals[validGoalIndex];
        if (!goal) return null;
        return { studentId, studentState, goal, goalData: studentState.goalData[goal.id], goalIndex: validGoalIndex };
    }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, dataEntryStudentSessionStates, dataEntryFocusedGoalIndexByStudentId, dataEntryShowArchivedByStudentId]);

    const focusStudentSlot = useCallback((slotIndex: number) => {
        if (slotIndex < dataEntrySelectedStudentIds.length) {
            setDataEntryFocusedStudentSlotIndex(slotIndex);
        }
    }, [dataEntrySelectedStudentIds.length, setDataEntryFocusedStudentSlotIndex]);

    const cycleFocusedStudent = useCallback((direction: 'next' | 'prev') => {
        const numSlots = dataEntrySelectedStudentIds.length;
        if (numSlots > 0) {
            setDataEntryFocusedStudentSlotIndex(prev => (direction === 'next' ? (prev + 1) % numSlots : (prev - 1 + numSlots) % numSlots));
        }
    }, [dataEntrySelectedStudentIds.length, setDataEntryFocusedStudentSlotIndex]);

    const cycleFocusedGoal = useCallback((direction: 'next' | 'prev') => {
        const focusedInfo = getCurrentFocusedGoalInfo();
        if (!focusedInfo?.studentId) return;
        const { studentId, studentState, goalIndex } = focusedInfo;
        const visibleGoals = studentState.originalGoalHeaders.filter(g => !g.isArchived || dataEntryShowArchivedByStudentId[studentId]);
        const numVisibleGoals = visibleGoals.length;
        if (numVisibleGoals > 0) {
            const nextIndex = direction === 'prev' ? (goalIndex - 1 + numVisibleGoals) % numVisibleGoals : (goalIndex + 1) % numVisibleGoals;
            setDataEntryFocusedGoalIndexByStudentId(prev => ({ ...prev, [studentId]: nextIndex }));
        }
    }, [getCurrentFocusedGoalInfo, dataEntryShowArchivedByStudentId, setDataEntryFocusedGoalIndexByStudentId]);

    const triggerEditFocusedStudent = useCallback(() => {
        if (dataEntrySelectedStudentIds.length > 0) {
            const focusedStudentId = dataEntrySelectedStudentIds[dataEntryFocusedStudentSlotIndex];
            const studentToEdit = students.find(s => s.id === focusedStudentId);
            if (studentToEdit) openEditStudentModal(studentToEdit);
        }
    }, [dataEntrySelectedStudentIds, dataEntryFocusedStudentSlotIndex, students, openEditStudentModal]);

    const handleDataEntryHotkey = useCallback((key: string, alt: boolean) => {
        const focusedInfo = getCurrentFocusedGoalInfo();
        if (!focusedInfo?.goal || focusedInfo.goal.isArchived) return;

        let { studentId, goal, goalData } = focusedInfo;
        // Ensure goalData is not undefined.
        if (!goalData) {
            goalData = {};
        }
        
        const increment = alt ? -1 : 1;
        const promptToUpdate = PROMPT_HOTKEY_MAP[key];

        if (promptToUpdate) {
            const currentCount = Number(goalData[promptToUpdate] || 0);
            const newValue = Math.max(0, currentCount + increment);
            let updatedData = { ...goalData, [promptToUpdate]: newValue };
            if (promptToUpdate === 'Independent' && ((alt && currentCount > 0) || !alt)) {
                const correctField = 'correct' || 'questionsCorrect' || 'successfulResponses' || 'correctProductions' || 'trialsAccepted' || 'successfulAttempts';
                updatedData[correctField] = Math.max(0, (Number(goalData[correctField]) || 0) + increment);
            }
            handleGoalDataChange(studentId, goal.id, promptToUpdate, updatedData);
            return;
        }
        
        let fieldToUpdate: string | null = null;
        if (goal.type === 'QUALITATIVE_OBSERVATION' && !alt) {
            const currentRating = Number(goalData.rating ?? 3);
            const newRating = key === 'C' ? Math.min(5, currentRating + 1) : key === 'N' ? Math.max(1, currentRating - 1) : currentRating;
            if (newRating !== currentRating) handleGoalDataChange(studentId, goal.id, 'rating', { ...goalData, rating: newRating });
            return;
        }

        if (goal.type === 'FLUENCY_SYLLABLE_STUTTER') {
            switch(key) {
                case 'B': fieldToUpdate = 'blocks'; break;
                case 'R': fieldToUpdate = 'repetitions'; break;
                case 'H': fieldToUpdate = 'prolongations'; break;
                case 'J': fieldToUpdate = 'interjections'; break;
                case 'C': fieldToUpdate = 'totalSyllables'; break;
                case 'N': fieldToUpdate = 'stutteredSyllables'; break;
            }
        }
        
        if (!fieldToUpdate) {
            if (key === 'C') {
                const fields = ['correct', 'questionsCorrect', 'successfulResponses', 'correctProductions', 'trialsAccepted', 'successfulAttempts'];
                fieldToUpdate = fields.find(f => goalData.hasOwnProperty(f)) || (goal.type === 'AAC' ? 'correct' : null);
            } else if (key === 'N') {
                const fields = ['incorrect', 'questionsIncorrect', 'unsuccessfulResponses', 'incorrectProductions', 'trialsRefused', 'failedAttempts'];
                fieldToUpdate = fields.find(f => goalData.hasOwnProperty(f)) || (goal.type === 'AAC' ? 'incorrect' : null);
            } else if (key === 'B' && goal.type !== 'FLUENCY_SYLLABLE_STUTTER') {
                 if(goalData.hasOwnProperty('approximate') || goal.type === 'AAC') fieldToUpdate = 'approximate';
            }
        }
        
        if (fieldToUpdate) {
            const currentValue = Number(goalData[fieldToUpdate] || 0);
            const newValue = Math.max(0, currentValue + increment);
            handleGoalDataChange(studentId, goal.id, fieldToUpdate, { ...goalData, [fieldToUpdate]: newValue });
        }
    }, [getCurrentFocusedGoalInfo, handleGoalDataChange]);


    return {
        focusStudentSlot,
        cycleFocusedStudent,
        cycleFocusedGoal,
        handleDataEntryHotkey,
        triggerEditFocusedStudent,
        toggleStudentSelectionModal,
        toggleGoalSelectionModal,
        getCurrentFocusedGoalInfo
    };
}
