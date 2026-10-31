import { GOAL_TYPE_VALUES, type GoalType } from './types';

// Goal type keys renamed since earlier versions. Saved data (students, templates, sessions, backups, CSV
// exports) may still hold an earlier key; it is read as the current one. The earlier story key began with
// "STORY_", like the current one, so any unknown "STORY_..." key is the story elements type.

/** The current goal type for a stored type key (unchanged when it isn't an earlier key). */
export function currentGoalType(type: unknown): unknown {
  if (typeof type !== 'string' || (GOAL_TYPE_VALUES as readonly string[]).includes(type)) return type;
  if (type.startsWith('STORY_')) return 'STORY_ELEMENTS' satisfies GoalType;
  return type;
}

const TYPE_FIELDS = new Set(['type', 'dataCaptureType', 'goalType', 'fromType']);

/** A JSON.parse reviver that reads earlier goal type keys as the current ones. */
export function reviveGoalTypes(key: string, value: unknown): unknown {
  return TYPE_FIELDS.has(key) ? currentGoalType(value) : value;
}
