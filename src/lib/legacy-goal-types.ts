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

// A goal type field in JSON text, with its string value (escapes kept as written).
const TYPE_FIELD_TEXT = /"(?:type|dataCaptureType|goalType|fromType)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

/**
 * JSON.parse with earlier goal type keys read as the current ones: the same result as
 * JSON.parse(text, reviveGoalTypes). A reviver makes parsing several times slower, and saved lists hold earlier
 * keys only after an upgrade, so the text is checked first and the reviver used only when it holds one.
 */
export function parseWithCurrentGoalTypes(text: string): unknown {
  for (const match of text.matchAll(TYPE_FIELD_TEXT)) {
    const value = match[1];
    if (value.includes('\\') || currentGoalType(value) !== value) return JSON.parse(text, reviveGoalTypes);
  }
  return JSON.parse(text);
}
