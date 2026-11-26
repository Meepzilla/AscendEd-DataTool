import * as secureStore from './secure-store';
import { CUSTOM_CHART_IDS, CUSTOM_MEASURE_KINDS, type CustomGoalType, type Goal, type GoalTemplate } from './types';
import { cloneCustomGoalType } from './goal-types/custom';

const KEY_BASE = 'ascended_custom_goal_types_v1_';
export const customGoalTypesKey = (userId: string | undefined) => KEY_BASE + (userId || 'guest');
export const CUSTOM_GOAL_TYPES_EVENT = 'ascended-custom-goal-types';
const DAMAGED_MESSAGE = 'The saved custom goal types could not be read, so they were not changed. Restore a backup in Settings to replace them.';

const VALID_KINDS = new Set<string>(CUSTOM_MEASURE_KINDS);
const VALID_CHART_IDS = new Set<string>(CUSTOM_CHART_IDS);

// The checks below mirror CustomGoalTypeSchema in ./schemas.ts field by field — the standard the
// import and backup paths apply. They are hand-rolled here on purpose: this module is imported
// statically by Settings and the goal-type hook, and importing the Zod schema would pull Zod back
// into those pages' first load, undoing the bundle split. Keep the two in step when either changes
// (review findings A8/D3: the stored list once applied a weaker standard than import).
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const labelOk = (v: unknown, max: number) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= max;
const intIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export function isValidStoredCustomGoalType(raw: unknown): raw is CustomGoalType {
  if (!isRecord(raw)) return false;
  const ct = raw;
  if (typeof ct.id !== 'string' || ct.id.length < 1) return false;
  if (typeof ct.version !== 'number' || !Number.isInteger(ct.version) || ct.version < 1) return false;
  if (typeof ct.name !== 'string' || ct.name.trim().length < 2 || ct.name.trim().length > 60) return false;
  if (ct.description !== undefined && (typeof ct.description !== 'string' || ct.description.length > 240)) return false;
  if (typeof ct.color !== 'string' || ct.color.length < 3) return false;
  if (typeof ct.kind !== 'string' || !VALID_KINDS.has(ct.kind)) return false;
  if (ct.direction !== 'increase' && ct.direction !== 'decrease') return false;
  if (!isRecord(ct.extras)) return false;
  if (typeof ct.extras.promptLevel !== 'boolean' || typeof ct.extras.notes !== 'boolean') return false;
  if (typeof ct.createdAt !== 'string') return false;
  if (ct.updatedAt !== undefined && typeof ct.updatedAt !== 'string') return false;
  if (ct.isArchived !== undefined && typeof ct.isArchived !== 'boolean') return false;

  // Kind payloads: each is optional in the schema, but when present it must meet the same caps.
  if (ct.accuracy !== undefined) {
    if (!isRecord(ct.accuracy)) return false;
    if (!labelOk(ct.accuracy.correctLabel, 30) || !labelOk(ct.accuracy.incorrectLabel, 30)) return false;
    if (typeof ct.accuracy.approximate !== 'boolean') return false;
  }
  if (ct.counter !== undefined) {
    if (!isRecord(ct.counter) || !labelOk(ct.counter.label, 40)) return false;
    if (typeof ct.counter.perMinute !== 'boolean') return false;
  }
  if (ct.timer !== undefined && (!isRecord(ct.timer) || !labelOk(ct.timer.label, 40))) return false;
  if (ct.rating !== undefined) {
    if (!isRecord(ct.rating)) return false;
    if (!intIn(ct.rating.min, 0, 9) || !intIn(ct.rating.max, 1, 10)) return false;
    if (ct.rating.levelLabels !== undefined) {
      if (!Array.isArray(ct.rating.levelLabels) || ct.rating.levelLabels.length > 11) return false;
      if (!ct.rating.levelLabels.every(l => typeof l === 'string' && l.length <= 30)) return false;
    }
  }
  if (ct.checklist !== undefined) {
    if (!isRecord(ct.checklist) || !Array.isArray(ct.checklist.steps)) return false;
    if (ct.checklist.steps.length < 1 || ct.checklist.steps.length > 40) return false;
    if (!ct.checklist.steps.every(s => typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= 120)) return false;
  }
  if (ct.yesno !== undefined && (!isRecord(ct.yesno) || !labelOk(ct.yesno.question, 120))) return false;
  if (ct.prompting !== undefined && (!isRecord(ct.prompting) || !labelOk(ct.prompting.label, 40))) return false;
  if (ct.trials !== undefined && (!isRecord(ct.trials) || !intIn(ct.trials.count, 1, 100))) return false;
  if (ct.latency !== undefined && (!isRecord(ct.latency) || !labelOk(ct.latency.label, 40))) return false;
  if (ct.utterances !== undefined) {
    if (!isRecord(ct.utterances) || (ct.utterances.unit !== 'words' && ct.utterances.unit !== 'morphemes')) return false;
  }
  if (ct.charts !== undefined) {
    if (!isRecord(ct.charts)) return false;
    if (ct.charts.style !== 'line' && ct.charts.style !== 'bar') return false;
    if (!Array.isArray(ct.charts.show) || ct.charts.show.length > CUSTOM_CHART_IDS.length) return false;
    if (!ct.charts.show.every(id => typeof id === 'string' && VALID_CHART_IDS.has(id))) return false;
  }

  // The schema's cross-field rules: a rating type needs its scale, a checklist type its steps,
  // and a default target must sit inside the scale or percentage it applies to.
  if (ct.kind === 'rating') {
    if (!isRecord(ct.rating)) return false;
    const min = ct.rating.min as number;
    const max = ct.rating.max as number;
    if (max <= min || max - min > 9) return false;
    if (ct.defaultTarget !== undefined && (typeof ct.defaultTarget !== 'number' || ct.defaultTarget < min || ct.defaultTarget > max)) return false;
  }
  if (ct.kind === 'checklist' && !isRecord(ct.checklist)) return false;
  if (ct.defaultTarget !== undefined) {
    if (typeof ct.defaultTarget !== 'number' || Number.isNaN(ct.defaultTarget) || ct.defaultTarget < 0 || ct.defaultTarget > 1000) return false;
    if ((ct.kind === 'accuracy' || ct.kind === 'checklist' || ct.kind === 'yesno') && ct.defaultTarget > 100) return false;
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
