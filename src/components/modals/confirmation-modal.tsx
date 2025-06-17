
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, GoalTemplate, SessionData } from '@/lib/types';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void; 
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  itemToDelete?: Student | GoalTemplate | SessionData | null; 
  deleteActionType?: 'student' | 'goalTemplate' | 'session'; 
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm, 
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
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirmAction = useCallback(async () => {
    if (!itemToDelete || !deleteActionType) {
      onConfirm?.(); 
      if (!onConfirm) onClose(); // Close if no custom confirm and no item
      return;
    }

    setIsDeleting(true);
    try {
      switch (deleteActionType) {
        case 'student':
          await contextDeleteStudent(itemToDelete.id); // itemToDelete.id should be studentId
          break;
        case 'goalTemplate':
          await contextDeleteGoalTemplate(itemToDelete.id); // itemToDelete.id should be templateId
          break;
        case 'session':
          await contextDeleteSession((itemToDelete as SessionData).sessionId);
          break;
        default:
          console.warn("Unknown delete action type");
      }
    } catch (error) {
      console.error(`Error deleting ${deleteActionType}:`, error);
    } finally {
      setIsDeleting(false);
      onClose(); 
    }
  }, [itemToDelete, deleteActionType, contextDeleteStudent, contextDeleteGoalTemplate, contextDeleteSession, onClose, onConfirm, dataLoading]);

  useEffect(() => {
    if (isOpen) {
      const handleCtrlEnter = (event: KeyboardEvent) => {
        if (event.ctrlKey && event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          confirmButtonRef.current?.click();
        }
      };
      document.addEventListener('keydown', handleCtrlEnter);
      return () => {
        document.removeEventListener('keydown', handleCtrlEnter);
      };
    }
  }, [isOpen, handleConfirmAction]);

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
          <AlertDialogAction ref={confirmButtonRef} onClick={handleConfirmAction} disabled={isDeleting || dataLoading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {isDeleting || dataLoading ? 'Deleting...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

