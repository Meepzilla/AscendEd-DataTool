// What a new user has done, for the dashboard's Getting Started checklist (GettingStarted.tsx). The other steps are
// read from the data itself (students, goals, sessions, the last backup); viewing a report leaves no data, so the
// Reports page notes it here. Saved on this device.

export const REPORT_VIEWED_KEY = 'ascended_onboarding_report_viewed';

export function markReportViewed() {
  try {
    if (localStorage.getItem(REPORT_VIEWED_KEY) !== '1') localStorage.setItem(REPORT_VIEWED_KEY, '1');
  } catch {
    // Not saved: the step stays unticked.
  }
}
