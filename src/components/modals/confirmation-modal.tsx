
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
import { Button, buttonVariants } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, Goal, GoalTemplate, SessionData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  itemToDelete?: Student | GoalTemplate | SessionData | Goal | null;
  itemToUpdate?: Student | null; // Added for updates like archiving
  updateAction?: (id: string, data: Partial<Student>) => void; // Action for updates
  deleteActionType?: 'student' | 'goalTemplate' | 'session';
  actionType?: 'student' | 'goalTemplate' | 'session' | 'assignedGoal'; // More generic for updates
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
  itemToUpdate,
  updateAction,
  actionType,
}: ConfirmationModalProps) {
  const {
    deleteStudent: contextDeleteStudent,
    deleteGoalTemplate: contextDeleteGoalTemplate,
    deleteSession: contextDeleteSession,
    loading: dataLoading,
  } = useStudentData();
  const [isProcessing, setIsProcessing] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirmAction = useCallback(async () => {
    setIsProcessing(true);
    try {
      if (itemToUpdate && updateAction && actionType === 'student') {
        // Handle update actions like archiving
        await updateAction(itemToUpdate.id, { isArchived: itemToUpdate.isArchived });
      } else if (itemToDelete && actionType) {
        // Handle delete actions
        switch (actionType) {
          case 'student':
            await contextDeleteStudent((itemToDelete as Student).id);
            break;
          case 'goalTemplate':
            await contextDeleteGoalTemplate((itemToDelete as GoalTemplate).id);
            break;
          case 'session':
            await contextDeleteSession((itemToDelete as SessionData).sessionId);
            break;
          default:
            console.warn("Unknown action type for deletion");
        }
      } else if (onConfirm) {
        // Handle generic confirm actions
        await onConfirm();
      }
    } catch (error) {
      console.error(`Error performing action (${actionType || 'confirm'}):`, error);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  }, [itemToDelete, itemToUpdate, updateAction, actionType, contextDeleteStudent, contextDeleteGoalTemplate, contextDeleteSession, onClose, onConfirm]);

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
  
  const isDestructive = actionType === 'student' && itemToUpdate ? !itemToUpdate.isArchived : true;


  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isProcessing || dataLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            ref={confirmButtonRef}
            onClick={handleConfirmAction}
            disabled={isProcessing || dataLoading}
            className={cn(buttonVariants({ variant: isDestructive ? 'destructive' : 'default' }))}
          >
            {isProcessing || dataLoading ? 'Processing...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
