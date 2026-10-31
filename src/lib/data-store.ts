import type { SessionData } from './types';
import { compareSessionsOldestFirst } from './helpers';
import * as secureStore from './secure-store';
import { reviveGoalTypes } from './legacy-goal-types';

// Where the student data lives on the device: one stored list each of students, goal templates and sessions,
// per user. Student data goes through secure-store (encrypted when passcode protection is on).

const STUDENTS_BASE_KEY = 'ascended_students_v2';
const GOAL_TEMPLATES_BASE_KEY = 'ascended_goal_templates_v2';
const SESSIONS_BASE_KEY = 'ascended_sessions_v2';

export interface StorageKeys {
  students: string | null;
  templates: string | null;
  sessions: string | null;
}

/** The storage keys of a user's lists (null without a user). */
export function storageKeys(uid: string | undefined): StorageKeys {
  const key = (base: string) => (uid ? `${base}_${uid}` : null);
  return { students: key(STUDENTS_BASE_KEY), templates: key(GOAL_TEMPLATES_BASE_KEY), sessions: key(SESSIONS_BASE_KEY) };
}

/**
 * A stored list: [] when there is none yet, or undefined when it is there but can't be read (damaged, or not
 * a list). Goal type keys from earlier versions are read as the current ones.
 */
export function readList<T>(key: string | null): T[] | undefined {
  if (typeof window === 'undefined' || !key) return [];
  try {
    const item = secureStore.getItem(key);
    const value = item ? JSON.parse(item, reviveGoalTypes) : [];
    return Array.isArray(value) ? value : undefined;
  } catch (error) {
    console.warn(`Error reading from localStorage key "${key}":`, error);
    return undefined;
  }
}

/** Students and templates are kept sorted by name, sessions newest first. */
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
export const byDateDesc = (a: SessionData, b: SessionData) => compareSessionsOldestFirst(b, a);
