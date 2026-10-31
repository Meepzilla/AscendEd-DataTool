import type { AppBackup, BackupData, RestoreMode, RestoreSummary } from './backup';
import { mergeBackupData } from './backup';
import { loadAbcLists, mergeAbcLists, saveAbcLists } from './abc-lists';
import { getStudentGroups, saveStudentGroups } from './student-groups';
import { byDateDesc, byName } from './data-store';

// Restoring a backup (Settings → Backup & Restore): what the device's lists become, and the backup's settings.

/**
 * The lists after restoring: 'replace' uses the backup's, 'merge' adds the backup's records that aren't
 * already here. The summary counts the records loaded (replace) or added (merge).
 */
export function planRestore(current: BackupData, backup: AppBackup, mode: RestoreMode): { next: BackupData; summary: RestoreSummary } {
  let next = backup.data;
  let summary: RestoreSummary = { students: next.students.length, goalTemplates: next.goalTemplates.length, sessions: next.sessions.length, goals: 0 };
  if (mode === 'merge') {
    const result = mergeBackupData(current, backup.data);
    next = result.merged;
    summary = result.added;
  }
  return {
    next: { students: [...next.students].sort(byName), goalTemplates: [...next.goalTemplates].sort(byName), sessions: [...next.sessions].sort(byDateDesc) },
    summary,
  };
}

/**
 * Restores the backup's settings: custom ABC lists and saved student groups. Replace uses the backup's (clearing
 * custom ABC lists when it has none); merge adds what this device doesn't have. A failure saving the ABC lists
 * is passed to onError (the student data is already restored).
 */
export function restoreBackupSettings(backup: AppBackup, mode: RestoreMode, userId: string | undefined, onError: (error: unknown) => void) {
  const abcLists = backup.settings?.abcLists;
  try {
    if (mode === 'replace') saveAbcLists(abcLists ?? null);
    else if (abcLists) saveAbcLists(mergeAbcLists(loadAbcLists(), abcLists));
  } catch (error) {
    onError(error);
  }
  const groups = backup.settings?.studentGroups;
  if (mode === 'replace') saveStudentGroups(userId, groups ?? []);
  else if (groups?.length) {
    const existing = getStudentGroups(userId);
    saveStudentGroups(userId, [...existing, ...groups.filter(g => !existing.some(e => e.id === g.id))]);
  }
}
