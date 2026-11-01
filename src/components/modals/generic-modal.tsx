
'use client';

import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface GenericModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  /**
   * Where focus goes when the window opens: its first field (the default), or the window itself. A window whose
   * first field opens a pop-up (a date or time picker) uses 'window': on an iPad, tapping a picker that already
   * had focus could leave its pop-up closed.
   */
  initialFocus?: 'first-field' | 'window';
}

export default function GenericModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footerContent,
  size = 'md',
  initialFocus = 'first-field',
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
    xl: 'sm:max-w-5xl',
    '2xl': 'sm:max-w-6xl',
    '3xl': 'sm:max-w-7xl', // New wider size
    full: 'sm:max-w-full h-full sm:h-auto',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn("overflow-y-auto max-h-[90vh]", SIZES[size])} 
        ref={modalContentRef}
        tabIndex={initialFocus === 'window' ? -1 : undefined}
        onOpenAutoFocus={initialFocus === 'window' ? (e) => { e.preventDefault(); modalContentRef.current?.focus(); } : undefined}
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

        {/* Stays in view at the bottom while a long window scrolls. */}
        {footerContent && (
          <DialogFooter className="sticky -bottom-6 -mx-6 -mb-6 gap-2 border-t bg-background px-6 py-3">
            {footerContent}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
