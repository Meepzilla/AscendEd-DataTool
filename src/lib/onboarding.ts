// What a new user has done, for the dashboard's Getting Started checklist (GettingStarted.tsx). The other steps are
// read from the data itself (students, goals, sessions, the last backup); viewing a report leaves no data, so the
// Reports page notes it here. Saved on this device, for each user like the rest of their data.

import { readLocal, writeLocal } from './safe-storage';

const REPORT_VIEWED_KEY = 'ascended_onboarding_report_viewed';
const GETTING_STARTED_KEY = 'ascended_getting_started';

/**
 * Whether the checklist is shown: "shown", or "hidden" (hidden by the user, or someone who already had sessions
 * when the checklist first looked). Nothing stored means it hasn't looked yet.
 */
export type GettingStartedState = 'shown' | 'hidden';

export function getGettingStarted(uid: string): GettingStartedState | null {
  const value = readLocal(`${GETTING_STARTED_KEY}_${uid}`);
  return value === 'shown' || value === 'hidden' ? value : null;
}

export function setGettingStarted(uid: string, state: GettingStartedState) {
  writeLocal(`${GETTING_STARTED_KEY}_${uid}`, state);
}

export function isReportViewed(uid: string): boolean {
  return readLocal(`${REPORT_VIEWED_KEY}_${uid}`) === '1';
}

export function markReportViewed(uid: string) {
  if (!isReportViewed(uid)) writeLocal(`${REPORT_VIEWED_KEY}_${uid}`, '1');
}
