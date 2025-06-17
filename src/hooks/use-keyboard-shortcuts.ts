
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; 
import { useErrorLog } from './use-error-log'; // Import useErrorLog

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { openAddStudentModal } = useStudentData();
  const { toggleSidebar } = useSidebar(); 
  const { toggleErrorLogModal } = useErrorLog(); // Get toggle function from context

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
      return;
    }

    if (event.altKey) {
      switch (event.key.toUpperCase()) {
        case '1':
          event.preventDefault();
          router.push('/student-profile');
          break;
        case '2':
          event.preventDefault();
          router.push('/goal-templates');
          break;
        case '3':
          event.preventDefault();
          router.push('/data-entry');
          break;
        case '4':
          event.preventDefault();
          router.push('/manage-sessions');
          break;
        case '5':
          event.preventDefault();
          router.push('/analysis-report');
          break;
        case '6': // Hotkey for Changelog
          event.preventDefault();
          router.push('/changelog');
          break;
        case 'D': 
          event.preventDefault();
          router.push('/dashboard');
          break;
        case 'H': 
          event.preventDefault();
          router.push('/help');
          break;
        case 'L': 
          event.preventDefault();
          toggleErrorLogModal(); // Call the context function to toggle the modal
          break;
        case 'M': 
          event.preventDefault();
          openAddStudentModal();
          break;
        case 'B': 
          event.preventDefault();
          if (toggleSidebar) toggleSidebar();
          break;
        default:
          break;
      }
    }
  }, [router, openAddStudentModal, toggleSidebar, toggleErrorLogModal]); // Added toggleErrorLogModal dependency

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
