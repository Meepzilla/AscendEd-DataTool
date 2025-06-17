
'use client';

import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GenericModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; // Added sizing options
  // onOpenAutoFocus?: (event: Event) => void; // For focus trapping
}

export default function GenericModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footerContent,
  size = 'md',
  // onOpenAutoFocus,
}: GenericModalProps) {
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);
  
  // Focus trapping and return focus on close is handled by ShadCN Dialog

  const SIZES = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-xl',
    xl: 'sm:max-w-5xl', // Changed from sm:max-w-3xl
    full: 'sm:max-w-full h-full sm:h-auto',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn("overflow-y-auto max-h-[90vh]", SIZES[size])} 
        ref={modalContentRef}
        // onOpenAutoFocus={onOpenAutoFocus} // Pass to DialogContent if needed
        onPointerDownOutside={(e) => {
            // Allow closing by clicking outside only if not interacting with a select/popover inside modal
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]')) {
                e.preventDefault();
            }
        }}
        onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]')) {
                e.preventDefault();
            }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        <div className="py-4">
          {children}
        </div>

        {footerContent && (
          <DialogFooter>
            {footerContent}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
