import { captureTypeOf, hasTargetDirection } from './goal-constants/behavior';
import type { CustomGoalType, TargetDirection } from './types';

// Fields that only mean something for some data capture methods, tidied when a goal or template's method changes
// (Edit Goal, the template editors) and when stored data is loaded, so a value left over from the old method can't
// change how the goal is measured:
// - A direction (increase / decrease) is only offered for behavior, timed communication and custom types. A
//   "decrease" kept after switching to Discrete Trials made 20% count as meeting an 80% target.
// - A custom type chosen as the method of a built-in goal makes it a custom goal (type CUSTOM), so every part of
//   the app that looks for custom goals (Data Entry's result line, direction, the Settings usage count and
//   "Update to latest") treats it as one. A goal moved off a custom type takes the built-in method's type.
// - Only Goal Attainment Scaling has negative levels: a GAS template's baseline of -2 kept after switching to
//   another method started the aim line at -2 and blocked saving the goal ("Baseline must be 0 or greater").

interface TypedFields {
  type: string;
  dataCaptureType?: string;
  targetDirection?: TargetDirection;
  baseline?: number;
  customType?: CustomGoalType;
}

/** The goal or template with the fields its data capture method can't use tidied; the same object when none were. */
export function withFieldsForCaptureType<T extends TypedFields>(item: T): T {
  const capture = captureTypeOf(item);
  let next = item;
  const set = (patch: Partial<TypedFields>) => { next = { ...next, ...patch }; };

  if (capture === 'CUSTOM' && item.customType && item.type !== 'CUSTOM') set({ type: 'CUSTOM' });
  if (item.type === 'CUSTOM' && capture !== 'CUSTOM') set({ type: capture, customType: undefined });
  if (item.targetDirection !== undefined && !hasTargetDirection(capture)) set({ targetDirection: undefined });
  if (typeof item.baseline === 'number' && item.baseline < 0 && capture !== 'GOAL_ATTAINMENT_SCALE') set({ baseline: undefined });

  if (next === item) return item;
  // Leave the tidied fields out instead of storing them as undefined.
  const out = { ...next } as Record<string, unknown>;
  for (const key of ['targetDirection', 'baseline', 'customType'] as const) if (out[key] === undefined) delete out[key];
  return out as T;
}

/**
 * An edit to save on a goal or template, with the fields the new data capture method can't use tidied (see
 * withFieldsForCaptureType). Tidied fields are set to undefined explicitly, so merging the edit into the stored
 * record removes them.
 */
export function tidiedUpdate<T extends TypedFields>(original: T, updates: Partial<T>): Partial<T> {
  const merged = { ...original, ...updates };
  const tidy = withFieldsForCaptureType(merged);
  if (tidy === merged) return updates;
  return { ...updates, type: tidy.type, targetDirection: tidy.targetDirection, baseline: tidy.baseline, customType: tidy.customType };
}
