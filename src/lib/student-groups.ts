'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateUUID } from './helpers';
import * as secureStore from './secure-store';
import { clearStorageFailure, reportStorageFailure } from './storage-failure';

// Saved groups of students (a class, a small group) that can be loaded into Data Entry's slots together
// (Students → Groups, or Data Entry → Load Group). A group keeps student IDs only, so renaming a student or
// archiving one doesn't need the group changed; archived and deleted students are skipped when it's loaded.
//
// Groups go through secure-store, so with passcode protection on they are encrypted like the student
// data instead of sitting in localStorage as plaintext. A stored list that can't be read is shown as
// no groups and never written over — only a restore replaces it.

export interface StudentGroup {
  id: string;
  name: string;
  studentIds: string[];
}

const KEY_BASE = 'ascended_student_groups_v1_';
export const studentGroupsKey = (userId: string | undefined) => KEY_BASE + (userId || 'guest');
export const STUDENT_GROUPS_EVENT = 'ascended-student-groups';
const DAMAGED_MESSAGE = 'The saved student groups could not be read, so they were not changed. Restore a backup in Settings to replace them.';

export function getStudentGroups(userId: string | undefined): StudentGroup[] {
  try {
    const stored = secureStore.getItem(studentGroupsKey(userId));
    if (!stored || stored === '\u0000damaged') return [];
    const groups = JSON.parse(stored);
    return Array.isArray(groups)
      ? groups.filter((g): g is StudentGroup => g && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.studentIds))
      : [];
  } catch {
    return [];
  }
}

/** Whether the saved groups couldn't be read: shown as none, never written over. */
export function isStudentGroupsDamaged(userId: string | undefined): boolean {
  return secureStore.isUndecryptable(studentGroupsKey(userId));
}

export function saveStudentGroups(userId: string | undefined, groups: StudentGroup[]) {
  if (isStudentGroupsDamaged(userId)) throw new Error(DAMAGED_MESSAGE);
  saveStudentGroupsNow(userId, groups);
}

/** Saves the groups even when the saved ones couldn't be read: a restore replacing damaged data. */
export function saveStudentGroupsForRestore(userId: string | undefined, groups: StudentGroup[]) {
  secureStore.clearUndecryptable(studentGroupsKey(userId));
  saveStudentGroupsNow(userId, groups);
}

function saveStudentGroupsNow(userId: string | undefined, groups: StudentGroup[]) {
  try {
    secureStore.setItem(studentGroupsKey(userId), JSON.stringify(groups));
    clearStorageFailure('student-groups');
  } catch (error) {
    // Locked (passcode on, not unlocked) is not a storage failure: keep the original error.
    if (error instanceof Error && error.message === 'Locked') throw error;
    // A failed save used to be silent ("this visit only"). It is recorded (persistent warning)
    // and thrown, so the dialog that asked for the save can say the groups weren't kept.
    reportStorageFailure('student-groups', error);
    throw new Error('The student groups could not be saved on this device (storage is full or unavailable). They are only kept for this visit.');
  }
  window.dispatchEvent(new Event(STUDENT_GROUPS_EVENT));
}

/** The saved groups (sorted by name) and functions to change them; updates wherever groups are shown. */
export function useStudentGroups(userId: string | undefined) {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  useEffect(() => {
    const load = () => setGroups(getStudentGroups(userId).sort((a, b) => a.name.localeCompare(b.name)));
    load();
    window.addEventListener(STUDENT_GROUPS_EVENT, load);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== studentGroupsKey(userId) && event.key !== null) return;
      // Another tab changed the groups: the in-memory cache is stale until the stored value is read back.
      void secureStore.refreshFromStorage(studentGroupsKey(userId)).then(load);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(STUDENT_GROUPS_EVENT, load);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId]);

  const saveGroup = useCallback((group: Omit<StudentGroup, 'id'> & { id?: string }) => {
    const all = getStudentGroups(userId);
    const saved: StudentGroup = { id: group.id ?? generateUUID(), name: group.name.trim(), studentIds: group.studentIds };
    saveStudentGroups(userId, group.id ? all.map(g => (g.id === group.id ? saved : g)) : [...all, saved]);
    return saved;
  }, [userId]);

  const deleteGroup = useCallback((id: string) => {
    saveStudentGroups(userId, getStudentGroups(userId).filter(g => g.id !== id));
  }, [userId]);

  return { groups, saveGroup, deleteGroup };
}
