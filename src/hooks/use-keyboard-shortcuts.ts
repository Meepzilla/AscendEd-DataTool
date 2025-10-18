
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; 
import { useErrorLog } from './use-error-log';

/**
 * This hook now only handles GLOBAL keyboard shortcuts.
 * Data-entry specific shortcuts are handled within DataEntryContent.tsx
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const { openAddStudentModal } = useStudentData();
  const { toggleSidebar } = useSidebar(); 
  const { toggleErrorLogModal } = useErrorLog();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
      if (event.ctrlKey && event.key === 'Enter') {
         // Allow this combo
      } else {
        return; 
      }
    }
    
    const key = event.key.toUpperCase();
    const alt = event.altKey;

    if (alt) {
      event.preventDefault(); 
      switch (key) {
        // Global Navigation
        case 'D': router.push('/dashboard'); break;
        case '1': router.push('/data-entry'); break; 
        case '2': router.push('/manage-sessions'); break; 
        case '3': router.push('/analysis-report'); break;
        case '4': router.push('/student-profile'); break;
        case '5': router.push('/goal-templates'); break;
        case '6': router.push('/changelog'); break;
        case 'H': router.push('/help'); break; 

        // Global Actions
        case 'J': toggleErrorLogModal(); break; 
        case 'M': openAddStudentModal(); break;
        case 'K': if (toggleSidebar) toggleSidebar(); break;
        
        default: break;
      }
    }
  }, [
    router,
    openAddStudentModal,
    toggleSidebar,
    toggleErrorLogModal,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
