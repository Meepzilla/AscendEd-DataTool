import type { AppBackup, BackupData, RestoreMode, RestoreSummary } from './backup';
import { mergeBackupData } from './backup';
import { loadAbcLists, mergeAbcLists, saveAbcLists, saveAbcListsForRestore } from './abc-lists';
import { loadCommFunctions, mergeCommFunctions, saveCommFunctions, saveCommFunctionsForRestore } from './comm-functions';
import { getStudentGroups, saveStudentGroups, saveStudentGroupsForRestore } from './student-groups';
import { getCustomGoalTypes, saveCustomGoalTypes, saveCustomGoalTypesForRestore } from './custom-goal-types';
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
 * Restores the backup's settings: custom ABC lists, the communication functions list, saved student groups and custom goal types. Replace uses the
 * backup's (leaving existing custom goal types intact only when the backup was made before custom types existed);
 * merge adds what this device doesn't have. A failure saving any setting is passed to onError.
 */
export function restoreBackupSettings(backup: AppBackup, mode: RestoreMode, userId: string | undefined, onError: (error: unknown) => void) {
  const abcLists = backup.settings?.abcLists;
  try {
    if (mode === 'replace') saveAbcListsForRestore(abcLists ?? null);
    else if (abcLists) saveAbcLists(mergeAbcLists(loadAbcLists(), abcLists));
  } catch (error) {
    onError(error);
  }
  const commFunctions = backup.settings?.commFunctions;
  try {
    if (mode === 'replace') saveCommFunctionsForRestore(commFunctions ?? null);
    else if (commFunctions?.length) saveCommFunctions(mergeCommFunctions(loadCommFunctions(), commFunctions));
  } catch (error) {
    onError(error);
  }
  const groups = backup.settings?.studentGroups;
  try {
    if (mode === 'replace') saveStudentGroupsForRestore(userId, groups ?? []);
    else if (groups?.length) {
      const existing = getStudentGroups(userId);
      saveStudentGroups(userId, [...existing, ...groups.filter(g => !existing.some(e => e.id === g.id))]);
    }
  } catch (error) {
    onError(error);
  }
  const customTypes = backup.settings?.customGoalTypes;
  try {
    if (mode === 'replace' && customTypes !== undefined) {
      saveCustomGoalTypesForRestore(userId, customTypes);
    } else if (customTypes?.length) {
      const existing = getCustomGoalTypes(userId);
      saveCustomGoalTypes(userId, [...existing, ...customTypes.filter(t => !existing.some(e => e.id === t.id))]);
    }
  } catch (error) {
    onError(error);
  }
}
