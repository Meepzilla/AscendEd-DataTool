'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateUUID } from '@/lib/helpers';
import * as secureStore from '@/lib/secure-store';
import {
  STUDENT_GROUPS_EVENT,
  getStudentGroups,
  saveStudentGroups,
  studentGroupsKey,
  type StudentGroup,
} from '@/lib/student-groups';

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
