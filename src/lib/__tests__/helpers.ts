import type { Goal, SessionData } from '../types';

// Small builders for test data.

export function goal(overrides: Partial<Goal> = {}): Goal {
  return { id: 'g1', name: 'Goal', type: 'ARTICULATION', smartGoal: 'Student will do it.', ...overrides } as Goal;
}

let nextId = 0;
export function session(overrides: Partial<SessionData> = {}): SessionData {
  nextId += 1;
  return {
    sessionId: `s${nextId}`, studentId: 'st1', studentName: 'Ava', date: '2026-10-05T09:00:00.000Z', time: '09:00', endTime: '09:30',
    activity: '', notes: '', goals: [], originalGoalHeaders: [], ...overrides,
  };
}

/** A minimal in-memory localStorage. */
export function memoryStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    clear: () => store.clear(),
    get length() { return store.size; },
  };
}
