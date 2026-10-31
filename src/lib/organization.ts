// The school or district name printed at the top of reports instead of the app's name (Settings → Interface).
// Saved on this device only; it isn't student data.

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
