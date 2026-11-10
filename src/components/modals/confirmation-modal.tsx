'use client';

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
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
import { getStorageFailure, subscribeStorageFailures } from '@/lib/storage-failure';
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
  const [actionError, setActionError] = useState<string | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  // A save that failed (the device's storage is full, say) records a failure instead of
  // reporting back through the delete and update actions, which return nothing. Watching the
  // record lets a failed action be told apart from one that was stored: a failure recorded
  // while this confirmation ran means the change was not saved.
  const saveFailure = useSyncExternalStore(
    subscribeStorageFailures,
    () => getStorageFailure('save'),
    () => null,
  );
  const saveFailureRef = useRef(saveFailure);
  saveFailureRef.current = saveFailure;

  const handleConfirmAction = useCallback(async () => {
    setIsProcessing(true);
    setActionError(null);
    const failureBefore = saveFailureRef.current;
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
      // The action failed: stay open and say so, instead of closing as if it had worked.
      setActionError('That could not be done. Nothing was changed — you can try again, or cancel.');
      setIsProcessing(false);
      return;
    }
    setIsProcessing(false);
    if (saveFailureRef.current !== null && saveFailureRef.current !== failureBefore) {
      // No error was thrown, but the change was not stored either (storage full): stay open.
      setActionError('That could not be saved on this device. Nothing was changed — you can try again, or cancel.');
      return;
    }
    onClose();
  }, [onConfirm, itemToDelete, deleteActionType, itemToUpdate, updateAction, deleteStudent, deleteGoalTemplate, deleteSession, onClose]);

  // A fresh showing starts without the last attempt's error.
  useEffect(() => {
    if (isOpen) setActionError(null);
  }, [isOpen]);

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
        {actionError && <p className="text-sm text-destructive" role="alert">{actionError}</p>}
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
