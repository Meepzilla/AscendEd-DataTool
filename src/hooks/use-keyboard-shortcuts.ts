
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useStudentData } from './use-student-data';
import { useSidebar } from '@/components/ui/sidebar'; 
import { useErrorLog } from './use-error-log';
import { useToast } from './use-toast';

/**
 * Custom hook for managing global and page-specific keyboard shortcuts (hotkeys).
 * This hook attaches a global keydown listener and dispatches actions based on pressed keys
 * and modifier keys (Alt, Ctrl) within different parts of the application.
 */
export function useKeyboardShortcuts() {
  // Initialize Next.js router for programmatic navigation.
  const router = useRouter();
  // Get the current pathname to apply hotkeys contextually.
  const pathname = usePathname();
  const { toast } = useToast();

  // Destructure relevant functions and states from custom data and UI hooks.
  const { 
    openAddStudentModal,
    saveDataEntrySession,
    addStudentSlot,
    isStudentAccessLocked,
    setIsStudentAccessLocked,
    // Data-specific hotkey handlers are now inside useStudentData
    focusStudentSlot,
    cycleFocusedStudent,
    cycleFocusedGoal,
    handleDataEntryHotkey,
    triggerEditFocusedStudent,
    toggleStudentSelectionModal,
    toggleGoalSelectionModal,
  } = useStudentData();
  // Access sidebar toggle function from the sidebar hook.
  const { toggleSidebar } = useSidebar(); 
  // Access error log modal toggle function from the error log hook.
  const { toggleErrorLogModal } = useErrorLog();

  /**
   * Callback function to handle keydown events.
   * It prevents default browser actions for hotkeys and dispatches specific actions
   * based on the key, modifier keys (Alt, Ctrl), and current page context.
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    // Ignore hotkeys if the user is typing in an input field, textarea, select, or contenteditable element,
    // unless it's a Ctrl+Enter combination (which is typically for form submission).
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
      if (event.ctrlKey && event.key === 'Enter') {
         // Allow Ctrl+Enter to bubble up for forms/modals to handle their own submission.
         // This specific case is not prevented, allowing default form submission if applicable.
      } else {
        return; // Do not process other hotkeys if the user is actively typing.
      }
    }
    
    // Extract key and modifier states for easier access.
    const key = event.key.toUpperCase();
    const alt = event.altKey;
    const ctrl = event.ctrlKey;
    const isDataEntryContext = pathname.startsWith('/data-entry');


    const showAccessLockedToast = () => {
      toast({
        title: "Access Locked",
        description: "Hotkeys for data modification are disabled. Unlock to make changes.",
        variant: "default",
      });
    };

    // -- Ctrl+Enter Hotkey (Global for form submission / Data Entry save) --
    if (ctrl && key === 'ENTER') {
      if (isDataEntryContext) {
        event.preventDefault(); // Prevent default browser form submission behavior (e.g., new line in textarea).
        if (isStudentAccessLocked) {
          showAccessLockedToast();
          return;
        }
        saveDataEntrySession(); // Trigger the save action for data entry sessions.
      }
      return; // Stop further processing after handling Ctrl+Enter.
    }

    // -- Alt-Modifier Hotkeys (Global Navigation & Actions, some Data Entry actions) --
    if (alt) {
      event.preventDefault(); // Prevent browser's default Alt key behavior (e.g., opening file menu).
      switch (key) {
        // Global Navigation Hotkeys: Navigate to different pages
        case 'D': router.push('/dashboard'); break; // Alt+D to Dashboard
        case '1': router.push('/data-entry'); break; // Alt+1 to Data Entry
        case '2': router.push('/manage-sessions'); break; 
        case '3': router.push('/analysis-report'); break;
        case '4': router.push('/student-profile'); break;
        case '5': router.push('/goal-templates'); break;
        case '6': router.push('/changelog'); break; // Alt+6 to Changelog
        case 'H': router.push('/help'); break; // Alt+H to Help Page

        // Global Action Hotkeys: Trigger application-wide actions
        case 'J': toggleErrorLogModal(); break; // Alt+J to toggle Error Log Modal visibility
        case 'L': if (isDataEntryContext) setIsStudentAccessLocked(prev => !prev); break;
        case 'M': openAddStudentModal(); break; // Alt+M to open the Add Student Modal
        
        case 'K': if (toggleSidebar) toggleSidebar(); break; // Alt+K to toggle Sidebar
        
        // Data Entry Page Specific Actions (with Alt modifier)
        case 'W': 
          if (isDataEntryContext) {
            if (isStudentAccessLocked) { showAccessLockedToast(); return; }
            addStudentSlot();
          }
          break; // Alt+W to add a new student slot
        case 'U': if (isDataEntryContext) toggleStudentSelectionModal(); break; // Alt+U to open student selection
        case 'T': if (isDataEntryContext) toggleGoalSelectionModal(); break; // Alt+T to open goal selection
        case 'A': if (isDataEntryContext) cycleFocusedStudent('prev'); break; // Alt+A to cycle to the previous student slot
        case 'S': if (isDataEntryContext) cycleFocusedGoal('prev'); break; // Alt+S to cycle to the previous goal for the focused student
        case 'E': 
          if (isDataEntryContext) {
            if (isStudentAccessLocked) { showAccessLockedToast(); return; }
            triggerEditFocusedStudent();
          }
          break; // Alt+E to open edit modal for the focused student
        
        // Data Entry Hotkeys for decrementing prompt counts (Alt + key combination)
        case 'C': // Decrement Correct / Total Syllables / Trials Accepted
        case 'N': // Decrement Incorrect / Stuttered Syllables / Trials Refused
        case 'V': // Decrement Verbal Prompt count
        case 'G': // Decrement Gestural Prompt count
        case 'P': // Decrement Partial Physical Prompt count
        case 'F': // Decrement Imitation Prompt count
        case 'I': // Decrement Independent count
        case 'B': // Decrement Approximate
        case 'D': // Decrement Visual Prompt count
        case 'R':
        case 'H':
        case 'J':
           if (isDataEntryContext) {
             if (isStudentAccessLocked) { showAccessLockedToast(); return; }
             handleDataEntryHotkey(key, alt); 
           }
           break;
        default: break;
      }
    } else if (!alt && !ctrl) { // -- Simple Key Presses (no Alt or Ctrl modifiers) --
        // Data Entry Page Specific Actions (without Alt/Ctrl modifier): Focus slots or increment counts
        if (isDataEntryContext) {
            switch (key) {
                // Hotkeys to directly focus student slots (1, 2, 3, 4)
                case '1': case '2': case '3': case '4':
                    focusStudentSlot(parseInt(key, 10) - 1); // Convert key ('1' to 0, '2' to 1, etc.) and focus the corresponding slot.
                    break;
                case 'A': cycleFocusedStudent('next'); break; // 'A' to cycle to the next student slot
                case 'S': cycleFocusedGoal('next'); break; // 'S' to cycle to the next goal for the focused student
                
                // Data Entry Hotkeys for incrementing prompt counts (No Alt/Ctrl modifier)
                case 'B': // Increment Approximate
                case 'C': // Increment Correct / Total Syllables / Trials Accepted
                case 'N': // Increment Incorrect / Stuttered Syllables / Trials Refused
                case 'D': // Increment Visual Prompt count
                case 'V': // Increment Verbal Prompt count
                case 'G': // Increment Gestural Prompt count
                case 'P': // Increment Partial Physical Prompt count
                case 'F': // Increment Imitation Prompt count
                case 'I': // Increment Independent count
                case 'R':
                case 'H':
                case 'J':
                    if (isStudentAccessLocked) { showAccessLockedToast(); return; }
                    handleDataEntryHotkey(key, alt); // Pass the key and `false` for `alt` (no alt pressed).
                    break;
                default: break;
            }
        }
    }

  }, [
    router,
    pathname,
    toast,
    isStudentAccessLocked,
    openAddStudentModal,
    toggleSidebar,
    toggleErrorLogModal,
    focusStudentSlot,
    cycleFocusedStudent,
    cycleFocusedGoal,
    handleDataEntryHotkey,
    saveDataEntrySession,
    triggerEditFocusedStudent,
    toggleStudentSelectionModal,
    toggleGoalSelectionModal,
    addStudentSlot,
    setIsStudentAccessLocked,
  ]);

  // Effect hook to attach and clean up the global keydown event listener.
  useEffect(() => {
    // Add the event listener when the component mounts.
    window.addEventListener('keydown', handleKeyDown);
    // Return a cleanup function to remove the event listener when the component unmounts.
    // This prevents memory leaks and ensures event listeners are properly managed.
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]); // Dependency array: ensures the listener is re-attached only if the `handleKeyDown` function itself changes.
}
