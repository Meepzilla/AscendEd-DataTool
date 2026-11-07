import type { StudentSessionState } from './types';
import * as secureStore from './secure-store';
import { clearStorageFailure, reportStorageFailure } from './storage-failure';

// Unsaved Data Entry work, kept on the device so it is still there after switching pages, closing the app
// or reloading. It is updated on every change; a student drops out of it once their session is saved or
// reset (nothing left that differs from the starting values).
//
// A failed save is no longer swallowed: saveDataEntryDraft returns whether the draft landed, and records
// the failure (shown as a persistent warning on the Data Entry screen until a save lands) — the entries
// themselves stay in memory on that screen, so the user can still save the sessions or retry the draft.

const DRAFT_KEY_BASE = 'ascended_data_entry_draft_v1';

const draftKey = (uid: string | undefined) => `${DRAFT_KEY_BASE}_${uid}`;
/** The draft's storage key (for matching a background write failure back to the draft). */
export const dataEntryDraftKey = draftKey;

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

export function loadDataEntryDraft(uid: string | undefined): DataEntryDraft | null {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const stored = secureStore.getItem(draftKey(uid));
    if (!stored) return null;
    const draft = JSON.parse(stored) as DataEntryDraft;
    return draft && typeof draft === 'object' && draft.students && Array.isArray(draft.selectedStudentIds) ? draft : null;
  } catch {
    return null;
  }
}

/**
 * Saves the draft; true when it landed (or there was no user to save it for). False when storage is
 * full or unavailable — and the failure is recorded, so the Data Entry screen can show that the
 * unsaved work is only in memory until it is saved or the draft is retried. A later successful
 * save clears the failure. Note this only covers the synchronous write: with passcode protection
 * on, the encrypted write lands in the background, and a failure there is reported through the
 * secure-store write-error handler instead (matched back to the draft by its key).
 */
export function saveDataEntryDraft(uid: string | undefined, draft: DataEntryDraft): boolean {
  if (!uid) return true;
  try {
    secureStore.setItem(draftKey(uid), JSON.stringify(draft));
    // With protection on the write finishes in the background: the warning clears once it is stored, not
    // before (clearing early made every later failure look new, so it was reported again on every save).
    secureStore.afterStored(draftKey(uid), () => clearStorageFailure('draft'));
    return true;
  } catch (error) {
    reportStorageFailure('draft', error);
    return false;
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
