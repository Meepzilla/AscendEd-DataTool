// First-run passcode onboarding: passcode protection is the default for new installs.
//
// On a fresh install (no passcode set, no student or session data yet, no decision recorded) the app
// asks before it opens: set a passcode, or continue without one only after acknowledging that the
// student data on the device will not be encrypted. On a device that already has student data the
// prompt is a one-time offer instead: existing data is never locked behind a passcode, and the offer
// can be dismissed for the session. The decision is plain localStorage, not encrypted: it only
// records which choice was made, and the passcode config itself (ascended_passcode_v1) is the
// authority on whether protection is on.

import { isPasscodeEnabled } from './secure-store';

/** Plain localStorage key for the first-run decision. Device-wide, like the passcode config. */
export const PASSCODE_DECISION_KEY = 'ascended_passcode_decision_v1';

/** Keys holding student data (same shape as the sensitive keys in secure-store). */
const STUDENT_DATA_KEYS = /^ascended_(students_v2|sessions_v2|data_entry_draft_v1)_/;
/** The encrypted form of a stored value (see secure-store). */
const ENCRYPTED_PREFIX = 'enc1:';

export type PasscodeDecisionChoice = 'passcode' | 'opted-out';

export interface PasscodeDecision {
  v: 1;
  choice: PasscodeDecisionChoice;
  /** When the decision was made (ISO date string). */
  at: string;
}

function readDecisionRaw(): PasscodeDecision | null {
  try {
    const raw = localStorage.getItem(PASSCODE_DECISION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      (parsed as PasscodeDecision).v === 1 &&
      ((parsed as PasscodeDecision).choice === 'passcode' || (parsed as PasscodeDecision).choice === 'opted-out') &&
      typeof (parsed as PasscodeDecision).at === 'string'
    ) {
      return parsed as PasscodeDecision;
    }
    return null;
  } catch {
    return null;
  }
}

/** The recorded first-run decision, or null when none was made yet. */
export function getPasscodeDecision(): PasscodeDecision | null {
  if (typeof window === 'undefined') return null;
  return readDecisionRaw();
}

/** Records the first-run decision (plain localStorage) and returns it. */
export function recordPasscodeDecision(choice: PasscodeDecisionChoice): PasscodeDecision {
  const decision: PasscodeDecision = { v: 1, choice, at: new Date().toISOString() };
  localStorage.setItem(PASSCODE_DECISION_KEY, JSON.stringify(decision));
  return decision;
}

/**
 * Whether a stored value under a student-data key counts as existing data. A stored empty list
 * (`[]`, or `{}` for a draft) does not: the app only writes those after a user action, and an
 * empty list holds no student data. An encrypted value, a non-empty list, or a value that can't
 * be read at all does count: damaged data must never be mistaken for a fresh install.
 */
function valueHoldsData(value: string | null): boolean {
  if (!value || value === '[]' || value === '{}') return false;
  if (value.startsWith(ENCRYPTED_PREFIX)) return true;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === 'object' && parsed !== null) return Object.keys(parsed).length > 0;
    return true;
  } catch {
    // Unreadable stored data is still data: never treat a damaged install as fresh.
    return true;
  }
}

/**
 * Whether any student or session data is already stored on this device. Goal templates are
 * not counted: the app seeds over 900 of them on first load, so they say nothing about whether
 * the install has been used.
 */
export function hasExistingStudentData(): boolean {
  if (typeof window === 'undefined') return false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && STUDENT_DATA_KEYS.test(key) && valueHoldsData(localStorage.getItem(key))) return true;
  }
  return false;
}

/**
 * Whether to show the first-run setup prompt (a hard choice before the app opens): a fresh
 * install with no passcode, no recorded decision, and no student or session data yet.
 */
export function needsFirstRunPrompt(): boolean {
  return !isPasscodeEnabled() && getPasscodeDecision() === null && !hasExistingStudentData();
}

/**
 * Whether to show the one-time passcode offer: an existing install (student or session data
 * already stored) with no passcode and no recorded decision. This is an offer, never a block:
 * dismissing it leaves the data accessible without a passcode.
 */
export function needsPasscodeOffer(): boolean {
  return !isPasscodeEnabled() && getPasscodeDecision() === null && hasExistingStudentData();
}
