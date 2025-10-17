
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
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: ConfirmationModalProps) {
  const { loading: dataLoading } = useStudentData();
  const [isProcessing, setIsProcessing] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirmAction = useCallback(async () => {
    if (!onConfirm) return;
    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error(`Error performing confirm action:`, error);
    } finally {
      setIsProcessing(false);
      onClose();
    }
  }, [onConfirm, onClose]);

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
