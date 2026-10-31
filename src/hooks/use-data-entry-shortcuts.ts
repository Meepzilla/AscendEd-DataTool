'use client';

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Student, StudentSessionState } from '@/lib/types';
import { captureTypeOf } from '@/lib/goal-constants';
import { taskSteps } from '@/lib/task-analysis';
import { applyGoalHotkey, hotkeyChar, hotkeysBlocked, singleKeyShortcutsEnabled } from '@/lib/data-entry-hotkeys';

// Data Entry's keyboard shortcuts (listed in Help → Keyboard shortcuts). The listener is added once and always
// uses the latest values passed in.

export interface DataEntryShortcutOptions {
  selectedStudentIds: string[];
  focusedStudentSlotIndex: number;
  studentSessionStates: Record<string, StudentSessionState>;
  showArchivedByStudentId: Record<string, boolean>;
  focusedGoalIndexByStudentId: Record<string, number>;
  activeStudentsInSlots: Student[];
  isStudentAccessLocked: boolean;
  setFocusedStudentSlotIndex: Dispatch<SetStateAction<number>>;
  setFocusedGoalIndexByStudentId: Dispatch<SetStateAction<Record<string, number>>>;
  setSelectionModalType: (type: 'student' | 'goal' | null) => void;
  addStudentSlot: () => void;
  removeStudentSlot: (index: number) => void;
  openEditStudent: (student: Student) => void;
  requestAccessLock: (locked: boolean) => void;
  save: () => void;
  applyHotkeyToGoal: (studentId: string, goalId: string, key: string) => void;
}

export function useDataEntryShortcuts(options: DataEntryShortcutOptions) {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        selectedStudentIds, focusedStudentSlotIndex, studentSessionStates, showArchivedByStudentId, focusedGoalIndexByStudentId,
        activeStudentsInSlots, isStudentAccessLocked, setFocusedStudentSlotIndex, setFocusedGoalIndexByStudentId,
        setSelectionModalType, addStudentSlot, removeStudentSlot, openEditStudent, requestAccessLock, save, applyHotkeyToGoal,
      } = latest.current;
      const key = hotkeyChar(event);
      const alt = event.altKey;
      // Ctrl+Enter saves (Cmd+Enter on Apple keyboards), even while typing in a field.
      if ((event.ctrlKey || event.metaKey) && key === 'ENTER') {
        event.preventDefault();
        if (!event.repeat) save();
        return;
      }
      // Other Ctrl/Cmd combinations are the browser's (copy, paste...), and typing or an open dialog
      // takes the keys.
      if (event.ctrlKey || event.metaKey || hotkeysBlocked(event)) return;

      const studentId = selectedStudentIds[focusedStudentSlotIndex];
      const visibleGoals = (studentId && studentSessionStates[studentId]?.originalGoalHeaders
        .filter(g => !g.isArchived || showArchivedByStudentId[studentId])) || [];
      const cycleGoal = (step: number) => {
        if (!studentId || visibleGoals.length === 0) return;
        setFocusedGoalIndexByStudentId(p => ({ ...p, [studentId]: ((p[studentId] || 0) + step + visibleGoals.length) % visibleGoals.length }));
      };
      const slotCount = selectedStudentIds.length;

      if (alt) {
        let handled = true;
        switch (key) {
          case 'A': if (slotCount) setFocusedStudentSlotIndex(p => (p - 1 + slotCount) % slotCount); break; // previous student
          case 'S': cycleGoal(-1); break; // previous goal
          case 'W': addStudentSlot(); break;
          case 'Q': if (slotCount) removeStudentSlot(focusedStudentSlotIndex); break;
          case 'U': setSelectionModalType('student'); break;
          case 'T': setSelectionModalType('goal'); break;
          case 'E': {
            const focusedStudent = activeStudentsInSlots[focusedStudentSlotIndex];
            if (focusedStudent) openEditStudent(focusedStudent);
            break;
          }
          case 'L': requestAccessLock(!isStudentAccessLocked); break;
          default: handled = false;
        }
        if (handled) event.preventDefault();
        return;
      }

      // Single-key shortcuts can be turned off in Settings.
      if (!singleKeyShortcutsEnabled()) return;

      if (/^[1-4]$/.test(key)) {
        const slotIndex = Number(key) - 1;
        if (slotIndex < slotCount) setFocusedStudentSlotIndex(slotIndex);
        return;
      }
      if (key === 'A') { if (slotCount) setFocusedStudentSlotIndex(p => (p + 1) % slotCount); return; } // next student
      if (key === 'S') { cycleGoal(1); return; } // next goal

      // Data for the focused goal. Holding a key down doesn't repeat it.
      if (event.repeat || !studentId) return;
      const focusedGoal = visibleGoals[focusedGoalIndexByStudentId[studentId] ?? 0];
      if (!focusedGoal || !applyGoalHotkey(captureTypeOf(focusedGoal), key, {}, taskSteps(focusedGoal))) return;
      event.preventDefault();
      applyHotkeyToGoal(studentId, focusedGoal.id, key);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
