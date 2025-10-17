
'use client';

import { useState, useCallback } from 'react';
import type { Student, Goal, GoalTemplate, SessionData } from '@/lib/types';

export function useModalState() {
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [deletingItem, setDeletingItem] = useState<{ item: Student | GoalTemplate | SessionData | null, type: 'student' | 'goalTemplate' | 'session' } | null>(null);
    const [deletingAssignedGoal, setDeletingAssignedGoal] = useState<{ studentId: string; goal: Goal } | null>(null);
    const [isAddGoalTemplateModalOpen, setIsAddGoalTemplateModalOpen] = useState(false);
    const [addGoalTemplateInitialPrompt, setAddGoalTemplateInitialPrompt] = useState<string | null>(null);
    const [editingGoalTemplate, setEditingGoalTemplate] = useState<GoalTemplate | null>(null);
    const [editingSession, setEditingSession] = useState<SessionData | null>(null);
    const [deletingSession, setDeletingSession] = useState<SessionData | null>(null);
    const [editingAssignedGoal, setEditingAssignedGoal] = useState<{ studentId: string; goal: Goal } | null>(null);
    const [selectionModalType, setSelectionModalType] = useState<'student' | 'goal' | null>(null);

    const openAddStudentModal = useCallback(() => setIsAddStudentModalOpen(true), []);
    const closeAddStudentModal = useCallback(() => setIsAddStudentModalOpen(false), []);

    const openEditStudentModal = useCallback((student: Student) => setEditingStudent(student), []);
    const closeEditStudentModal = useCallback(() => setEditingStudent(null), []);

    const openDeleteConfirmationModal = useCallback((item: any, type: any) => setDeletingItem({ item, type }), []);
    const closeDeleteConfirmationModal = useCallback(() => setDeletingItem(null), []);

    const openDeleteAssignedGoalConfirmationModal = useCallback((studentId: string, goal: Goal) => setDeletingAssignedGoal({ studentId, goal }), []);
    const closeDeleteAssignedGoalConfirmationModal = useCallback(() => setDeletingAssignedGoal(null), []);

    const openAddGoalTemplateModal = useCallback((initialPrompt?: string) => {
        setAddGoalTemplateInitialPrompt(initialPrompt || null);
        setIsAddGoalTemplateModalOpen(true);
    }, []);
    const closeAddGoalTemplateModal = useCallback(() => {
        setIsAddGoalTemplateModalOpen(false);
        setAddGoalTemplateInitialPrompt(null);
    }, []);

    const openEditGoalTemplateModal = useCallback((template: GoalTemplate) => setEditingGoalTemplate(template), []);
    const closeEditGoalTemplateModal = useCallback(() => setEditingGoalTemplate(null), []);

    const openEditSessionModal = useCallback((session: SessionData) => setEditingSession(session), []);
    const closeEditSessionModal = useCallback(() => setEditingSession(null), []);

    const openDeleteSessionModal = useCallback((session: SessionData | null) => setDeletingSession(session), []);
    const closeDeleteSessionModal = useCallback(() => setDeletingSession(null), []);

    const openEditAssignedGoalModal = useCallback((studentId: string, goal: Goal) => setEditingAssignedGoal({ studentId, goal }), []);
    const closeEditAssignedGoalModal = useCallback(() => setEditingAssignedGoal(null), []);
    
    const toggleStudentSelectionModal = useCallback(() => setSelectionModalType(p => p === 'student' ? null : 'student'), []);
    const toggleGoalSelectionModal = useCallback(() => setSelectionModalType(p => p === 'goal' ? null : 'goal'), []);


    return {
        isAddStudentModalOpen, openAddStudentModal, closeAddStudentModal,
        editingStudent, openEditStudentModal, closeEditStudentModal,
        deletingStudent: deletingItem, openDeleteConfirmationModal, closeDeleteConfirmationModal,
        deletingAssignedGoal, openDeleteAssignedGoalConfirmationModal, closeDeleteAssignedGoalConfirmationModal,
        isAddGoalTemplateModalOpen, openAddGoalTemplateModal, closeAddGoalTemplateModal, addGoalTemplateInitialPrompt,
        editingGoalTemplate, openEditGoalTemplateModal, closeEditGoalTemplateModal,
        editingSession, openEditSessionModal, closeEditSessionModal,
        deletingSession, openDeleteSessionModal, closeDeleteSessionModal,
        editingAssignedGoal, openEditAssignedGoalModal, closeEditAssignedGoalModal,
        selectionModalType, setSelectionModalType,
        toggleStudentSelectionModal, toggleGoalSelectionModal,
    };
}
