
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; 

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { openAddStudentModal } = useStudentData();
  const { toggleSidebar } = useSidebar(); 

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
          // This should ideally open the ErrorLogModal from AppHeader
          // For now, direct modal control from here is complex.
          // The user can click the icon or we can expose a context function for ErrorLogModal.
          // For simplicity, this alert remains, or we rely on user clicking the header icon.
          alert('Error Log (Alt+L) shortcut pressed. Use header icon to open Error Log.');
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
  }, [router, openAddStudentModal, toggleSidebar]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
