'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button'; // Keep for triggering if needed, though AlertDialogTrigger is typical
import { useStudentData } from '@/hooks/use-student-data'; // Import useStudentData
import type { Student, GoalTemplate, SessionData } from '@/lib/types';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void; // This onConfirm might now trigger context action
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  itemToDelete?: Student | GoalTemplate | SessionData | null; // Item to be deleted
  deleteActionType?: 'student' | 'goalTemplate' | 'session'; // Type of item to delete
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm, // This prop might become redundant if context handles all logic
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  itemToDelete,
  deleteActionType,
}: ConfirmationModalProps) {
  const { 
    deleteStudent: contextDeleteStudent, 
    deleteGoalTemplate: contextDeleteGoalTemplate, 
    deleteSession: contextDeleteSession,
    loading: dataLoading,
  } = useStudentData();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!itemToDelete || !deleteActionType) {
      onConfirm(); // Fallback to original onConfirm if item/type not provided
      return;
    }

    setIsDeleting(true);
    try {
      switch (deleteActionType) {
        case 'student':
          await contextDeleteStudent(itemToDelete.id);
          break;
        case 'goalTemplate':
          await contextDeleteGoalTemplate(itemToDelete.id);
          break;
        case 'session':
          await contextDeleteSession((itemToDelete as SessionData).sessionId);
          break;
        default:
          console.warn("Unknown delete action type");
      }
      // The onSnapshot in useStudentData should update UI.
      // Toast notifications are handled within context delete functions.
    } catch (error) {
      console.error(`Error deleting ${deleteActionType}:`, error);
      // Toast for error might be good here if not handled in context
    } finally {
      setIsDeleting(false);
      onClose(); // Close modal after action
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isDeleting || dataLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isDeleting || dataLoading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {isDeleting || dataLoading ? 'Deleting...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
