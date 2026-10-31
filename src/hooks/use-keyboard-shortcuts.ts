
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; 
import { useErrorLog } from './use-error-log';
import { hotkeyChar, hotkeysBlocked } from '@/lib/data-entry-hotkeys';

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
    // Alt (Option) shortcuts only; typing in a field or an open dialog takes the keys.
    if (!event.altKey || event.ctrlKey || event.metaKey || hotkeysBlocked(event)) return;

    let handled = true;
    switch (hotkeyChar(event)) {
      // Global Navigation
      case 'D': router.push('/dashboard'); break;
      case '1': router.push('/data-entry'); break;
      case '2': router.push('/manage-sessions'); break;
      case '3': router.push('/analysis-report'); break;
      case '4': router.push('/student-profile'); break;
      case '5': router.push('/goal-templates'); break;
      case '6': router.push('/changelog'); break;
      case '7': router.push('/settings'); break;
      case 'H': router.push('/help'); break;

      // Global Actions
      case 'J': toggleErrorLogModal(); break;
      case 'M': openAddStudentModal(); break;
      case 'K': if (toggleSidebar) toggleSidebar(); break;

      default: handled = false;
    }
    if (handled) event.preventDefault();
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
