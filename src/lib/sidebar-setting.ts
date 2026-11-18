// Whether the student sidebar is shown (Settings → Student Sidebar). Stored as JSON true/false; read here, safely, by
// both the app layout and Settings. A damaged value used to throw on every page under the layout, landing the app on
// its error screen, and Settings (the page with the toggle) broke on the same value, so there was no way back in the
// app. A value that isn't true or false now reads as the default, and the next toggle writes a good one.

export const SIDEBAR_ENABLED_KEY = 'sidebar_enabled';

/** Whether the sidebar is on: the stored true/false, or on (the default) when nothing usable is stored. */
export function readSidebarEnabled(stored: string | null): boolean {
  if (stored === null) return true;
  try {
    const value: unknown = JSON.parse(stored);
    return typeof value === 'boolean' ? value : true;
  } catch {
    return true;
  }
}
