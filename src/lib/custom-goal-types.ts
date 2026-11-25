import * as secureStore from './secure-store';
import { CUSTOM_MEASURE_KINDS, type CustomGoalType, type Goal, type GoalTemplate } from './types';
import { cloneCustomGoalType } from './goal-types/custom';

const KEY_BASE = 'ascended_custom_goal_types_v1_';
export const customGoalTypesKey = (userId: string | undefined) => KEY_BASE + (userId || 'guest');
export const CUSTOM_GOAL_TYPES_EVENT = 'ascended-custom-goal-types';
const DAMAGED_MESSAGE = 'The saved custom goal types could not be read, so they were not changed. Restore a backup in Settings to replace them.';

const VALID_KINDS = new Set<string>(CUSTOM_MEASURE_KINDS);

export function isValidStoredCustomGoalType(raw: unknown): raw is CustomGoalType {
  if (!raw || typeof raw !== 'object') return false;
  const ct = raw as Record<string, unknown>;
  if (typeof ct.id !== 'string' || ct.id.length < 1) return false;
  if (typeof ct.version !== 'number' || !Number.isInteger(ct.version) || ct.version < 1) return false;
  if (typeof ct.name !== 'string' || ct.name.trim().length < 2 || ct.name.trim().length > 60) return false;
  if (ct.description !== undefined && (typeof ct.description !== 'string' || ct.description.length > 240)) return false;
  if (typeof ct.color !== 'string' || ct.color.length < 3) return false;
  if (typeof ct.kind !== 'string' || !VALID_KINDS.has(ct.kind)) return false;
  if (ct.direction !== 'increase' && ct.direction !== 'decrease') return false;
  if (!ct.extras || typeof ct.extras !== 'object') return false;
  const extras = ct.extras as Record<string, unknown>;
  if (typeof extras.promptLevel !== 'boolean' || typeof extras.notes !== 'boolean') return false;
  if (typeof ct.createdAt !== 'string') return false;
  if (ct.kind === 'rating') {
    const r = ct.rating as Record<string, unknown> | undefined;
    if (!r || typeof r.min !== 'number' || typeof r.max !== 'number' || r.max <= r.min || r.max - r.min > 9) return false;
  }
  if (ct.kind === 'checklist') {
    const c = ct.checklist as Record<string, unknown> | undefined;
    if (!c || !Array.isArray(c.steps) || c.steps.length === 0) return false;
  }
  return true;
}

function parseStoredList(raw: unknown): CustomGoalType[] {
  if (!Array.isArray(raw)) return [];
  const valid: CustomGoalType[] = [];
  for (const item of raw) {
    if (isValidStoredCustomGoalType(item)) valid.push(item);
  }
  return valid;
}

export function getCustomGoalTypes(userId: string | undefined): CustomGoalType[] {
  try {
    const stored = secureStore.getItem(customGoalTypesKey(userId));
    if (!stored || stored === '\u0000damaged') return [];
    return parseStoredList(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function isCustomGoalTypesDamaged(userId: string | undefined): boolean {
  return secureStore.isUndecryptable(customGoalTypesKey(userId));
}

export function saveCustomGoalTypes(userId: string | undefined, types: CustomGoalType[]) {
  if (isCustomGoalTypesDamaged(userId)) throw new Error(DAMAGED_MESSAGE);
  saveCustomGoalTypesNow(userId, types);
}

/** Saves custom goal types even when the saved ones couldn't be read (a restore replacing damaged data). */
export function saveCustomGoalTypesForRestore(userId: string | undefined, types: CustomGoalType[]) {
  secureStore.clearUndecryptable(customGoalTypesKey(userId));
  saveCustomGoalTypesNow(userId, types);
}

function saveCustomGoalTypesNow(userId: string | undefined, types: CustomGoalType[]) {
  try {
    secureStore.setItem(customGoalTypesKey(userId), JSON.stringify(types));
  } catch (error) {
    if (error instanceof Error && error.message === 'Locked') throw error;
    throw new Error('The custom goal types could not be saved on this device (storage is full or unavailable).');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CUSTOM_GOAL_TYPES_EVENT));
  }
}

/**
 * Whether an assigned goal or template holds an older snapshot of a custom goal type that has since been edited in
 * Settings. Goals keep their own copy so edits don't silently rewrite past sessions, and offer an explicit update.
 */
export function findNewerCustomGoalType(
  goalOrTemplate: Pick<Goal, 'type' | 'customType'> | Pick<GoalTemplate, 'type' | 'customType'>,
  library: CustomGoalType[],
): CustomGoalType | null {
  if (goalOrTemplate.type !== 'CUSTOM' || !goalOrTemplate.customType) return null;
  const latest = library.find(t => t.id === goalOrTemplate.customType!.id);
  if (!latest) return null;
  return latest.version > (goalOrTemplate.customType.version || 1) ? latest : null;
}

/** Returns a copy of a goal or template updated to the latest version of its custom goal type. */
export function applyCustomGoalTypeUpdate<T extends { type: string; customType?: CustomGoalType }>(
  item: T,
  latest: CustomGoalType,
): T {
  return {
    ...item,
    customType: cloneCustomGoalType(latest),
  };
}

/** Formats custom goal types as a shareable JSON file. */
export function exportCustomGoalTypesJson(types: CustomGoalType[]): string {
  return JSON.stringify(
    {
      app: 'AscendEd',
      kind: 'custom-goal-types',
      version: 1,
      exportedAt: new Date().toISOString(),
      customGoalTypes: types,
    },
    null,
    2,
  );
}
