'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateUUID } from './helpers';

// Saved groups of students (a class, a small group) that can be loaded into Data Entry's slots together
// (Students → Groups, or Data Entry → Load Group). A group keeps student IDs only, so renaming a student or
// archiving one doesn't need the group changed; archived and deleted students are skipped when it's loaded.

export interface StudentGroup {
  id: string;
  name: string;
  studentIds: string[];
}

const KEY = 'ascended_student_groups_v1_';
export const STUDENT_GROUPS_EVENT = 'ascended-student-groups';

export function getStudentGroups(userId: string | undefined): StudentGroup[] {
  try {
    const groups = JSON.parse(localStorage.getItem(KEY + (userId || 'guest')) || '[]');
    return Array.isArray(groups)
      ? groups.filter((g): g is StudentGroup => g && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.studentIds))
      : [];
  } catch {
    return [];
  }
}

export function saveStudentGroups(userId: string | undefined, groups: StudentGroup[]) {
  try { localStorage.setItem(KEY + (userId || 'guest'), JSON.stringify(groups)); } catch { /* this visit only */ }
  window.dispatchEvent(new Event(STUDENT_GROUPS_EVENT));
}

/** The saved groups (sorted by name) and functions to change them; updates wherever groups are shown. */
export function useStudentGroups(userId: string | undefined) {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  useEffect(() => {
    const load = () => setGroups(getStudentGroups(userId).sort((a, b) => a.name.localeCompare(b.name)));
    load();
    window.addEventListener(STUDENT_GROUPS_EVENT, load);
    return () => window.removeEventListener(STUDENT_GROUPS_EVENT, load);
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
