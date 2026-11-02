// Built-in goal templates the user can hide or delete. Hiding is a view setting on the Goals page (saved on the
// device). Deleting a built-in template keeps its record with `deleted: true`: the app adds missing built-in
// templates when it loads, so without that record the deleted one would come straight back. Settings → Built-in
// goals restores them. Deleted records are kept out of every list the app shows, but stay in backups.

import type { GoalTemplate } from './types';
import { readLocal, writeLocal } from './safe-storage';

export const HIDE_BUILTIN_GOALS_KEY = 'ascended_goals_hide_builtin';

export function getHideBuiltInGoals(): boolean {
  return readLocal(HIDE_BUILTIN_GOALS_KEY) === '1';
}

export function setHideBuiltInGoals(hide: boolean) {
  writeLocal(HIDE_BUILTIN_GOALS_KEY, hide ? '1' : '0');
}

/** The templates the app shows: everything except built-in templates the user deleted. */
export function visibleTemplates<T extends GoalTemplate>(templates: T[]): T[] {
  return templates.filter(t => !t.deleted);
}

/** Built-in templates the user deleted, sorted by name. */
export function deletedBuiltInTemplates<T extends GoalTemplate>(templates: T[]): T[] {
  return templates.filter(t => t.isDefault && t.deleted).sort((a, b) => a.name.localeCompare(b.name));
}

/** The list with the given built-in templates restored (back in the library, not archived). */
export function restoreBuiltInTemplates<T extends GoalTemplate>(templates: T[], ids: string[]): T[] {
  const restore = new Set(ids);
  return templates.map(t => (restore.has(t.id) && t.isDefault && t.deleted ? { ...t, deleted: false, isArchived: false } : t));
}
