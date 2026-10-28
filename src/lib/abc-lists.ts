import { z } from 'zod';
import {
  ABC_ANTECEDENTS, ABC_BEHAVIORS, ABC_CONSEQUENCES, ABC_REPLACEMENT_BEHAVIOR, BEHAVIOR_FUNCTIONS, type BehaviorFunction,
} from './goal-constants/behavior';

// The choices shown when recording ABC data, editable in Settings. They are stored on this device and
// included in backups. "Used replacement skill" is always the first behavior and isn't part of the list.

export interface AbcLists {
  antecedents: string[];
  behaviors: string[];
  consequences: { label: string; fn: BehaviorFunction | null }[];
}

export const DEFAULT_ABC_LISTS: AbcLists = {
  antecedents: [...ABC_ANTECEDENTS],
  behaviors: ABC_BEHAVIORS.filter(b => b !== ABC_REPLACEMENT_BEHAVIOR),
  consequences: ABC_CONSEQUENCES.map(c => ({ ...c })),
};

const item = z.string().trim().min(1).max(60);
export const AbcListsSchema = z.object({
  antecedents: z.array(item),
  behaviors: z.array(item),
  consequences: z.array(z.object({ label: item, fn: z.enum(BEHAVIOR_FUNCTIONS).nullable() })),
});

const ABC_LISTS_KEY = 'ascended_abc_lists';
const CHANGE_EVENT = 'ascended-abc-lists-change';

/** The lists saved on this device, or null if they've never been changed. */
export function loadCustomAbcLists(): AbcLists | null {
  try {
    const stored = window.localStorage.getItem(ABC_LISTS_KEY);
    if (!stored) return null;
    const parsed = AbcListsSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function loadAbcLists(): AbcLists {
  return loadCustomAbcLists() ?? DEFAULT_ABC_LISTS;
}

/** Saves the lists; null goes back to the defaults. */
export function saveAbcLists(lists: AbcLists | null) {
  if (lists) window.localStorage.setItem(ABC_LISTS_KEY, JSON.stringify(lists));
  else window.localStorage.removeItem(ABC_LISTS_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onAbcListsChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/** Everything in `current`, followed by the items from `incoming` it doesn't have. */
export function mergeAbcLists(current: AbcLists, incoming: AbcLists): AbcLists {
  const union = (a: string[], b: string[]) => [...a, ...b.filter(x => !a.includes(x))];
  const labels = current.consequences.map(c => c.label);
  return {
    antecedents: union(current.antecedents, incoming.antecedents),
    behaviors: union(current.behaviors, incoming.behaviors),
    consequences: [...current.consequences, ...incoming.consequences.filter(c => !labels.includes(c.label))],
  };
}
