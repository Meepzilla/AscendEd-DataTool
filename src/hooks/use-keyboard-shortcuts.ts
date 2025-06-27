
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; 
import { useErrorLog } from './use-error-log';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { 
    openAddStudentModal,
    focusStudentSlot,
    cycleFocusedStudent,
    cycleFocusedGoal,
    handleDataEntryHotkey,
    saveDataEntrySession,
    triggerEditFocusedStudent,
  } = useStudentData();
  const { toggleSidebar } = useSidebar(); 
  const { toggleErrorLogModal } = useErrorLog();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
      if (event.ctrlKey && event.key === 'Enter') {
         // Allow Ctrl+Enter to bubble up for forms/modals
      } else {
        return;
      }
    }
    
    // Global and Page-Specific Hotkeys
    const key = event.key.toUpperCase();
    const alt = event.altKey;
    const ctrl = event.ctrlKey;

    if (ctrl && key === 'ENTER') {
      if (pathname.startsWith('/data-entry')) {
        event.preventDefault();
        saveDataEntrySession();
      }
      return; // Assuming modals will handle their own Ctrl+Enter
    }

    if (alt) {
      event.preventDefault(); // Prevent browser menu activation
      switch (key) {
        // Global Navigation
        case 'D': router.push('/dashboard'); break;
        case '1': router.push('/student-profile'); break;
        case '2': router.push('/goal-templates'); break;
        case '3': router.push('/data-entry'); break;
        case '4': router.push('/manage-sessions'); break;
        case '5': router.push('/analysis-report'); break;
        case '6': router.push('/changelog'); break;
        case 'H': router.push('/help'); break;
        // Global Actions
        case 'L': toggleErrorLogModal(); break;
        case 'M': openAddStudentModal(); break;
        case 'B': if (toggleSidebar) toggleSidebar(); break;
        
        // Data Entry Page Actions
        case 'A': if (pathname.startsWith('/data-entry')) cycleFocusedStudent('prev'); break;
        case 'S': if (pathname.startsWith('/data-entry')) cycleFocusedGoal('prev'); break;
        case 'E': if (pathname.startsWith('/data-entry')) triggerEditFocusedStudent(); break;
        case 'C':
        case 'N':
        case 'V': // Hotkey for Verbal prompt
        case 'G':
        case 'P':
        case 'F':
        case 'I':
           if (pathname.startsWith('/data-entry')) handleDataEntryHotkey(key, alt); 
           break;
        case 'D': // Visual prompt hotkey (Alt+D)
            if (pathname.startsWith('/data-entry')) handleDataEntryHotkey(key, alt);
            break;
        default: break;
      }
    } else if (!alt && !ctrl) { // Simple key presses (no modifier)
        if (pathname.startsWith('/data-entry')) {
            switch (key) {
                case '1': case '2': case '3': case '4':
                    focusStudentSlot(parseInt(key, 10) - 1);
                    break;
                case 'A': cycleFocusedStudent('next'); break;
                case 'S': cycleFocusedGoal('next'); break;
                case 'C':
                case 'N':
                case 'D': // Visual Prompt
                case 'V': // Verbal Prompt
                case 'G':
                case 'P':
                case 'F':
                case 'I':
                    handleDataEntryHotkey(key, alt);
                    break;
                default: break;
            }
        }
    }

  }, [
    router,
    pathname,
    openAddStudentModal,
    toggleSidebar,
    toggleErrorLogModal,
    focusStudentSlot,
    cycleFocusedStudent,
    cycleFocusedGoal,
    handleDataEntryHotkey,
    saveDataEntrySession,
    triggerEditFocusedStudent
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
