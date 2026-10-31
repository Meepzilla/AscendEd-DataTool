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
import { buttonVariants } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, GoalTemplate, SessionData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void; // Made optional as some actions are internal
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  itemToDelete?: Student | GoalTemplate | SessionData;
  itemToUpdate?: GoalTemplate;
  updateAction?: (id: string, data: Partial<GoalTemplate>) => Promise<void>;
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
  itemToUpdate,
  updateAction,
  deleteActionType,
}: ConfirmationModalProps) {
  const { deleteStudent, deleteGoalTemplate, deleteSession, loading: dataLoading } = useStudentData();
  const [isProcessing, setIsProcessing] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirmAction = useCallback(async () => {
    setIsProcessing(true);
    try {
      if (onConfirm) {
        await onConfirm();
      } else if (itemToDelete && deleteActionType) {
        switch (deleteActionType) {
          case 'student':
            await deleteStudent((itemToDelete as Student).id);
            break;
          case 'goalTemplate':
            await deleteGoalTemplate((itemToDelete as GoalTemplate).id);
            break;
          case 'session':
            await deleteSession((itemToDelete as SessionData).sessionId);
            break;
        }
      } else if (itemToUpdate && updateAction) {
          await updateAction(itemToUpdate.id, { isArchived: !itemToUpdate.isArchived });
      }
    } catch (error) {
      console.error(`Error performing confirm action:`, error);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  }, [onConfirm, itemToDelete, deleteActionType, itemToUpdate, updateAction, deleteStudent, deleteGoalTemplate, deleteSession, onClose]);

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
  
  const isDestructive = title.toLowerCase().includes('delete');


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
