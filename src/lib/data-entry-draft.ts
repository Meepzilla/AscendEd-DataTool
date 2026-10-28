import type { StudentSessionState } from './types';

// Unsaved Data Entry work, kept on the device so it is still there after switching pages, closing the app
// or reloading. It is updated on every change; a student drops out of it once their session is saved or
// reset (nothing left that differs from the starting values).

const DRAFT_KEY_BASE = 'ascended_data_entry_draft_v1';

export interface DataEntryDraft {
  savedAt: string; // ISO
  sessionDate?: string; // ISO
  sessionTime: string;
  sessionEndTime: string;
  selectedStudentIds: string[];
  focusedStudentSlotIndex: number;
  focusedGoalIndexByStudentId: Record<string, number>;
  isStudentAccessLocked: boolean;
  isHeaderCardCollapsed: boolean;
  students: Record<string, Pick<StudentSessionState, 'activity' | 'notes' | 'goalData'>>;
}

const draftKey = (uid: string) => `${DRAFT_KEY_BASE}_${uid}`;

export function loadDataEntryDraft(uid: string | undefined): DataEntryDraft | null {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(draftKey(uid));
    if (!stored) return null;
    const draft = JSON.parse(stored) as DataEntryDraft;
    return draft && typeof draft === 'object' && draft.students && Array.isArray(draft.selectedStudentIds) ? draft : null;
  } catch {
    return null;
  }
}

export function saveDataEntryDraft(uid: string | undefined, draft: DataEntryDraft) {
  if (!uid) return;
  try {
    window.localStorage.setItem(draftKey(uid), JSON.stringify(draft));
  } catch {
    // Storage full or unavailable: the draft just isn't kept.
  }
}

/**
 * Whether a student has anything entered that hasn't been saved: activity, notes, or goal data that
 * differs from the goal type's starting values (`defaultsFor`).
 */
export function hasUnsavedEntry(
  state: Pick<StudentSessionState, 'activity' | 'notes' | 'goalData'> | undefined,
  defaultsFor: (goalId: string) => Record<string, any> | undefined,
): boolean {
  if (!state) return false;
  if (String(state.activity || '').trim() || String(state.notes || '').trim()) return true;
  return Object.entries(state.goalData || {}).some(([goalId, data]) => {
    const defaults = defaultsFor(goalId);
    return defaults !== undefined && JSON.stringify(data) !== JSON.stringify(defaults);
  });
}
