
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
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, GoalTemplate, SessionData } from '@/lib/types';
import { cn } from '@/lib/utils'; // Import cn

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
  const [isProcessing, setIsProcessing] = useState(false); // Renamed from isDeleting for clarity
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirmAction = useCallback(async () => {
    if (deleteActionType && !itemToDelete) { // If it's a delete action, itemToDelete must exist
      onConfirm?.(); // Call generic confirm if provided
      if (!onConfirm) onClose();
      return;
    }
    
    setIsProcessing(true);
    try {
      if (deleteActionType && itemToDelete) {
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
      } else if (onConfirm) { // Handle generic confirm actions
        await onConfirm();
      }
    } catch (error) {
      console.error(`Error performing action (${deleteActionType || 'confirm'}):`, error);
      // Toast or error handling can be added here if needed
    } finally {
      setIsProcessing(false);
      onClose(); 
    }
  }, [itemToDelete, deleteActionType, contextDeleteStudent, contextDeleteGoalTemplate, contextDeleteSession, onClose, onConfirm]);

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
          <AlertDialogCancel onClick={onClose} disabled={isProcessing || dataLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            ref={confirmButtonRef} 
            onClick={handleConfirmAction} 
            disabled={isProcessing || dataLoading}
            className={cn(buttonVariants({ variant: deleteActionType ? 'destructive' : 'default' }))}
          >
            {isProcessing || dataLoading ? (deleteActionType ? 'Deleting...' : 'Processing...') : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

