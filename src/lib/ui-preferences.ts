// Small device-only UI preferences saved in localStorage (none of these hold student data).

// --- School or district name (printed at the top of progress reports instead of the app's name) ---

export const ORGANIZATION_NAME_KEY = 'ascended_organization_name';

export function getOrganizationName(): string {
  try { return localStorage.getItem(ORGANIZATION_NAME_KEY)?.trim() ?? ''; } catch { return ''; }
}

export function setOrganizationName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(ORGANIZATION_NAME_KEY, name);
    else localStorage.removeItem(ORGANIZATION_NAME_KEY);
  } catch { /* kept for this visit only */ }
}

// --- Student sidebar visibility (Settings → Interface) ---
// Stored as JSON true/false; read here, safely, by both the app layout and Settings. A damaged value used to
// throw on every page under the layout, landing the app on its error screen, and Settings (the page with the
// toggle) broke on the same value, so there was no way back in the app. A value that isn't true or false now
// reads as the default, and the next toggle writes a good one.

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

// --- Menu bar position: top of the screen (default) or bottom ---
// The choice is a class on <html> ("menu-bottom"), set before the first paint by the display-size script
// (display-scale.ts) and read by the CSS in globals.css.

export type MenuPosition = 'top' | 'bottom';
export const MENU_POSITION_KEY = 'ascended_menu_position';
export const MENU_POSITION_EVENT = 'ascended-menu-position';

export function getMenuPosition(): MenuPosition {
  try {
    return localStorage.getItem(MENU_POSITION_KEY) === 'bottom' ? 'bottom' : 'top';
  } catch {
    return 'top';
  }
}

export function setMenuPosition(position: MenuPosition) {
  try {
    localStorage.setItem(MENU_POSITION_KEY, position);
  } catch {
    // Not saved; still applied for this visit.
  }
  document.documentElement.classList.toggle('menu-bottom', position === 'bottom');
  window.dispatchEvent(new Event(MENU_POSITION_EVENT));
}
