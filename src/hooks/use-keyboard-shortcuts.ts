'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; // Assuming useSidebar hook is available from ShadCN sidebar

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { openAddStudentModal } = useStudentData();
  const { toggleSidebar } = useSidebar(); // From ShadCN sidebar context

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Prevent shortcuts if an input, textarea, or select is focused
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
      return;
    }

    if (event.altKey) {
      switch (event.key.toUpperCase()) {
        // Navigation Hotkeys (Alt+1 to Alt+5)
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
        case 'D': // For Dashboard
          event.preventDefault();
          router.push('/dashboard');
          break;

        // Action Hotkeys
        case 'H': // Help
          event.preventDefault();
          // TODO: Implement Help Modal Toggle
          alert('Help (Alt+H) shortcut pressed. Implement help modal.');
          break;
        case 'L': // Error Log
          event.preventDefault();
          // TODO: Implement Error Log Modal Toggle
          alert('Error Log (Alt+L) shortcut pressed. Implement error log modal.');
          break;
        case 'M': // Add Student Modal
          event.preventDefault();
          openAddStudentModal();
          break;
        case 'B': // Toggle Sidebar
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
